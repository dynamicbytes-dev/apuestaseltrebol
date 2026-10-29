<?php

namespace App\Http\Controllers;

use App\Models\Horse;
use App\Models\Race;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HorseController extends Controller
{
    public function store(Request $request, Race $race): JsonResponse
    {
        $data = $this->validateHorse($request, $race);

        $horse = $race->horses()->create($data);

        return response()->json(['data' => $horse], 201);
    }

    public function update(Request $request, Race $race, Horse $horse): JsonResponse
    {
        $this->ensureBelongsToRace($race, $horse);

        $data = $this->validateHorse($request, $race, $horse);

        $horse->update($data);

        return response()->json(['data' => $horse]);
    }

    public function toggleRetire(Request $request, Race $race, Horse $horse): JsonResponse
    {
        $this->ensureBelongsToRace($race, $horse);

        $newRetired = $request->has('is_retired')
            ? (bool) $request->input('is_retired')
            : ! $horse->is_retired;

        // Si se retira y estaba en el podio, removerlo del podio de la carrera
        if ($newRetired) {
            $podiumUpdate = [];
            if ($race->winner_horse_id === $horse->id) {
                $podiumUpdate['winner_horse_id'] = null;
                $podiumUpdate['status'] = Race::STATUS_PENDING;
            }
            if ($race->second_horse_id === $horse->id) {
                $podiumUpdate['second_horse_id'] = null;
            }
            if ($race->third_horse_id === $horse->id) {
                $podiumUpdate['third_horse_id'] = null;
            }
            if (! empty($podiumUpdate)) {
                $race->update($podiumUpdate);
            }
        }

        $horse->update(['is_retired' => $newRetired]);

        return response()->json([
            'data' => $horse,
            'message' => $newRetired
                ? "El ejemplar N° {$horse->number} ({$horse->name}) ha sido marcado como RETIRADO."
                : "El ejemplar N° {$horse->number} ({$horse->name}) vuelve a estar ACTIVO.",
        ]);
    }

    public function destroy(Race $race, Horse $horse): JsonResponse
    {
        $this->ensureBelongsToRace($race, $horse);

        if ($race->winner_horse_id === $horse->id) {
            return response()->json([
                'message' => 'No se puede eliminar el caballo ganador. Quita el resultado primero.',
            ], 422);
        }

        $horse->delete();

        return response()->json(['message' => 'Caballo eliminado correctamente.']);
    }

    private function validateHorse(Request $request, Race $race, ?Horse $horse = null): array
    {
        $uniqueNumber = Rule::unique('horses', 'number')
            ->where(fn ($query) => $query->where('race_id', $race->id));

        if ($horse) {
            $uniqueNumber->ignore($horse->id);
        }

        return $request->validate([
            'number' => ['required', 'integer', 'min:1', 'max:99', $uniqueNumber],
            'name' => ['required', 'string', 'max:255'],
            'dividend' => ['required', 'numeric', 'min:0'],
            'is_retired' => ['sometimes', 'boolean'],
        ], [
            'number.required' => 'El número del caballo es obligatorio.',
            'number.unique' => 'Ese número ya está asignado a otro caballo de la carrera.',
            'number.min' => 'El número del caballo debe ser mayor que cero.',
            'name.required' => 'El nombre del caballo es obligatorio.',
            'dividend.required' => 'El dividendo es obligatorio.',
            'dividend.numeric' => 'El dividendo debe ser un número.',
            'dividend.min' => 'El dividendo no puede ser negativo.',
        ]);
    }

    private function ensureBelongsToRace(Race $race, Horse $horse): void
    {
        abort_unless($horse->race_id === $race->id, 404);
    }
}
