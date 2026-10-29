<?php

namespace App\Http\Controllers;

use App\Models\Horse;
use App\Models\Race;
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
            ]);

            if ($request->has('horses') && is_array($request->input('horses'))) {
                $horsesData = $request->validate([
                    'horses.*.number' => ['required', 'integer', 'min:1', 'max:99', 'distinct'],
                    'horses.*.name' => ['required', 'string', 'max:255'],
                    'horses.*.dividend' => ['required', 'numeric', 'min:0'],
                ]);

                foreach ($horsesData['horses'] as $item) {
                    $race->horses()->create([
                        'number' => (int) $item['number'],
                        'name' => trim($item['name']),
                        'dividend' => round((float) $item['dividend'], 2),
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
            'second_horse_id' => ['nullable', 'integer', 'exists:horses,id'],
            'third_horse_id' => ['nullable', 'integer', 'exists:horses,id'],
        ], [
            'winner_horse_id.integer' => 'El 1er lugar (ganador) no es válido.',
            'second_horse_id.integer' => 'El 2do lugar no es válido.',
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

    private function validateRace(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'meeting' => ['nullable', 'string', 'max:255'],
            'track' => ['nullable', 'string', 'max:255'],
            'race_date' => ['nullable', 'date'],
        ], [
            'name.required' => 'El nombre de la carrera es obligatorio.',
            'race_date.date' => 'La fecha de la carrera no es válida.',
        ]);
    }
}
