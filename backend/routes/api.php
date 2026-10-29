<?php

use App\Http\Controllers\AgencyController;
use App\Http\Controllers\AnimalitoSorteoController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HorseController;
use App\Http\Controllers\LotteryController;
use App\Http\Controllers\ParleyController;
use App\Http\Controllers\RaceController;
use App\Http\Controllers\SupervisorController;
use App\Http\Controllers\SupervisorDashboardController;
use App\Http\Controllers\TaquillaController;
use App\Http\Controllers\TaquillaDashboardController;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\TicketMovementController;
use App\Http\Controllers\TicketReviewController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::get('/dashboard', [DashboardController::class, 'index'])->middleware('admin');

    Route::get('/parley/sports', [ParleyController::class, 'sports']);
    Route::get('/parley/events', [ParleyController::class, 'events']);
    Route::get('/parley/events/{sport}/{eventId}/odds', [ParleyController::class, 'odds']);
});

Route::middleware(['auth', 'admin'])->prefix('admin')->group(function () {
    Route::get('/agencies', [AgencyController::class, 'index']);
    Route::post('/agencies', [AgencyController::class, 'store']);
    Route::put('/agencies/{agency}', [AgencyController::class, 'update']);
    Route::patch('/agencies/{agency}/limits', [AgencyController::class, 'updateLimits']);
    Route::delete('/agencies/{agency}', [AgencyController::class, 'destroy']);

    Route::get('/supervisors', [SupervisorController::class, 'index']);
    Route::post('/supervisors', [SupervisorController::class, 'store']);
    Route::put('/supervisors/{supervisor}', [SupervisorController::class, 'update']);
    Route::delete('/supervisors/{supervisor}', [SupervisorController::class, 'destroy']);

    Route::get('/lotteries', [LotteryController::class, 'index']);
    Route::post('/lotteries', [LotteryController::class, 'store']);
    Route::get('/lotteries/{lottery}', [LotteryController::class, 'show']);
    Route::put('/lotteries/{lottery}', [LotteryController::class, 'update']);
    Route::put('/lotteries/{lottery}/animals', [LotteryController::class, 'updateAnimals']);
    Route::delete('/lotteries/{lottery}', [LotteryController::class, 'destroy']);

    Route::get('/animalitos/sorteos', [AnimalitoSorteoController::class, 'index']);
    Route::post('/animalitos/sorteos', [AnimalitoSorteoController::class, 'store']);
    Route::delete('/animalitos/sorteos/{sorteo}', [AnimalitoSorteoController::class, 'destroy']);

    Route::get('/races', [RaceController::class, 'index']);
    Route::post('/races', [RaceController::class, 'store']);
    Route::get('/races/{race}', [RaceController::class, 'show']);
    Route::put('/races/{race}', [RaceController::class, 'update']);
    Route::put('/races/{race}/result', [RaceController::class, 'updateResult']);
    Route::delete('/races/{race}', [RaceController::class, 'destroy']);

    Route::post('/races/{race}/horses', [HorseController::class, 'store']);
    Route::put('/races/{race}/horses/{horse}', [HorseController::class, 'update']);
    Route::patch('/races/{race}/horses/{horse}/retire', [HorseController::class, 'toggleRetire']);
    Route::delete('/races/{race}/horses/{horse}', [HorseController::class, 'destroy']);

    Route::get('/parley/status', [ParleyController::class, 'status']);
    Route::get('/parley/sports', [ParleyController::class, 'sports']);
    Route::get('/parley/events', [ParleyController::class, 'events']);
    Route::get('/parley/events/{sport}/{eventId}/odds', [ParleyController::class, 'odds']);

    Route::get('/analytics', [AnalyticsController::class, 'global']);
});

Route::middleware(['auth', 'supervisor'])->prefix('supervisor')->group(function () {
    Route::get('/dashboard', [SupervisorDashboardController::class, 'index']);
    Route::get('/analytics', [AnalyticsController::class, 'agency']);

    Route::get('/taquillas', [TaquillaController::class, 'index']);
    Route::post('/taquillas', [TaquillaController::class, 'store']);
    Route::put('/taquillas/{taquilla}', [TaquillaController::class, 'update']);
    Route::delete('/taquillas/{taquilla}', [TaquillaController::class, 'destroy']);

    Route::post('/tickets/{ticket}/review', [TicketReviewController::class, 'store']);

    Route::get('/tickets', [TicketMovementController::class, 'agencyTickets']);
    Route::get('/tickets/{ticket}/movements', [TicketMovementController::class, 'agencyTicketMovements']);
});

Route::middleware(['auth', 'taquilla'])->prefix('taquilla')->group(function () {
    Route::get('/dashboard', [TaquillaDashboardController::class, 'index']);
    Route::get('/catalog', [TicketController::class, 'catalog']);

    Route::get('/tickets', [TicketController::class, 'index']);
    Route::post('/tickets', [TicketController::class, 'store']);
    Route::post('/tickets/{ticket}/pay', [TicketController::class, 'pay']);
    Route::post('/tickets/{ticket}/cancel', [TicketController::class, 'cancel']);
    Route::get('/tickets/{ticket}/movements', [TicketMovementController::class, 'ticketMovements']);
});
