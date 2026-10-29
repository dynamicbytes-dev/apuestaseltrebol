<?php

namespace Tests\Concerns;

use App\Models\Lottery;
use App\Models\LotteryAnimal;
use Carbon\Carbon;
use Illuminate\Support\Str;

/**
 * Utilidades para montar apuestas de animalitos con el formato nuevo:
 * varios animalitos, cada uno con su monto, todos del mismo sorteo.
 */
trait AnimalitosBet
{
    /**
     * Crea una lotería con horarios de sorteo y animalitos.
     *
     * @param  array<int, array{0: string, 1: string}>  $animals  [número, animalito]
     */
    protected function lotteryWithSchedule(
        string $name = 'Lotto Activo',
        array $drawTimes = ['09:00', '19:00'],
        array $animals = [['5', 'León'], ['12', 'Caballo']]
    ): Lottery {
        $lottery = Lottery::create([
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(6)),
            'payout_multiplier' => 30.00,
            'is_active' => true,
            'draw_times' => $drawTimes,
        ]);

        foreach ($animals as [$number, $animal]) {
            LotteryAnimal::create([
                'lottery_id' => $lottery->id,
                'number' => $number,
                'animal' => $animal,
                'is_enabled' => true,
            ]);
        }

        return $lottery->fresh();
    }

    /**
     * Monta el payload de una apuesta de animalitos.
     *
     * @param  array<int, array{animal: int, amount: float}>  $rows
     * @return array<string, mixed>
     */
    protected function animalitosPayload(
        Lottery $lottery,
        array $rows,
        ?string $date = null,
        string $time = '19:00'
    ): array {
        return [
            'type' => 'animalitos',
            'lottery_id' => $lottery->id,
            'sorteo_date' => $date ?? Carbon::now()->addDay()->toDateString(),
            'sorteo_time' => $time,
            'selections' => array_map(fn (array $row) => [
                'lottery_animal_id' => $row['animal'],
                'amount' => $row['amount'],
            ], $rows),
        ];
    }

    /**
     * Devuelve el id del animalito con ese número dentro de la lotería.
     */
    protected function animalId(Lottery $lottery, string $number): int
    {
        return (int) $lottery->animals()->where('number', $number)->value('id');
    }
}
