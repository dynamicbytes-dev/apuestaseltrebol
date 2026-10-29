<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class TaquillaDashboardController extends Controller
{
    public function index(): JsonResponse
    {
        /** @var User $taquilla */
        $taquilla = auth('api')->user();
        $agency = $taquilla->agency;

        $todayQuery = Ticket::where('taquilla_id', $taquilla->id)
            ->whereDate('created_at', now()->toDateString());

        $stats = [
            'tickets_today' => (clone $todayQuery)->count(),
            'stake_today' => round((float) (clone $todayQuery)->sum('stake'), 2),
            'pending' => Ticket::where('taquilla_id', $taquilla->id)
                ->where('status', Ticket::STATUS_PENDING)
                ->count(),
            'paid_today' => round((float) Ticket::where('taquilla_id', $taquilla->id)
                ->where('status', Ticket::STATUS_PAID)
                ->whereDate('paid_at', now()->toDateString())
                ->sum('paid_amount'), 2),
            'cancelled' => Ticket::where('taquilla_id', $taquilla->id)
                ->where('status', Ticket::STATUS_CANCELLED)
                ->count(),
        ];

        $recent = Ticket::with('selections')
            ->where('taquilla_id', $taquilla->id)
            ->latest()
            ->limit(5)
            ->get();

        return response()->json([
            'data' => [
                'agency' => $agency ? [
                    'id' => $agency->id,
                    'name' => $agency->name,
                    'max_bet_amount' => $agency->max_bet_amount,
                    'max_ticket_payout' => $agency->max_ticket_payout,
                ] : null,
                'stats' => $stats,
                'recent' => $recent,
            ],
        ]);
    }
}
