<?php

namespace App\Http\Controllers;

use App\Models\AnimalitoSorteo;
use App\Models\Lottery;
use App\Models\LotteryAnimal;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnimalitoSorteoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AnimalitoSorteo::with('lottery');

        $date = $request->filled('date') ? $request->query('date') : now()->toDateString();

        if ($request->filled('lottery_id')) {
            $query->where('lottery_id', $request->query('lottery_id'));
        }

        if ($request->filled('date')) {
            $query->whereDate('sorteo_at', $request->query('date'));
        }

        $sorteos = $query->orderByDesc('sorteo_at')->limit(100)->get();

        // Loterías activas que todavía no tienen un resultado resuelto para
        // la fecha: son las que el administrador debe registrar a mano.
        $pending = Lottery::where('is_active', true)
            ->whereDoesntHave('sorteos', function ($query) use ($date) {
                $query->whereDate('sorteo_at', $date)->where('is_resolved', true);
            })
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'source_url'])
            ->map(fn (Lottery $lottery) => [
                'id' => $lottery->id,
                'name' => $lottery->name,
                'has_source' => ! blank($lottery->source_url),
            ]);

        return response()->json([
            'data' => $sorteos,
            'pending' => $pending,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lottery_id' => ['required', 'integer', 'exists:lotteries,id'],
            'sorteo_date' => ['required', 'date_format:Y-m-d'],
            'sorteo_time' => ['required', 'string', 'max:10'],
            'lottery_animal_id' => ['required', 'integer', 'exists:lottery_animals,id'],
        ], [
            'lottery_id.required' => 'Debe seleccionar una lotería.',
            'sorteo_date.required' => 'Debe indicar la fecha del sorteo.',
            'sorteo_time.required' => 'Debe indicar el horario del sorteo.',
            'lottery_animal_id.required' => 'Debe seleccionar el animalito ganador.',
        ]);

        $lottery = Lottery::findOrFail($data['lottery_id']);
        $animal = LotteryAnimal::where('lottery_id', $lottery->id)->findOrFail($data['lottery_animal_id']);

        $timeClean = trim($data['sorteo_time']);
        $sorteoAt = Carbon::createFromFormat('Y-m-d H:i', "{$data['sorteo_date']} {$timeClean}");

        $sorteo = AnimalitoSorteo::updateOrCreate(
            [
                'lottery_id' => $lottery->id,
                'sorteo_at' => $sorteoAt,
            ],
            [
                'number' => (string) $animal->number,
                'animal' => $animal->animal,
                'es_manual' => true,
                // Ingreso manual del administrador: siempre es un resultado real.
                'is_resolved' => true,
            ]
        );

        return response()->json([
            'data' => $sorteo->load('lottery'),
            'message' => "Resultado registrado con éxito: N° {$animal->number} - {$animal->animal} para {$lottery->name}.",
        ], 201);
    }

    public function destroy(AnimalitoSorteo $sorteo): JsonResponse
    {
        $sorteo->delete();

        return response()->json([
            'message' => 'Resultado de sorteo eliminado correctamente.',
        ]);
    }
}
