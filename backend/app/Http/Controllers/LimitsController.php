<?php

namespace App\Http\Controllers;

use App\Models\Agency;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Topes de la agencia del supervisor y de sus taquillas.
 *
 * El supervisor solo puede tocar su propia agencia y las taquillas que tiene a
 * su cargo.
 */
class LimitsController extends Controller
{
    /**
     * Topes de la agencia y de cada una de sus taquillas.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $supervisor */
        $supervisor = auth('api')->user();

        if ($supervisor->agency_id === null) {
            return response()->json([
                'message' => 'Tu usuario no tiene una agencia asignada.',
            ], 422);
        }

        $agency = Agency::find($supervisor->agency_id);

        $taquillas = User::where('role', User::ROLE_TICKETER)
            ->where('supervisor_id', $supervisor->id)
            ->orderBy('name')
            ->get()
            ->map(fn (User $taquilla) => [
                'id' => $taquilla->id,
                'name' => $taquilla->name,
                'email' => $taquilla->email,
                'max_bet_amount' => $taquilla->max_bet_amount,
                'max_ticket_payout' => $taquilla->max_ticket_payout,
                'effective' => $taquilla->effectiveLimits(),
            ]);

        return response()->json([
            'data' => [
                'agency' => [
                    'id' => $agency?->id,
                    'name' => $agency?->name,
                    'max_bet_amount' => $agency?->max_bet_amount,
                    'max_ticket_payout' => $agency?->max_ticket_payout,
                ],
                'taquillas' => $taquillas,
            ],
        ]);
    }

    /**
     * Topes de la agencia del supervisor.
     */
    public function updateAgency(Request $request): JsonResponse
    {
        /** @var User $supervisor */
        $supervisor = auth('api')->user();

        if ($supervisor->agency_id === null) {
            return response()->json([
                'message' => 'Tu usuario no tiene una agencia asignada.',
            ], 422);
        }

        $data = $this->validateLimits($request);

        $agency = Agency::findOrFail($supervisor->agency_id);
        $agency->update($data);

        return response()->json([
            'data' => $agency,
            'message' => 'Topes de la agencia actualizados.',
        ]);
    }

    /**
     * Topes propios de una taquilla.
     */
    public function updateTaquilla(Request $request, User $taquilla): JsonResponse
    {
        /** @var User $supervisor */
        $supervisor = auth('api')->user();

        $this->ensureOwnedBySupervisor($taquilla, $supervisor);

        $data = $this->validateLimits($request);

        $taquilla->update($data);

        return response()->json([
            'data' => $taquilla,
            'message' => 'Topes de la taquilla actualizados.',
        ]);
    }

    private function validateLimits(Request $request): array
    {
        return $request->validate([
            'max_bet_amount' => ['nullable', 'numeric', 'min:0'],
            'max_ticket_payout' => ['nullable', 'numeric', 'min:0'],
        ], [
            'max_bet_amount.numeric' => 'El monto máximo por apuesta debe ser un número.',
            'max_bet_amount.min' => 'El monto máximo por apuesta no puede ser negativo.',
            'max_ticket_payout.numeric' => 'La ganancia máxima por ticket debe ser un número.',
            'max_ticket_payout.min' => 'La ganancia máxima por ticket no puede ser negativa.',
        ]);
    }

    private function ensureOwnedBySupervisor(User $taquilla, User $supervisor): void
    {
        abort_unless(
            $taquilla->role === User::ROLE_TICKETER
            && $taquilla->supervisor_id === $supervisor->id,
            404
        );
    }
}
