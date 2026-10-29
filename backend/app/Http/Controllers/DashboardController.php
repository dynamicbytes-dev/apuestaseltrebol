<?php

namespace App\Http\Controllers;

use App\Models\Agency;
use App\Models\Lottery;
use App\Models\Race;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'stats' => [
                'agencies' => Agency::count(),
                'supervisors' => User::where('role', User::ROLE_SUPERVISOR)->count(),
                'taquillas' => User::where('role', User::ROLE_TICKETER)->count(),
                'lotteries' => Lottery::count(),
                'races' => Race::count(),
            ],
        ]);
    }
}
