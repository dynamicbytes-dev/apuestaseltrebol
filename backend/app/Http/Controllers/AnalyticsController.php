<?php

namespace App\Http\Controllers;

use App\Models\Agency;
use App\Models\User;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Analíticas de operación: por agencia (supervisor) y globales (admin).
 */
class AnalyticsController extends Controller
{
    public function __construct(private readonly AnalyticsService $analytics) {}

    /**
     * Analítica de la agencia del supervisor.
     */
    public function agency(Request $request): JsonResponse
    {
        /** @var User $supervisor */
        $supervisor = auth('api')->user();

        $data = $this->validatePeriod($request);

        if ($supervisor->agency_id === null) {
            return response()->json([
                'message' => 'Tu usuario no tiene una agencia asignada.',
            ], 422);
        }

        $summary = $this->analytics->agencySummary(
            $supervisor->agency_id,
            $data['from'] ?? null,
            $data['to'] ?? null
        );

        $agency = Agency::find($supervisor->agency_id);

        $summary['scope']['agency_name'] = $agency?->name;

        return response()->json(['data' => $summary]);
    }

    /**
     * Analítica global, con el desglose por agencia.
     */
    public function global(Request $request): JsonResponse
    {
        $data = $this->validatePeriod($request);

        return response()->json([
            'data' => $this->analytics->globalSummary(
                $data['from'] ?? null,
                $data['to'] ?? null
            ),
        ]);
    }

    private function validatePeriod(Request $request): array
    {
        return $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ], [
            'from.date_format' => 'La fecha inicial debe tener el formato AAAA-MM-DD.',
            'to.date_format' => 'La fecha final debe tener el formato AAAA-MM-DD.',
        ]);
    }
}
