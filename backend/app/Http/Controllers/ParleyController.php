<?php

namespace App\Http\Controllers;

use App\Exceptions\SportsApiException;
use App\Services\SportsApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ParleyController extends Controller
{
    public function __construct(private readonly SportsApiService $api)
    {
    }

    public function sports(): JsonResponse
    {
        return response()->json(['data' => $this->api->sports()]);
    }

    public function status(): JsonResponse
    {
        try {
            return response()->json(['data' => $this->api->status()]);
        } catch (SportsApiException $exception) {
            return response()->json(['message' => $exception->getMessage()], 502);
        }
    }

    public function events(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sport' => ['required', 'string', Rule::in(array_keys(config('sports.sports')))],
            'date' => ['required', 'date_format:Y-m-d'],
        ], [
            'sport.required' => 'Debe indicar el deporte.',
            'sport.in' => 'El deporte seleccionado no es válido.',
            'date.required' => 'Debe indicar la fecha.',
            'date.date_format' => 'La fecha debe tener el formato AAAA-MM-DD.',
        ]);

        try {
            $events = $this->api->events($data['sport'], $data['date']);

            return response()->json([
                'data' => $events,
                'meta' => [
                    'sport' => $data['sport'],
                    'date' => $data['date'],
                    'count' => count($events),
                ],
            ]);
        } catch (SportsApiException $exception) {
            return response()->json(['message' => $exception->getMessage()], 502);
        }
    }

    public function odds(string $sport, string $eventId): JsonResponse
    {
        if (! array_key_exists($sport, config('sports.sports'))) {
            return response()->json(['message' => 'El deporte seleccionado no es válido.'], 422);
        }

        try {
            return response()->json(['data' => $this->api->odds($sport, $eventId)]);
        } catch (SportsApiException $exception) {
            return response()->json(['message' => $exception->getMessage()], 502);
        }
    }
}
