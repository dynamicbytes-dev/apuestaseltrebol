<?php

namespace App\Http\Controllers;

use App\Models\Horse;
use App\Models\Race;
use App\Models\Ticket;
use App\Models\TicketSelection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RaceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Race::withCount('horses')
            ->with(['horses' => fn ($q) => $q->orderBy('number'), 'winner', 'second', 'third']);

        if ($request->filled('meeting')) {
            $query->where('meeting', $request->query('meeting'));
        }

        if ($request->filled('track')) {
            $query->where('track', $request->query('track'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $races = $query->orderByDesc('id')->get();

        return response()->json(['data' => $races]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateRace($request);

        $race = DB::transaction(function () use ($data, $request) {
            $race = Race::create([
                'name' => $data['name'],
                'meeting' => $data['meeting'] ?? null,
                'track' => $data['track'] ?? null,
                'race_date' => $data['race_date'] ?? null,
                'status' => Race::STATUS_PENDING,
                'is_valida' => $data['is_valida'] ?? false,
                'valida_number' => $data['valida_number'] ?? null,
            ]);

            if ($request->has('horses') && is_array($request->input('horses'))) {
                $horsesData = $request->validate([
                    'horses.*.number' => ['required', 'integer', 'min:1', 'max:99', 'distinct'],
                    'horses.*.name' => ['required', 'string', 'max:255'],
                    'horses.*.jockey' => ['nullable', 'string', 'max:255'],
                    'horses.*.dividend' => ['nullable', 'numeric', 'min:0'],
                ]);

                foreach ($horsesData['horses'] as $item) {
                    $race->horses()->create([
                        'number' => (int) $item['number'],
                        'name' => trim($item['name']),
                        'jockey' => isset($item['jockey']) && trim($item['jockey']) !== '' ? trim($item['jockey']) : null,
                        'dividend' => isset($item['dividend']) && $item['dividend'] !== null ? round((float) $item['dividend'], 2) : 0.00,
                        'is_retired' => false,
                    ]);
                }
            }

            return $race;
        });

        return response()->json([
            'data' => $race->load(['horses', 'winner', 'second', 'third']),
        ], 201);
    }

    public function show(Race $race): JsonResponse
    {
        return response()->json([
            'data' => $race->load(['horses', 'winner', 'second', 'third']),
        ]);
    }

    public function update(Request $request, Race $race): JsonResponse
    {
        $data = $this->validateRace($request);

        $race->update($data);

        return response()->json([
            'data' => $race->load(['horses', 'winner', 'second', 'third']),
        ]);
    }

    public function updateResult(Request $request, Race $race): JsonResponse
    {
        $data = $request->validate([
            'winner_horse_id' => ['nullable', 'integer', 'exists:horses,id'],
            'winner_dividend' => ['nullable', 'numeric', 'min:0'],
            'second_horse_id' => ['nullable', 'integer', 'exists:horses,id'],
            'second_dividend' => ['nullable', 'numeric', 'min:0'],
            'third_horse_id' => ['nullable', 'integer', 'exists:horses,id'],
            'third_dividend' => ['nullable', 'numeric', 'min:0'],
        ], [
            'winner_horse_id.integer' => 'El 1er lugar (ganador) no es válido.',
            'winner_dividend.numeric' => 'El dividendo del ganador debe ser un número válido.',
            'second_horse_id.integer' => 'El 2do lugar no es válido.',
            'second_dividend.numeric' => 'El dividendo de 2do lugar debe ser un número válido.',
            'third_horse_id.integer' => 'El 3er lugar no es válido.',
        ]);

        $podium = array_filter([
            '1er' => $data['winner_horse_id'] ?? null,
            '2do' => $data['second_horse_id'] ?? null,
            '3er' => $data['third_horse_id'] ?? null,
        ]);

        // Validar que los caballos elegidos pertenezcan a la carrera y no estén retirados
        $horses = Horse::whereIn('id', array_values($podium))->get()->keyBy('id');

        foreach ($podium as $place => $horseId) {
            $horse = $horses->get($horseId);

            if (! $horse || $horse->race_id !== $race->id) {
                return response()->json([
                    'message' => "El ejemplar del {$place} lugar no pertenece a esta carrera.",
                ], 422);
            }

            if ($horse->is_retired) {
                return response()->json([
                    'message' => "El ejemplar N° {$horse->number} ({$horse->name}) está retirado y no puede estar en el podio.",
                ], 422);
            }
        }

        // Validar que no se repitan ejemplares en el podio
        $values = array_values($podium);
        if (count($values) !== count(array_unique($values))) {
            return response()->json([
                'message' => 'No puedes asignar el mismo ejemplar a más de una posición en el podio.',
            ], 422);
        }

        $winnerId = $data['winner_horse_id'] ?? null;

        // Actualizar el dividendo oficial del caballo ganador al registrar el resultado
        if ($winnerId && array_key_exists('winner_dividend', $data) && $data['winner_dividend'] !== null) {
            $winnerHorse = $horses->get($winnerId) ?? Horse::find($winnerId);
            if ($winnerHorse) {
                $winDividend = round((float) $data['winner_dividend'], 2);
                $winnerHorse->update(['dividend' => $winDividend]);

                // Actualizar cuotas y montos de cobro de los tickets emitidos a este ejemplar
                if ($winDividend > 0) {
                    $winningSelections = TicketSelection::where('race_id', $race->id)
                        ->where('horse_id', $winnerId)
                        ->get();

                    foreach ($winningSelections as $sel) {
                        $ticket = $sel->ticket;
                        if ($ticket && $ticket->type === Ticket::TYPE_HIPISMO && ! in_array($ticket->status, [Ticket::STATUS_PAID, Ticket::STATUS_CANCELLED])) {
                            $selStake = (float) ($sel->amount ?? $ticket->stake);
                            $ticket->update([
                                'total_odds' => $winDividend,
                                'potential_payout' => round($selStake * $winDividend, 2),
                            ]);
                            $sel->update(['odd' => $winDividend]);
                        }
                    }
                }
            }
        }

        if (! empty($data['second_horse_id']) && array_key_exists('second_dividend', $data) && $data['second_dividend'] !== null) {
            $secondHorse = $horses->get($data['second_horse_id']) ?? Horse::find($data['second_horse_id']);
            if ($secondHorse) {
                $secondHorse->update(['dividend' => round((float) $data['second_dividend'], 2)]);
            }
        }

        $race->update([
            'winner_horse_id' => $winnerId,
            'second_horse_id' => $data['second_horse_id'] ?? null,
            'third_horse_id' => $data['third_horse_id'] ?? null,
            'status' => $winnerId !== null ? Race::STATUS_FINISHED : Race::STATUS_PENDING,
        ]);

        return response()->json([
            'data' => $race->load(['horses', 'winner', 'second', 'third']),
        ]);
    }

    public function destroy(Race $race): JsonResponse
    {
        $race->delete();

        return response()->json(['message' => 'Carrera eliminada correctamente.']);
    }

    public function updateMeeting(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_meeting' => ['required', 'string'],
            'new_meeting' => ['required', 'string', 'max:255'],
            'track' => ['nullable', 'string', 'max:255'],
            'race_date' => ['nullable', 'date'],
        ], [
            'current_meeting.required' => 'Debes indicar la reunión actual a modificar.',
            'new_meeting.required' => 'Debes indicar el nuevo nombre de la reunión.',
        ]);

        $query = Race::where('meeting', $data['current_meeting']);
        $count = $query->count();

        if ($count === 0) {
            return response()->json([
                'message' => 'No se encontraron carreras asociadas a la reunión indicada.',
            ], 404);
        }

        $updates = ['meeting' => $data['new_meeting']];
        if (array_key_exists('track', $data) && $data['track'] !== null && $data['track'] !== '') {
            $updates['track'] = $data['track'];
        }
        if (array_key_exists('race_date', $data) && $data['race_date'] !== null && $data['race_date'] !== '') {
            $updates['race_date'] = $data['race_date'];
        }

        $query->update($updates);

        return response()->json([
            'message' => "Se actualizaron correctamente {$count} carreras de la reunión.",
            'updated_count' => $count,
        ]);
    }

    private function validateRace(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'meeting' => ['nullable', 'string', 'max:255'],
            'track' => ['nullable', 'string', 'max:255'],
            'race_date' => ['nullable', 'date'],
            'is_valida' => ['nullable', 'boolean'],
            'valida_number' => ['nullable', 'integer', 'min:1', 'max:6'],
        ], [
            'name.required' => 'El nombre de la carrera es obligatorio.',
            'race_date.date' => 'La fecha de la carrera no es válida.',
        ]);
    }
}
