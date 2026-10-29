<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;

class SupervisorDashboardController extends Controller
{
    public function index(): JsonResponse
    {
        /** @var User $supervisor */
        $supervisor = auth('api')->user();
        $agency = $supervisor->agency;

        return response()->json([
            'supervisor' => [
                'id' => $supervisor->id,
                'name' => $supervisor->name,
                'email' => $supervisor->email,
            ],
            'agency' => $agency ? [
                'id' => $agency->id,
                'name' => $agency->name,
                'max_bet_amount' => $agency->max_bet_amount,
                'max_ticket_payout' => $agency->max_ticket_payout,
            ] : null,
            'stats' => [
                'taquillas' => $supervisor->taquillas()->count(),
            ],
        ]);
    }
}
