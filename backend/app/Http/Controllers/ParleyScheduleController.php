<?php

namespace App\Http\Controllers;

use App\Models\ParleyEventOverride;
use App\Services\SportsApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Corrección manual del calendario de un evento deportivo.
 *
 * El proveedor puede fechar mal un partido. El administrador corrige la
 * fecha una vez y la corrección se aplica en todas partes: apuestas,
 * liquidación y cartelera.
 */
class ParleyScheduleController extends Controller
{
    public function __construct(private readonly SportsApiService $sports) {}

    /**
     * Fija la fecha correcta de un evento.
     */
    public function update(Request $request, string $sport, string $eventId): JsonResponse
    {
        $data = $request->validate([
            'starts_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:255'],
        ], [
            'starts_at.required' => 'Debe indicar la fecha y hora correctas.',
            'starts_at.date' => 'La fecha no es válida.',
        ]);

        if (! array_key_exists($sport, config('sports.sports'))) {
            return response()->json(['message' => 'El deporte no es válido.'], 422);
        }

        $startsAt = Carbon::parse($data['starts_at'])
            ->setTimezone(config('sports.timezone', 'America/Caracas'));

        $override = ParleyEventOverride::updateOrCreate(
            ['sport' => $sport, 'external_event_id' => $eventId],
            [
                'starts_at' => $startsAt,
                'notes' => $data['notes'] ?? null,
            ]
        );

        // Se limpia la caché del evento para que el cambio se vea de
        // inmediato en la cartelera y en las apuestas.
        cache()->forget("sports-api:{$sport}:events:".config('sports.timezone', 'America/Caracas').':'.$startsAt->toDateString());
        cache()->forget("sports-api:{$sport}:events:".config('sports.timezone', 'America/Caracas').':'.$startsAt->copy()->subDay()->toDateString());

        return response()->json([
            'data' => $override,
            'message' => 'Fecha corregida. La corrección se aplica en toda la aplicación.',
        ]);
    }

    /**
     * Quita la corrección y vuelve la fecha del proveedor.
     */
    public function destroy(string $sport, string $eventId): JsonResponse
    {
        $override = ParleyEventOverride::where('sport', $sport)
            ->where('external_event_id', $eventId)
            ->first();

        if (! $override) {
            return response()->json(['message' => 'Ese evento no tiene corrección.'], 404);
        }

        $override->delete();

        return response()->json([
            'message' => 'Corrección eliminada. Se vuelve a la fecha del proveedor.',
        ]);
    }

    /**
     * Correcciones registradas.
     */
    public function index(): JsonResponse
    {
        $overrides = ParleyEventOverride::orderBy('starts_at')->get();

        return response()->json(['data' => $overrides]);
    }
}
