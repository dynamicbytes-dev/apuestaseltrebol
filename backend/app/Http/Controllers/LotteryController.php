<?php

namespace App\Http\Controllers;

use App\Models\Lottery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class LotteryController extends Controller
{
    public function index(): JsonResponse
    {
        $lotteries = Lottery::withCount([
            'animals',
            'animals as enabled_animals_count' => fn ($query) => $query->where('is_enabled', true),
        ])->orderBy('name')->get();

        return response()->json(['data' => $lotteries]);
    }

    public function store(Request $request): JsonResponse
    {
        // Normaliza cada número a texto exacto (sin casteos a entero) para que
        // "0" y "00" sigan siendo valores distintos.
        if (is_array($request->input('animals'))) {
            $request->merge([
                'animals' => collect($request->input('animals'))
                    ->map(function ($item) {
                        if (is_array($item) && isset($item['number']) && is_scalar($item['number'])) {
                            $item['number'] = trim((string) $item['number']);
                        }

                        return $item;
                    })
                    ->all(),
            ]);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:lotteries,name'],
            'payout_multiplier' => ['sometimes', 'numeric', 'min:1', 'max:1000'],
            'animals' => ['sometimes', 'array', 'min:1', 'max:100'],
            // Texto de 1 o 2 dígitos: "0", "00", "1" ... "36". distinct:strict compara
            // como cadenas exactas (el modo laxo de PHP considera "0" == "00").
            'animals.*.number' => ['required', 'string', 'regex:/^\d{1,2}$/', 'distinct:strict'],
            'animals.*.animal' => ['required', 'string', 'max:255'],
        ], [
            'name.required' => 'El nombre de la lotería es obligatorio.',
            'name.unique' => 'Ya existe una lotería con ese nombre.',
            'payout_multiplier.numeric' => 'El multiplicador de pago debe ser un número.',
            'payout_multiplier.min' => 'El multiplicador de pago debe ser al menos 1.',
            'payout_multiplier.max' => 'El multiplicador de pago no puede superar 1000.',
            'animals.min' => 'Debe registrar al menos un número con su animalito.',
            'animals.max' => 'Una lotería no puede tener más de 100 números.',
            'animals.*.number.required' => 'Cada animalito debe tener un número.',
            'animals.*.number.string' => 'El número del animalito debe ser texto (ej: 0, 00, 1).',
            'animals.*.number.regex' => 'El número del animalito debe tener 1 o 2 dígitos (ej: 0, 00, 36).',
            'animals.*.number.distinct' => 'Hay números repetidos en la lista de animalitos.',
            'animals.*.animal.required' => 'El nombre del animalito es obligatorio.',
        ]);

        // Si no se envían animalitos se usa el listado base de 36 números.
        $source = isset($data['animals'])
            ? collect($data['animals'])->map(fn (array $item) => [
                'number' => trim($item['number']),
                'animal' => trim($item['animal']),
            ])
            : collect(config('animalitos.animals'))->map(fn (array $item) => [
                'number' => (string) $item['number'],
                'animal' => $item['animal'],
            ]);

        $lottery = DB::transaction(function () use ($data, $source) {
            $lottery = Lottery::create([
                'name' => $data['name'],
                'slug' => Str::slug($data['name']).'-'.Str::lower(Str::random(5)),
                'payout_multiplier' => $data['payout_multiplier'] ?? 30,
            ]);

            $animals = $source
                // "0" antes que "00", luego orden numérico (no alfabético).
                ->sortBy(fn (array $item) => [(int) $item['number'], strlen($item['number'])])
                ->map(fn (array $item) => [
                    'lottery_id' => $lottery->id,
                    'number' => $item['number'],
                    'animal' => $item['animal'],
                    'is_enabled' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
                ->values()
                ->all();

            $lottery->animals()->insert($animals);

            return $lottery;
        });

        return response()->json([
            'data' => $lottery->load('animals'),
        ], 201);
    }

    public function show(Lottery $lottery): JsonResponse
    {
        return response()->json(['data' => $lottery->load('animals')]);
    }

    public function update(Request $request, Lottery $lottery): JsonResponse
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('lotteries', 'name')->ignore($lottery->id),
            ],
            'is_active' => ['required', 'boolean'],
            'payout_multiplier' => ['sometimes', 'numeric', 'min:1', 'max:1000'],
        ], [
            'name.required' => 'El nombre de la lotería es obligatorio.',
            'name.unique' => 'Ya existe una lotería con ese nombre.',
            'is_active.required' => 'Debe indicar si la lotería está activa.',
            'payout_multiplier.numeric' => 'El multiplicador de pago debe ser un número.',
            'payout_multiplier.min' => 'El multiplicador de pago debe ser al menos 1.',
            'payout_multiplier.max' => 'El multiplicador de pago no puede superar 1000.',
        ]);

        $lottery->update($data);

        return response()->json(['data' => $lottery]);
    }

    public function updateAnimals(Request $request, Lottery $lottery): JsonResponse
    {
        $data = $request->validate([
            'animals' => ['required', 'array', 'min:1'],
            'animals.*.id' => ['required', 'integer'],
            'animals.*.animal' => ['required', 'string', 'max:255'],
            'animals.*.is_enabled' => ['required', 'boolean'],
        ], [
            'animals.required' => 'Debe enviar los animalitos de la lotería.',
            'animals.min' => 'La lotería debe tener al menos un animalito.',
            'animals.*.animal.required' => 'El nombre del animalito es obligatorio.',
            'animals.*.is_enabled.required' => 'Debe indicar si el número está habilitado.',
        ]);

        $ids = collect($data['animals'])->pluck('id')->all();
        $ownedCount = $lottery->animals()->whereIn('id', $ids)->count();

        if ($ownedCount !== $lottery->animals()->count()) {
            return response()->json([
                'message' => 'Los animalitos enviados no corresponden a esta lotería.',
            ], 422);
        }

        DB::transaction(function () use ($data, $lottery) {
            foreach ($data['animals'] as $item) {
                $lottery->animals()->whereKey($item['id'])->update([
                    'animal' => $item['animal'],
                    'is_enabled' => $item['is_enabled'],
                ]);
            }
        });

        return response()->json(['data' => $lottery->load('animals')]);
    }

    public function destroy(Lottery $lottery): JsonResponse
    {
        $lottery->delete();

        return response()->json(['message' => 'Lotería eliminada correctamente.']);
    }
}
