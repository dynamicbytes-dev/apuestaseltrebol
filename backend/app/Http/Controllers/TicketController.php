<?php

namespace App\Http\Controllers;

use App\Models\AnimalitoSorteo;
use App\Models\HorseRacingBet;
use App\Models\Lottery;
use App\Models\LotteryAnimal;
use App\Models\Race;
use App\Models\Ticket;
use App\Models\TicketMovement;
use App\Models\User;
use App\Services\TicketMovementService;
use App\Services\TicketSettlementService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TicketController extends Controller
{
    public function __construct(
        private readonly TicketSettlementService $settlements,
        private readonly TicketMovementService $movements,
    ) {}

    public function catalog(): JsonResponse
    {
        /** @var User $taquilla */
        $taquilla = auth('api')->user();
        $agency = $taquilla->agency;

        // Sorteos ya resueltos: el jugador no puede apostar a un sorteo
        // cerrado.
        $resolvedDraws = AnimalitoSorteo::where('is_resolved', true)
            ->where('sorteo_at', '>=', now()->startOfDay())
            ->where('sorteo_at', '<=', now()->addDays(2)->endOfDay())
            ->get(['lottery_id', 'sorteo_at'])
            ->map(fn ($sorteo) => [
                'lottery_id' => $sorteo->lottery_id,
                'sorteo_at' => $sorteo->sorteo_at->toIso8601String(),
            ]);

        $lotteries = Lottery::where('is_active', true)
            ->with(['animals' => fn ($query) => $query->where('is_enabled', true)])
            ->orderBy('name')
            ->get()
            ->map(fn (Lottery $lottery) => [
                'id' => $lottery->id,
                'name' => $lottery->name,
                'payout_multiplier' => $lottery->payout_multiplier,
                'draw_times' => $lottery->draw_times ?? [],
                'animals' => $lottery->animals->map(fn (LotteryAnimal $animal) => [
                    'id' => $animal->id,
                    'number' => $animal->number,
                    'animal' => $animal->animal,
                ])->values(),
            ]);

        $races = Race::where('status', Race::STATUS_PENDING)
            ->with(['horses' => fn ($query) => $query->where('is_retired', false)->orderBy('number')])
            ->orderByRaw('race_date ASC NULLS LAST')
            ->get()
            ->map(fn (Race $race) => [
                'id' => $race->id,
                'name' => $race->name,
                'meeting' => $race->meeting,
                'track' => $race->track,
                'race_date' => $race->race_date,
                'is_valida' => (bool) $race->is_valida,
                'valida_number' => $race->valida_number,
                'ganador_price' => (float) ($race->ganador_price ?? 100.00),
                'horses' => $race->horses->map(fn ($horse) => [
                    'id' => $horse->id,
                    'number' => $horse->number,
                    'name' => $horse->name,
                    'jockey' => $horse->jockey,
                    'dividend' => $horse->dividend,
                ])->values(),
            ]);

        return response()->json([
            'data' => [
                'agency' => $agency ? [
                    'id' => $agency->id,
                    'name' => $agency->name,
                    'max_bet_amount' => $agency->max_bet_amount,
                    'max_ticket_payout' => $agency->max_ticket_payout,
                ] : null,
                'lotteries' => $lotteries,
                'races' => $races,
                'resolved_draws' => $resolvedDraws,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in([
                Ticket::STATUS_PENDING,
                Ticket::STATUS_PAID,
                Ticket::STATUS_CANCELLED,
            ])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $query = Ticket::with(['selections', 'agency', 'taquilla', 'horseRacingBet'])
            ->where('taquilla_id', auth('api')->id())
            ->latest();

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        if (! empty($data['search'])) {
            // LOWER + LIKE funciona igual en PostgreSQL y en SQLite.
            $query->whereRaw('LOWER(code) LIKE ?', ['%'.mb_strtolower($data['search']).'%']);
        }

        $tickets = $query->limit(200)->get();

        // Se liquidan los tickets de modalidades locales para que la tabla
        // muestre el resultado real (ganador o perdedor) y no solo
        // "pendiente". El parley se resuelve en el momento del cobro.
        $this->settlements->settleLocal($tickets);

        return response()->json([
            'data' => $tickets,
            'meta' => ['count' => $tickets->count()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $taquilla */
        $taquilla = auth('api')->user();

        if ($taquilla->agency_id === null || $taquilla->supervisor_id === null) {
            return response()->json([
                'message' => 'Tu usuario no está asignado a una agencia o supervisor.',
            ], 422);
        }

        $base = $request->validate([
            'type' => ['required', Rule::in([
                Ticket::TYPE_ANIMALITOS,
                Ticket::TYPE_HIPISMO,
                Ticket::TYPE_PARLEY,
            ])],
            // En animalitos el monto sale de la suma de los amounts por
            // animalito. En hipismo con selección múltiple de caballos ('horses'), el monto sale de la suma de los montos por caballo.
            'stake' => [
                Rule::requiredIf(fn () => $request->input('type') !== Ticket::TYPE_ANIMALITOS && ! $request->has('horses')),
                'nullable',
                'numeric',
                'min:0.01',
                'max:999999999.99',
            ],
        ], [
            'type.required' => 'Debe indicar el tipo de apuesta.',
            'type.in' => 'El tipo de apuesta no es válido.',
            'stake.required' => 'Debe indicar el monto de la apuesta.',
            'stake.required_if' => 'Debe indicar el monto de la apuesta.',
            'stake.numeric' => 'El monto de la apuesta debe ser un número.',
            'stake.min' => 'El monto de la apuesta debe ser mayor que cero.',
        ]);

        $agency = $taquilla->agency;

        // Topes vigentes: los de la taquilla si tiene los suyos, si no los de
        // su agencia.
        $topes = $taquilla->effectiveLimits();

        $prepared = match ($base['type']) {
            Ticket::TYPE_ANIMALITOS => $this->prepareAnimalitos($request),
            Ticket::TYPE_HIPISMO => $this->prepareHipismo($request, (float) ($base['stake'] ?? 0)),
            Ticket::TYPE_PARLEY => $this->prepareParley($request, (float) $base['stake']),
        };

        $stake = round((float) ($prepared['stake'] ?? $base['stake'] ?? 0), 2);

        if ($topes['max_bet_amount'] !== null && $stake > (float) $topes['max_bet_amount']) {
            return $this->limitError(
                'El monto máximo por apuesta de tu agencia es '.$this->money($topes['max_bet_amount']).'.'
            );
        }

        $potentialPayout = isset($prepared['potential_payout'])
            ? round((float) $prepared['potential_payout'], 2)
            : round($stake * $prepared['odds'], 2);

        if (
            $topes['max_ticket_payout'] !== null
            && $potentialPayout > (float) $topes['max_ticket_payout']
        ) {
            return $this->limitError(
                'La ganancia potencial ('.$this->money($potentialPayout).') supera el máximo por ticket de tu agencia ('
                .$this->money($topes['max_ticket_payout']).').'
            );
        }

        $ticket = DB::transaction(function () use ($taquilla, $base, $stake, $prepared, $potentialPayout) {
            $ticket = Ticket::create([
                'code' => $this->generateCode(),
                'agency_id' => $taquilla->agency_id,
                'supervisor_id' => $taquilla->supervisor_id,
                'taquilla_id' => $taquilla->id,
                'type' => $base['type'],
                'sorteo_at' => $prepared['sorteo_at'] ?? null,
                'stake' => $stake,
                'total_odds' => round($prepared['odds'], 4),
                'potential_payout' => $potentialPayout,
                'status' => Ticket::STATUS_PENDING,
            ]);

            $ticket->selections()->createMany($prepared['selections']);

            if (! empty($prepared['horse_racing_bet'])) {
                $ticket->horseRacingBet()->create($prepared['horse_racing_bet']);
            }

            return $ticket;
        });

        $this->movements->record(
            $ticket,
            TicketMovement::TYPE_CREATED,
            $taquilla,
            toStatus: Ticket::STATUS_PENDING,
            amount: $stake,
            metadata: [
                'type' => $base['type'],
                'total_odds' => round($prepared['odds'], 4),
                'potential_payout' => $potentialPayout,
            ],
        );

        return response()->json([
            'data' => $ticket->load(['selections', 'agency', 'taquilla', 'horseRacingBet']),
        ], 201);
    }

    /**
     * Vista previa de la liquidación: no cobra nada, solo dice si el ticket
     * se puede pagar, por cuánto y qué animalitos ganaron.
     */
    public function settlement(Ticket $ticket): JsonResponse
    {
        $this->ensureOwnedByTaquilla($ticket);

        $previousStatus = $ticket->settlement_status;
        $settlement = $this->settlements->settle($ticket);
        $this->recordSettlementChange($ticket, $previousStatus, $settlement);

        return response()->json([
            'data' => [
                'status' => $settlement['status'],
                'payable' => $settlement['payable'],
                'legs' => $settlement['legs'],
                'note' => $settlement['note'],
                'potential_payout' => (float) $ticket->potential_payout,
            ],
        ]);
    }

    public function pay(Request $request, Ticket $ticket): JsonResponse
    {
        $this->ensureOwnedByTaquilla($ticket);

        if ($ticket->status !== Ticket::STATUS_PENDING) {
            return response()->json([
                'message' => 'Solo se pueden pagar tickets pendientes.',
            ], 422);
        }

        $data = $request->validate([
            'paid_amount' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'paid_amount.required' => 'Debe indicar el monto pagado.',
            'paid_amount.numeric' => 'El monto pagado debe ser un número.',
            'paid_amount.min' => 'El monto pagado debe ser mayor que cero.',
        ]);

        // La liquidación contra el resultado oficial decide si se puede pagar.
        $previousStatus = $ticket->settlement_status;
        $settlement = $this->settlements->settle($ticket);
        $this->recordSettlementChange($ticket, $previousStatus, $settlement);

        if ($settlement['status'] !== Ticket::SETTLEMENT_WON) {
            return response()->json([
                'message' => $this->settlementMessage($settlement),
            ], 422);
        }

        if ((float) $data['paid_amount'] > (float) $settlement['payable']) {
            return response()->json([
                'message' => 'El monto pagado no puede superar el premio a pagar ('
                    .$this->money($settlement['payable']).').',
            ], 422);
        }

        $ticket->update([
            'status' => Ticket::STATUS_PAID,
            'paid_amount' => round((float) $data['paid_amount'], 2),
            'paid_at' => now(),
            'notes' => $data['notes'] ?? $ticket->notes,
        ]);

        $this->movements->record(
            $ticket,
            TicketMovement::TYPE_PAID,
            auth('api')->user(),
            fromStatus: Ticket::STATUS_PENDING,
            toStatus: Ticket::STATUS_PAID,
            amount: round((float) $data['paid_amount'], 2),
            notes: $data['notes'] ?? null,
        );

        return response()->json([
            'data' => $ticket->load(['selections', 'agency', 'taquilla']),
        ]);
    }

    public function cancel(Ticket $ticket): JsonResponse
    {
        $this->ensureOwnedByTaquilla($ticket);

        if ($ticket->status !== Ticket::STATUS_PENDING) {
            return response()->json([
                'message' => 'Solo se pueden anular tickets pendientes.',
            ], 422);
        }

        // No se puede anular un ticket después de 5 minutos de haberlo creado
        if ($ticket->created_at && $ticket->created_at->addMinutes(5)->isPast()) {
            return response()->json([
                'message' => 'No se puede anular el ticket. Han transcurrido más de 5 minutos desde su emisión.',
            ], 422);
        }

        $ticket->update([
            'status' => Ticket::STATUS_CANCELLED,
            'cancelled_at' => now(),
        ]);

        $this->movements->record(
            $ticket,
            TicketMovement::TYPE_CANCELLED,
            auth('api')->user(),
            fromStatus: Ticket::STATUS_PENDING,
            toStatus: Ticket::STATUS_CANCELLED,
            amount: (float) $ticket->stake,
        );

        return response()->json([
            'data' => $ticket->load(['selections', 'agency', 'taquilla']),
        ]);
    }

    /**
     * Registra el movimiento cuando la liquidación cambia de estado, para
     * no duplicar la entrada en cada intento de cobro.
     *
     * @param  array{status: string, note: string}  $settlement
     */
    private function recordSettlementChange(Ticket $ticket, string $previousStatus, array $settlement): void
    {
        if ($settlement['status'] === $previousStatus) {
            return;
        }

        $this->movements->record(
            $ticket,
            $this->movementTypeForSettlement($settlement['status']),
            auth('api')->user(),
            fromStatus: $previousStatus,
            toStatus: $settlement['status'],
            notes: $settlement['note'],
        );
    }

    /**
     * Mensaje al usuario según el estado de la liquidación.
     *
     * @param  array{status: string, note: string}  $settlement
     */
    private function settlementMessage(array $settlement): string
    {
        return match ($settlement['status']) {
            Ticket::SETTLEMENT_LOST => 'El ticket no es ganador. '.$settlement['note'],
            Ticket::SETTLEMENT_PENDING => 'Aún no hay resultados oficiales para el ticket. '.$settlement['note'],
            Ticket::SETTLEMENT_REVIEW => 'El ticket requiere validación del supervisor. '.$settlement['note'],
            default => $settlement['note'],
        };
    }

    private function movementTypeForSettlement(string $status): string
    {
        return match ($status) {
            Ticket::SETTLEMENT_WON => TicketMovement::TYPE_SETTLEMENT_WON,
            Ticket::SETTLEMENT_LOST => TicketMovement::TYPE_SETTLEMENT_LOST,
            default => TicketMovement::TYPE_REVIEW,
        };
    }

    /**
     * Prepara una apuesta de animalitos: varios animalitos, cada uno con su
     * monto, todos del mismo sorteo.
     *
     * El ticket declara a qué sorteo apuesta (`sorteo_at`): esa es la
     * referencia que usa luego la liquidación, de modo que nunca se valida
     * contra un sorteo distinto del elegido.
     */
    private function prepareAnimalitos(Request $request): array
    {
        $data = $request->validate([
            'lottery_id' => ['required', 'integer'],
            'sorteo_date' => ['required', 'date_format:Y-m-d'],
            'sorteo_time' => ['required', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'selections' => ['required', 'array', 'min:1', 'max:20'],
            'selections.*.lottery_animal_id' => ['required', 'integer', 'distinct'],
            'selections.*.amount' => ['required', 'numeric', 'min:0.01', 'max:999999999.99'],
        ], [
            'lottery_id.required' => 'Debe seleccionar una lotería.',
            'sorteo_date.required' => 'Debe seleccionar la fecha del sorteo.',
            'sorteo_date.date_format' => 'La fecha del sorteo debe tener el formato AAAA-MM-DD.',
            'sorteo_time.required' => 'Debe seleccionar la hora del sorteo.',
            'sorteo_time.regex' => 'La hora del sorteo debe tener el formato HH:MM.',
            'selections.required' => 'Debe seleccionar al menos un animalito.',
            'selections.min' => 'Debe seleccionar al menos un animalito.',
            'selections.max' => 'Un ticket no puede tener más de 20 animalitos.',
            'selections.*.lottery_animal_id.required' => 'Cada fila debe tener un animalito.',
            'selections.*.lottery_animal_id.distinct' => 'No puedes repetir el mismo animalito en un ticket.',
            'selections.*.amount.required' => 'Cada animalito debe tener un monto.',
            'selections.*.amount.numeric' => 'El monto debe ser un número.',
            'selections.*.amount.min' => 'El monto debe ser mayor que cero.',
        ]);

        $lottery = Lottery::find($data['lottery_id']);

        if (! $lottery || ! $lottery->is_active) {
            throw ValidationException::withMessages([
                'lottery_id' => 'La lotería seleccionada no está disponible.',
            ]);
        }

        // La hora elegida tiene que ser uno de los horarios de la lotería.
        $drawTimes = $lottery->draw_times ?? [];

        if ($drawTimes === []) {
            throw ValidationException::withMessages([
                'sorteo_time' => 'Esta lotería no tiene horarios de sorteo configurados. Contacta al administrador.',
            ]);
        }

        if (! in_array($data['sorteo_time'], $drawTimes, true)) {
            throw ValidationException::withMessages([
                'sorteo_time' => 'El horario seleccionado no corresponde a un sorteo de esta lotería.',
            ]);
        }

        $sorteoAt = Carbon::createFromFormat('Y-m-d H:i', $data['sorteo_date'].' '.$data['sorteo_time']);

        if ($sorteoAt->isPast()) {
            throw ValidationException::withMessages([
                'sorteo_date' => 'El sorteo seleccionado ya pasó. Elige un horario pendiente.',
            ]);
        }

        // No se puede apostar a un sorteo que ya tiene resultado oficial.
        $alreadyResolved = AnimalitoSorteo::where('lottery_id', $lottery->id)
            ->where('is_resolved', true)
            ->where('sorteo_at', $sorteoAt)
            ->exists();

        if ($alreadyResolved) {
            throw ValidationException::withMessages([
                'sorteo_time' => 'Ese sorteo ya tiene resultado oficial registrado.',
            ]);
        }

        $odds = (float) $lottery->payout_multiplier;

        if ($odds < 1) {
            throw ValidationException::withMessages([
                'lottery_id' => 'La lotería no tiene un multiplicador de pago válido.',
            ]);
        }

        $animals = $lottery->animals()
            ->whereIn('id', collect($data['selections'])->pluck('lottery_animal_id'))
            ->where('is_enabled', true)
            ->get()
            ->keyBy('id');

        $selections = [];
        $stake = 0.0;

        foreach ($data['selections'] as $item) {
            $animal = $animals->get((int) $item['lottery_animal_id']);

            if (! $animal) {
                throw ValidationException::withMessages([
                    'selections' => 'Uno de los animalitos seleccionados no está habilitado en esta lotería.',
                ]);
            }

            $amount = round((float) $item['amount'], 2);
            $stake += $amount;

            $selections[] = [
                'lottery_id' => $lottery->id,
                'lottery_animal_id' => $animal->id,
                'selection_label' => 'N° '.$animal->number.' - '.$animal->animal,
                'odd' => $odds,
                'amount' => $amount,
                'metadata' => [
                    'lottery' => $lottery->name,
                    'number' => $animal->number,
                    'animal' => $animal->animal,
                    'multiplier' => $odds,
                    'sorteo_at' => $sorteoAt->toIso8601String(),
                ],
            ];
        }

        return [
            'odds' => $odds,
            'stake' => round($stake, 2),
            'sorteo_at' => $sorteoAt,
            'selections' => $selections,
        ];
    }

    private function prepareHipismo(Request $request, float $stake): array
    {
        $betType = $request->input('bet_type', HorseRacingBet::TYPE_GANADOR);

        if (! in_array($betType, HorseRacingBet::BET_TYPES, true)) {
            throw ValidationException::withMessages([
                'bet_type' => 'El tipo de jugada hípica no es válido.',
            ]);
        }

        if ($betType === HorseRacingBet::TYPE_CINCO_Y_SEIS) {
            return $this->prepareCincoYSeis($request, $stake);
        }

        return $this->prepareSimpleHipismo($request, $stake, $betType);
    }

    /**
     * Valida y prepara la jugada compleja del Cuadro del 5 y 6.
     * Exige al menos una marca por cada carrera válida programada en la reunión
     * antes de emitir y guardar el ticket.
     */
    private function prepareCincoYSeis(Request $request, float $stake): array
    {
        $meeting = $request->input('meeting');

        // Si la reunión no fue enviada explícitamente, intentar inferirla de las carreras seleccionadas
        if (empty($meeting) && $request->has('selections') && is_array($request->input('selections'))) {
            $raw = $request->input('selections');
            $sampleRaceId = null;
            if (array_keys($raw) !== range(0, count($raw) - 1)) {
                $sampleRaceId = (int) array_key_first($raw);
            } elseif (isset($raw[0]['race_id'])) {
                $sampleRaceId = (int) $raw[0]['race_id'];
            }

            if ($sampleRaceId) {
                $meeting = Race::where('id', $sampleRaceId)->value('meeting');
            }
        }

        if (empty($meeting)) {
            throw ValidationException::withMessages([
                'meeting' => 'Debe indicar la reunión programada para el Cuadro del 5 y 6.',
            ]);
        }

        // Obtener las carreras válidas programadas para la reunión
        $validRaces = Race::with(['horses' => fn ($query) => $query->orderBy('number')])
            ->where('meeting', $meeting)
            ->where(function ($query) {
                $query->where('is_valida', true)
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%válida%'])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%valida%']);
            })
            ->orderBy('valida_number')
            ->orderBy('id')
            ->get();

        // Si no hay carreras marcadas explícitamente como válidas, tomar las carreras de la reunión
        if ($validRaces->isEmpty()) {
            $validRaces = Race::with(['horses' => fn ($query) => $query->orderBy('number')])
                ->where('meeting', $meeting)
                ->orderBy('id')
                ->get();
        }

        if ($validRaces->isEmpty()) {
            throw ValidationException::withMessages([
                'meeting' => "No hay carreras válidas programadas para la reunión \"{$meeting}\".",
            ]);
        }

        // Ninguna de las carreras válidas programadas puede estar ya finalizada
        $finished = $validRaces->firstWhere('status', Race::STATUS_FINISHED);
        if ($finished) {
            throw ValidationException::withMessages([
                'selections' => "No se pueden emitir jugadas del 5 y 6 porque la carrera \"{$finished->name}\" ya finalizó.",
            ]);
        }

        $rawSelections = $request->input('selections');
        if (empty($rawSelections)) {
            throw ValidationException::withMessages([
                'selections' => 'Debe incluir las marcas o combinaciones de ejemplares para el 5 y 6.',
            ]);
        }

        $marksByRaceId = $this->parseCincoYSeisSelections($rawSelections, $validRaces);

        // Validación estricta: Se exige al menos una marca por cada carrera válida programada
        $missingRaces = [];
        foreach ($validRaces as $index => $race) {
            $marks = $marksByRaceId[$race->id] ?? [];
            if (empty($marks)) {
                $label = $race->valida_number
                    ? "{$race->valida_number}ª Válida ({$race->name})"
                    : ($race->name ?? 'Válida '.($index + 1));
                $missingRaces[] = $label;
            }
        }

        if (! empty($missingRaces)) {
            throw ValidationException::withMessages([
                'selections' => 'El Cuadro del 5 y 6 requiere al menos una marca por cada carrera válida programada. Faltan marcas en: '.implode(', ', $missingRaces).'.',
            ]);
        }

        // Validar ejemplares seleccionados y calcular total de combinaciones (cuadros)
        $combinations = 1;
        $jsonSelections = [];
        $ticketSelections = [];

        foreach ($validRaces as $index => $race) {
            $selectedHorseIds = $marksByRaceId[$race->id];
            $validaNumber = $race->valida_number ?? ($index + 1);
            $combinations *= count($selectedHorseIds);

            $horsesInRace = $race->horses->keyBy('id');
            $raceHorses = [];

            foreach ($selectedHorseIds as $horseId) {
                $horse = $horsesInRace->get($horseId);

                if (! $horse) {
                    throw ValidationException::withMessages([
                        'selections' => "El ejemplar con ID {$horseId} no pertenece a la carrera \"{$race->name}\".",
                    ]);
                }

                if ($horse->is_retired) {
                    throw ValidationException::withMessages([
                        'selections' => "El ejemplar N° {$horse->number} ({$horse->name}) en \"{$race->name}\" ha sido retirado y no admite apuestas.",
                    ]);
                }

                $raceHorses[] = [
                    'id' => $horse->id,
                    'number' => $horse->number,
                    'name' => $horse->name,
                    'jockey' => $horse->jockey,
                ];

                $ticketSelections[] = [
                    'race_id' => $race->id,
                    'horse_id' => $horse->id,
                    'selection_label' => "Válida {$validaNumber}: N° {$horse->number} - {$horse->name}".($horse->jockey ? " (J: {$horse->jockey})" : ''),
                    'odd' => 1.0,
                    'amount' => round($stake / max(1, $combinations), 2),
                    'metadata' => [
                        'bet_type' => HorseRacingBet::TYPE_CINCO_Y_SEIS,
                        'meeting' => $meeting,
                        'race' => $race->name,
                        'valida' => $validaNumber,
                        'horse_number' => $horse->number,
                        'horse' => $horse->name,
                        'jockey' => $horse->jockey,
                    ],
                ];
            }

            $jsonSelections[] = [
                'race_id' => $race->id,
                'valida_number' => $validaNumber,
                'race_name' => $race->name,
                'horses' => $raceHorses,
            ];
        }

        return [
            'odds' => 1.0,
            'stake' => round($stake, 2),
            'selections' => $ticketSelections,
            'horse_racing_bet' => [
                'bet_type' => HorseRacingBet::TYPE_CINCO_Y_SEIS,
                'meeting' => $meeting,
                'race_id' => null,
                'selections' => $jsonSelections,
                'combinations_count' => $combinations,
            ],
        ];
    }

    /**
     * Normaliza los formatos de marcas del cajero a un mapa [race_id => [horse_id, ...]].
     */
    private function parseCincoYSeisSelections(mixed $rawSelections, Collection $validRaces): array
    {
        $marks = [];

        if (! is_array($rawSelections)) {
            return [];
        }

        $isAssoc = array_keys($rawSelections) !== range(0, count($rawSelections) - 1);

        if ($isAssoc) {
            foreach ($rawSelections as $rId => $hIds) {
                $rIdInt = (int) $rId;
                $hList = is_array($hIds) ? $hIds : [$hIds];
                $marks[$rIdInt] = array_values(array_unique(array_filter(array_map('intval', $hList))));
            }

            return $marks;
        }

        foreach ($rawSelections as $item) {
            if (! is_array($item)) {
                continue;
            }

            $targetRaceId = null;

            if (isset($item['race_id'])) {
                $targetRaceId = (int) $item['race_id'];
            } elseif (isset($item['valida'])) {
                $validaIdx = (int) $item['valida'];
                $matched = $validRaces->firstWhere('valida_number', $validaIdx) ?? $validRaces->values()->get($validaIdx - 1);
                if ($matched) {
                    $targetRaceId = $matched->id;
                }
            }

            if (! $targetRaceId) {
                continue;
            }

            $horseIds = [];
            if (isset($item['horse_ids']) && is_array($item['horse_ids'])) {
                $horseIds = $item['horse_ids'];
            } elseif (isset($item['horses']) && is_array($item['horses'])) {
                $horseIds = array_map(fn ($h) => is_array($h) ? ($h['id'] ?? $h['horse_id']) : $h, $item['horses']);
            } elseif (isset($item['horse_id'])) {
                $horseIds = [$item['horse_id']];
            }

            foreach ($horseIds as $hId) {
                if ($hId) {
                    $marks[$targetRaceId][] = (int) $hId;
                }
            }
        }

        foreach ($marks as $rId => $list) {
            $marks[$rId] = array_values(array_unique($list));
        }

        return $marks;
    }

    /**
     * Prepara jugadas hípicas individuales (ganador, place, etc.).
     * Permite seleccionar múltiples caballos en una sola carrera, cada uno con su propio monto.
     */
    private function prepareSimpleHipismo(Request $request, float $stake, string $betType): array
    {
        if ($request->has('horses') && is_array($request->input('horses'))) {
            $data = $request->validate([
                'race_id' => ['required', 'integer'],
                'horses' => ['required', 'array', 'min:1'],
                'horses.*.horse_id' => ['required', 'integer'],
                'horses.*.amount' => ['nullable', 'numeric', 'min:0.01', 'max:999999999.99'],
                'horses.*.ganadores' => ['nullable', 'numeric', 'min:0.01', 'max:999999999.99'],
            ], [
                'race_id.required' => 'Debe seleccionar una carrera.',
                'horses.required' => 'Debe seleccionar al menos un ejemplar.',
                'horses.min' => 'Debe seleccionar al menos un ejemplar.',
                'horses.*.horse_id.required' => 'Cada selección debe especificar el ejemplar.',
            ]);

            $race = Race::with(['horses' => fn ($query) => $query->orderBy('number')])
                ->find($data['race_id']);

            if (! $race || $race->status !== Race::STATUS_PENDING) {
                throw ValidationException::withMessages([
                    'race_id' => 'La carrera seleccionada no está disponible para apuestas.',
                ]);
            }

            $ganadorPrice = (float) ($race->ganador_price ?? 100.00);
            if ($ganadorPrice <= 0) {
                $ganadorPrice = 100.00;
            }

            // Evitar duplicados del mismo ejemplar en el ticket
            $horseIds = array_column($data['horses'], 'horse_id');
            if (count($horseIds) !== count(array_unique($horseIds))) {
                throw ValidationException::withMessages([
                    'horses' => 'No puedes repetir el mismo ejemplar en el mismo ticket.',
                ]);
            }

            $selections = [];
            $selectedHorsesMeta = [];
            $totalStake = 0.0;
            $maxPotentialPayout = 0.0;
            $maxOdds = 1.0;

            foreach ($data['horses'] as $item) {
                $horseId = (int) $item['horse_id'];
                $ganadores = isset($item['ganadores']) && (float) $item['ganadores'] > 0
                    ? (float) $item['ganadores']
                    : null;

                if ($ganadores !== null) {
                    $horseAmount = round($ganadores * $ganadorPrice, 2);
                } else {
                    $horseAmount = round((float) ($item['amount'] ?? 0), 2);
                    if ($horseAmount <= 0) {
                        throw ValidationException::withMessages([
                            'horses' => 'Debe especificar la cantidad de ganadores o el monto jugado para cada ejemplar.',
                        ]);
                    }
                }

                $horse = $race->horses->firstWhere('id', $horseId);

                if (! $horse) {
                    throw ValidationException::withMessages([
                        'horses' => 'Uno de los ejemplares seleccionados no pertenece a la carrera.',
                    ]);
                }

                if ($horse->is_retired) {
                    throw ValidationException::withMessages([
                        'horses' => 'El ejemplar N° '.$horse->number.' ('.$horse->name.') ha sido retirado de la carrera y no admite apuestas.',
                    ]);
                }

                $odds = (float) $horse->dividend;
                if ($odds <= 0) {
                    $odds = 1.0;
                }

                if ($odds > $maxOdds) {
                    $maxOdds = $odds;
                }

                // El premio es la cantidad de ganadores por el dividendo del caballo ganador
                $potentialForHorse = $ganadores !== null
                    ? round($ganadores * $odds, 2)
                    : round($horseAmount * $odds, 2);

                if ($potentialForHorse > $maxPotentialPayout) {
                    $maxPotentialPayout = $potentialForHorse;
                }

                $totalStake += $horseAmount;

                $selectionMeta = [
                    'bet_type' => $betType,
                    'meeting' => $race->meeting,
                    'race' => $race->name,
                    'track' => $race->track,
                    'race_date' => $race->race_date,
                    'horse_number' => $horse->number,
                    'horse' => $horse->name,
                    'jockey' => $horse->jockey,
                    'dividend' => $odds,
                    'ganador_price' => $ganadorPrice,
                ];
                if ($ganadores !== null) {
                    $selectionMeta['ganadores'] = $ganadores;
                }

                $selections[] = [
                    'race_id' => $race->id,
                    'horse_id' => $horse->id,
                    'selection_label' => 'N° '.$horse->number.' - '.$horse->name.($horse->jockey ? ' (J: '.$horse->jockey.')' : ''),
                    'odd' => $odds,
                    'amount' => $horseAmount,
                    'metadata' => $selectionMeta,
                ];

                $selectedHorsesMeta[] = [
                    'id' => $horse->id,
                    'number' => $horse->number,
                    'name' => $horse->name,
                    'jockey' => $horse->jockey,
                    'dividend' => $odds,
                    'amount' => $horseAmount,
                    'ganadores' => $ganadores,
                    'ganador_price' => $ganadorPrice,
                ];
            }

            return [
                'odds' => $maxOdds,
                'stake' => round($totalStake, 2),
                'potential_payout' => $maxPotentialPayout,
                'selections' => $selections,
                'horse_racing_bet' => [
                    'bet_type' => $betType,
                    'meeting' => $race->meeting,
                    'race_id' => $race->id,
                    'selections' => [
                        [
                            'race_id' => $race->id,
                            'race_name' => $race->name,
                            'horses' => $selectedHorsesMeta,
                        ],
                    ],
                    'combinations_count' => count($selections),
                ],
            ];
        }

        $data = $request->validate([
            'race_id' => ['required', 'integer'],
            'horse_id' => ['required', 'integer'],
            'ganadores' => ['nullable', 'numeric', 'min:0.01', 'max:999999999.99'],
        ], [
            'race_id.required' => 'Debe seleccionar una carrera.',
            'horse_id.required' => 'Debe seleccionar un caballo.',
        ]);

        $race = Race::with(['horses' => fn ($query) => $query->orderBy('number')])
            ->find($data['race_id']);

        if (! $race || $race->status !== Race::STATUS_PENDING) {
            throw ValidationException::withMessages([
                'race_id' => 'La carrera seleccionada no está disponible para apuestas.',
            ]);
        }

        $ganadorPrice = (float) ($race->ganador_price ?? 100.00);
        if ($ganadorPrice <= 0) {
            $ganadorPrice = 100.00;
        }

        $horse = $race->horses->firstWhere('id', (int) $data['horse_id']);

        if (! $horse) {
            throw ValidationException::withMessages([
                'horse_id' => 'El caballo seleccionado no pertenece a la carrera.',
            ]);
        }

        if ($horse->is_retired) {
            throw ValidationException::withMessages([
                'horse_id' => 'El ejemplar N° '.$horse->number.' ('.$horse->name.') ha sido retirado de la carrera y no admite apuestas.',
            ]);
        }

        $odds = (float) $horse->dividend;

        // Si el caballo aún no tiene dividendo oficial (se registra cuando se marca al ganador), se asigna 1.0 de referencia
        if ($odds <= 0) {
            $odds = 1.0;
        }

        $ganadores = isset($data['ganadores']) && (float) $data['ganadores'] > 0
            ? (float) $data['ganadores']
            : null;

        if ($ganadores !== null) {
            $finalStake = round($ganadores * $ganadorPrice, 2);
            $potentialPayout = round($ganadores * $odds, 2);
        } else {
            $finalStake = round($stake, 2);
            $potentialPayout = round($stake * $odds, 2);
        }

        $selectionMeta = [
            'bet_type' => $betType,
            'meeting' => $race->meeting,
            'race' => $race->name,
            'track' => $race->track,
            'race_date' => $race->race_date,
            'horse_number' => $horse->number,
            'horse' => $horse->name,
            'jockey' => $horse->jockey,
            'dividend' => $odds,
            'ganador_price' => $ganadorPrice,
        ];
        if ($ganadores !== null) {
            $selectionMeta['ganadores'] = $ganadores;
        }

        return [
            'odds' => $odds,
            'stake' => $finalStake,
            'potential_payout' => $potentialPayout,
            'selections' => [[
                'race_id' => $race->id,
                'horse_id' => $horse->id,
                'selection_label' => 'N° '.$horse->number.' - '.$horse->name.($horse->jockey ? ' (J: '.$horse->jockey.')' : ''),
                'odd' => $odds,
                'amount' => $finalStake,
                'metadata' => $selectionMeta,
            ]],
            'horse_racing_bet' => [
                'bet_type' => $betType,
                'meeting' => $race->meeting,
                'race_id' => $race->id,
                'selections' => [
                    [
                        'race_id' => $race->id,
                        'race_name' => $race->name,
                        'horses' => [
                            [
                                'id' => $horse->id,
                                'number' => $horse->number,
                                'name' => $horse->name,
                                'jockey' => $horse->jockey,
                                'dividend' => $odds,
                                'amount' => $finalStake,
                                'ganadores' => $ganadores,
                                'ganador_price' => $ganadorPrice,
                            ],
                        ],
                    ],
                ],
                'combinations_count' => 1,
            ],
        ];
    }

    private function prepareParley(Request $request, float $stake): array
    {
        $data = $request->validate([
            'selections' => ['required', 'array', 'min:2', 'max:20'],
            'selections.*.sport' => ['required', 'string', Rule::in(array_keys(config('sports.sports')))],
            'selections.*.event_id' => ['required', 'string', 'distinct'],
            'selections.*.event_name' => ['required', 'string', 'max:255'],
            'selections.*.market' => ['required', 'string', 'max:255'],
            'selections.*.market_id' => ['nullable', 'integer', 'min:1'],
            'selections.*.selection' => ['required', 'string', 'max:255'],
            'selections.*.odd' => ['required', 'numeric', 'min:1.01', 'max:1000'],
            'selections.*.league' => ['nullable', 'string', 'max:255'],
            'selections.*.home' => ['nullable', 'string', 'max:255'],
            'selections.*.away' => ['nullable', 'string', 'max:255'],
            'selections.*.team' => ['nullable', 'string', 'max:255'],
            'selections.*.starts_at' => ['nullable', 'string', 'max:100'],
        ], [
            'selections.required' => 'Debe agregar al menos dos selecciones para el parley.',
            'selections.min' => 'Un parley debe tener al menos dos selecciones.',
            'selections.max' => 'Un parley no puede tener más de 20 selecciones.',
            'selections.*.event_id.distinct' => 'No puedes repetir el mismo evento en un parley.',
            'selections.*.odd.min' => 'Las cuotas deben ser mayores que 1.00.',
        ]);

        $combinedOdds = 1.0;
        $selections = [];

        foreach ($data['selections'] as $selection) {
            $odd = (float) $selection['odd'];
            $combinedOdds *= $odd;

            $home = $selection['home'] ?? null;
            $away = $selection['away'] ?? null;
            $label = $selection['selection'];
            $team = $selection['team'] ?? null;

            if (empty($team)) {
                $lowerLabel = mb_strtolower(trim($label));
                $lowerHome = $home ? mb_strtolower(trim($home)) : '';
                $lowerAway = $away ? mb_strtolower(trim($away)) : '';

                if (in_array($lowerLabel, ['1', 'home', 'local', 'h'])) {
                    $team = $home ?? 'Local';
                } elseif (in_array($lowerLabel, ['2', 'away', 'visitante', 'a'])) {
                    $team = $away ?? 'Visitante';
                } elseif (in_array($lowerLabel, ['x', 'draw', 'empate'])) {
                    $team = 'Empate';
                } elseif ($lowerHome && (str_contains($lowerLabel, $lowerHome) || str_contains($lowerHome, $lowerLabel))) {
                    $team = $home;
                } elseif ($lowerAway && (str_contains($lowerLabel, $lowerAway) || str_contains($lowerAway, $lowerLabel))) {
                    $team = $away;
                } else {
                    $team = $label;
                }
            }

            $selections[] = [
                'sport' => $selection['sport'],
                'external_event_id' => (string) $selection['event_id'],
                'event_name' => $selection['event_name'],
                'market' => $selection['market'],
                'market_id' => isset($selection['market_id']) ? (int) $selection['market_id'] : null,
                'selection_label' => $selection['selection'],
                'odd' => $odd,
                'amount' => round($stake, 2),
                'metadata' => [
                    'league' => $selection['league'] ?? null,
                    'home' => $home,
                    'away' => $away,
                    'team' => $team,
                    'starts_at' => $selection['starts_at'] ?? null,
                ],
            ];
        }

        return [
            'odds' => $combinedOdds,
            'selections' => $selections,
        ];
    }

    private function ensureOwnedByTaquilla(Ticket $ticket): void
    {
        abort_unless($ticket->taquilla_id === auth('api')->id(), 404);
    }

    private function generateCode(): string
    {
        do {
            // Código estrictamente numérico de máximo 8 números (10000000 - 99999999)
            $code = (string) random_int(10000000, 99999999);
        } while (Ticket::where('code', $code)->exists());

        return $code;
    }

    private function limitError(string $message): JsonResponse
    {
        return response()->json(['message' => $message], 422);
    }

    private function money(mixed $value): string
    {
        return number_format((float) $value, 2, ',', '.');
    }
}
