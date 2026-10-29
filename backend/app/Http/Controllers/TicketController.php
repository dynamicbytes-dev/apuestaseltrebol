<?php

namespace App\Http\Controllers;

use App\Models\AnimalitoSorteo;
use App\Models\Lottery;
use App\Models\LotteryAnimal;
use App\Models\Race;
use App\Models\Ticket;
use App\Models\TicketSelection;
use App\Models\User;
use App\Services\SportsSettlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TicketController extends Controller
{
    public function __construct(private readonly SportsSettlementService $settlement)
    {
    }

    public function catalog(): JsonResponse
    {
        /** @var User $taquilla */
        $taquilla = auth('api')->user();
        $agency = $taquilla->agency;

        $lotteries = Lottery::where('is_active', true)
            ->with(['animals' => fn ($query) => $query->where('is_enabled', true)])
            ->orderBy('name')
            ->get()
            ->map(fn (Lottery $lottery) => [
                'id' => $lottery->id,
                'name' => $lottery->name,
                'payout_multiplier' => $lottery->payout_multiplier,
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
                'horses' => $race->horses->map(fn ($horse) => [
                    'id' => $horse->id,
                    'number' => $horse->number,
                    'name' => $horse->name,
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

        $query = Ticket::with(['selections', 'agency', 'taquilla'])
            ->where('taquilla_id', auth('api')->id())
            ->latest();

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        if (! empty($data['search'])) {
            $query->where('code', 'ilike', '%'.$data['search'].'%');
        }

        $tickets = $query->limit(200)->get();

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
            'stake' => ['required', 'numeric', 'min:0.01', 'max:999999999.99'],
        ], [
            'type.required' => 'Debe indicar el tipo de apuesta.',
            'type.in' => 'El tipo de apuesta no es válido.',
            'stake.required' => 'Debe indicar el monto de la apuesta.',
            'stake.numeric' => 'El monto de la apuesta debe ser un número.',
            'stake.min' => 'El monto de la apuesta debe ser mayor que cero.',
        ]);

        $stake = round((float) $base['stake'], 2);
        $agency = $taquilla->agency;

        if ($agency?->max_bet_amount !== null && $stake > (float) $agency->max_bet_amount) {
            return $this->limitError(
                'El monto máximo por apuesta de tu agencia es '.$this->money($agency->max_bet_amount).'.'
            );
        }

        $prepared = match ($base['type']) {
            Ticket::TYPE_ANIMALITOS => $this->prepareAnimalitos($request),
            Ticket::TYPE_HIPISMO => $this->prepareHipismo($request),
            Ticket::TYPE_PARLEY => $this->prepareParley($request),
        };

        $potentialPayout = round($stake * $prepared['odds'], 2);

        if (
            $agency?->max_ticket_payout !== null
            && $potentialPayout > (float) $agency->max_ticket_payout
        ) {
            return $this->limitError(
                'La ganancia potencial ('.$this->money($potentialPayout).') supera el máximo por ticket de tu agencia ('
                .$this->money($agency->max_ticket_payout).').'
            );
        }

        $ticket = DB::transaction(function () use ($taquilla, $base, $stake, $prepared, $potentialPayout) {
            $ticket = Ticket::create([
                'code' => $this->generateCode(),
                'agency_id' => $taquilla->agency_id,
                'supervisor_id' => $taquilla->supervisor_id,
                'taquilla_id' => $taquilla->id,
                'type' => $base['type'],
                'stake' => $stake,
                'total_odds' => round($prepared['odds'], 4),
                'potential_payout' => $potentialPayout,
                'status' => Ticket::STATUS_PENDING,
            ]);

            $ticket->selections()->createMany($prepared['selections']);

            return $ticket;
        });

        return response()->json([
            'data' => $ticket->load(['selections', 'agency', 'taquilla']),
        ], 201);
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

        if ((float) $data['paid_amount'] > (float) $ticket->potential_payout) {
            return response()->json([
                'message' => 'El monto pagado no puede superar la ganancia potencial del ticket ('
                    .$this->money($ticket->potential_payout).').',
            ], 422);
        }

        // Validación automática de ganadores oficiales en Hipismo
        if ($ticket->type === Ticket::TYPE_HIPISMO) {
            foreach ($ticket->selections as $selection) {
                if ($selection->race_id) {
                    $race = Race::with('winner')->find($selection->race_id);

                    if (! $race || $race->status !== Race::STATUS_FINISHED) {
                        return response()->json([
                            'message' => 'La carrera "'.($race?->name ?? 'Hipismo').'" aún no tiene resultados oficiales registrados.',
                        ], 422);
                    }

                    if ((int) $race->winner_horse_id !== (int) $selection->horse_id) {
                        $winnerName = $race->winner ? "N° {$race->winner->number} - {$race->winner->name}" : 'No asignado';
                        return response()->json([
                            'message' => "El ticket no es ganador. En la carrera \"{$race->name}\", el ejemplar ganador oficial fue {$winnerName}.",
                        ], 422);
                    }
                }
            }
        }

        // Validación automática de ganadores oficiales en Parley
        if ($ticket->type === Ticket::TYPE_PARLEY) {
            $settlement = $this->settleParley($ticket);

            if ($settlement['status'] === Ticket::SETTLEMENT_LOST) {
                return response()->json([
                    'message' => 'El ticket no es ganador. '.$settlement['note'],
                ], 422);
            }

            if ($settlement['status'] === Ticket::SETTLEMENT_PENDING) {
                return response()->json([
                    'message' => 'Aún no hay resultados oficiales para alguna de las jugadas del ticket. '.$settlement['note'],
                ], 422);
            }

            if ($settlement['status'] === Ticket::SETTLEMENT_REVIEW) {
                return response()->json([
                    'message' => 'El ticket requiere validación del supervisor. '.$settlement['note'],
                ], 422);
            }
        }

        // Validación de ganadores oficiales en Animalitos
        if ($ticket->type === Ticket::TYPE_ANIMALITOS) {
            foreach ($ticket->selections as $selection) {
                if ($selection->lottery_id) {
                    $lottery = Lottery::find($selection->lottery_id);

                    // El sorteo aplicable es el primero ya resuelto posterior a
                    // la emisión del ticket: es el sorteo en el que realmente
                    // participó el cliente. Los sorteos sin resolver se
                    // descartan y los anteriores no sirven.
                    $sorteo = AnimalitoSorteo::where('lottery_id', $selection->lottery_id)
                        ->where('is_resolved', true)
                        ->where('sorteo_at', '>=', $ticket->created_at)
                        ->orderBy('sorteo_at')
                        ->first();

                    if (! $sorteo) {
                        return response()->json([
                            'message' => 'La lotería "'.($lottery?->name ?? 'Animalitos').'" aún no tiene resultados oficiales registrados por la administración para el sorteo posterior a la emisión del ticket.',
                        ], 422);
                    }

                    $selectedAnimal = $selection->lotteryAnimal;
                    $selectedNumber = (string) ($selectedAnimal?->number
                        ?? $selection->metadata['number']
                        ?? '');

                    if ((string) $sorteo->number !== $selectedNumber) {
                        return response()->json([
                            'message' => "El ticket no es ganador. En el sorteo oficial de {$lottery->name} resultó ganador el N° {$sorteo->number} - {$sorteo->animal}.",
                        ], 422);
                    }
                }
            }
        }

        $ticket->update([
            'status' => Ticket::STATUS_PAID,
            'paid_amount' => round((float) $data['paid_amount'], 2),
            'paid_at' => now(),
            'notes' => $data['notes'] ?? $ticket->notes,
        ]);

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

        return response()->json([
            'data' => $ticket->load(['selections', 'agency', 'taquilla']),
        ]);
    }

    /**
     * Liquida un ticket de parley contra el resultado oficial.
     *
     * Una decisión manual del supervisor tiene prioridad: el motor automático
     * no debe sobrescribir un caso que ya fue revisado a mano.
     *
     * @return array{status: string, note: string|null, legs: array<int, array<string, mixed>>}
     */
    private function settleParley(Ticket $ticket): array
    {
        if ($ticket->settlement_source === 'manual') {
            return [
                'status' => $ticket->settlement_status,
                'note' => $ticket->settlement_note,
                'legs' => [],
            ];
        }

        $settlement = $this->settlement->settle($ticket->loadMissing('selections'));

        foreach ($settlement['legs'] as $leg) {
            $leg['selection']->update([
                'settlement_status' => $leg['status'],
                'settlement_note' => $leg['note'],
                'settled_at' => in_array($leg['status'], [
                    TicketSelection::SETTLEMENT_WON,
                    TicketSelection::SETTLEMENT_LOST,
                ], true) ? now() : null,
            ]);
        }

        $ticket->update([
            'settlement_status' => $settlement['status'],
            'settlement_note' => $settlement['note'],
            'settlement_source' => 'auto',
        ]);

        return $settlement;
    }

    private function prepareAnimalitos(Request $request): array    {
        $data = $request->validate([
            'lottery_id' => ['required', 'integer'],
            'lottery_animal_id' => ['required', 'integer'],
        ], [
            'lottery_id.required' => 'Debe seleccionar una lotería.',
            'lottery_animal_id.required' => 'Debe seleccionar un número.',
        ]);

        $lottery = Lottery::find($data['lottery_id']);

        if (! $lottery || ! $lottery->is_active) {
            throw ValidationException::withMessages([
                'lottery_id' => 'La lotería seleccionada no está disponible.',
            ]);
        }

        $animal = LotteryAnimal::where('lottery_id', $lottery->id)
            ->where('is_enabled', true)
            ->find($data['lottery_animal_id']);

        if (! $animal) {
            throw ValidationException::withMessages([
                'lottery_animal_id' => 'El número seleccionado no está habilitado.',
            ]);
        }

        $odds = (float) $lottery->payout_multiplier;

        if ($odds < 1) {
            throw ValidationException::withMessages([
                'lottery_id' => 'La lotería no tiene un multiplicador de pago válido.',
            ]);
        }

        return [
            'odds' => $odds,
            'selections' => [[
                'lottery_id' => $lottery->id,
                'lottery_animal_id' => $animal->id,
                'selection_label' => 'N° '.$animal->number.' - '.$animal->animal,
                'odd' => $odds,
                'metadata' => [
                    'lottery' => $lottery->name,
                    'number' => $animal->number,
                    'animal' => $animal->animal,
                    'multiplier' => $odds,
                ],
            ]],
        ];
    }

    private function prepareHipismo(Request $request): array
    {
        $data = $request->validate([
            'race_id' => ['required', 'integer'],
            'horse_id' => ['required', 'integer'],
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

        if ($odds <= 0) {
            throw ValidationException::withMessages([
                'horse_id' => 'El caballo no tiene un dividendo configurado.',
            ]);
        }

        return [
            'odds' => $odds,
            'selections' => [[
                'race_id' => $race->id,
                'horse_id' => $horse->id,
                'selection_label' => 'N° '.$horse->number.' - '.$horse->name,
                'odd' => $odds,
                'metadata' => [
                    'meeting' => $race->meeting,
                    'race' => $race->name,
                    'track' => $race->track,
                    'race_date' => $race->race_date,
                    'horse_number' => $horse->number,
                    'horse' => $horse->name,
                    'dividend' => $odds,
                ],
            ]],
        ];
    }

    private function prepareParley(Request $request): array
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
