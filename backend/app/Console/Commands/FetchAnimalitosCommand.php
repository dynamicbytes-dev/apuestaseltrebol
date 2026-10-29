<?php

namespace App\Console\Commands;

use App\Models\AnimalitoSorteo;
use App\Models\Lottery;
use App\Models\LotteryAnimal;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Sincroniza el resultado de las loterías activas desde la fuente configurada
 * en `lotteries.source_url`.
 *
 * Reglas:
 *  - Si la lotería no tiene `source_url`, no se consulta ninguna fuente y el
 *    resultado queda pendiente de ingreso manual por el administrador. No se
 *    crea ninguna fila: un placeholder sin resultado real nunca debe existir
 *    en la tabla, porque la validación de pago solo toma sorteos resueltos.
 *  - El número se conserva como texto: "0" y "00" son números distintos.
 *  - La idempotencia está acotada por fecha: un número puede salir en días
 *    diferentes y ambos sorteos deben registrarse.
 */
class FetchAnimalitosCommand extends Command
{
    protected $signature = 'fetch:animalitos';

    protected $description = 'Actualiza resultados de animalitos (automático + manual)';

    /** Ventana horaria en la que se consultan los sorteos. */
    private const HOUR_START = 9;

    private const HOUR_END = 19;

    public function handle(): int
    {
        $now = Carbon::now();

        if ($now->hour < self::HOUR_START || $now->hour >= self::HOUR_END) {
            $this->info('Fuera de horario de sorteos. No se ejecuta.');

            return Command::SUCCESS;
        }

        $lotteries = Lottery::where('is_active', true)->with('animals')->get();

        if ($lotteries->isEmpty()) {
            $this->info('No hay loterías activas.');

            return Command::SUCCESS;
        }

        $sincronizadas = 0;
        $pendientes = 0;

        foreach ($lotteries as $lottery) {
            if (blank($lottery->source_url)) {
                $this->warn("\"{$lottery->name}\" no tiene source_url configurada: el resultado queda pendiente de ingreso manual.");

                $pendientes++;

                continue;
            }

            try {
                if ($this->syncLottery($lottery, $now)) {
                    $sincronizadas++;
                } else {
                    $pendientes++;
                }
            } catch (\Throwable $exception) {
                $this->error("Error inesperado consultando {$lottery->name}: ".$exception->getMessage());
                $pendientes++;
            }
        }

        $this->info("Resumen: {$sincronizadas} sincronizadas, {$pendientes} pendientes de ingreso manual.");

        return Command::SUCCESS;
    }

    /**
     * Intenta registrar el resultado de una lotería. Devuelve true si quedó
     * registrado (o ya estaba registrado) y false si sigue pendiente.
     */
    private function syncLottery(Lottery $lottery, Carbon $now): bool
    {
        $response = Http::timeout((int) config('sports.timeout', 20))
            ->accept('text/html')
            ->get($lottery->source_url);

        if ($response->failed()) {
            $this->warning("No se pudo consultar la fuente de {$lottery->name} (HTTP {$response->status()}). Quedará para ingreso manual.");

            return false;
        }

        $number = $this->extractNumber($response->body());

        if ($number === null) {
            $this->error("No se encontró un número ganador en la fuente de {$lottery->name}. Quedará para ingreso manual.");

            return false;
        }

        $animal = $this->resolveAnimal($lottery, $number);

        if (! $animal) {
            $this->warning("El número \"{$number}\" no está habilitado en {$lottery->name}. Quedará para ingreso manual.");

            return false;
        }

        // Idempotencia acotada por fecha: un mismo número puede salir en
        // sorteos distintos de días diferentes.
        $existing = AnimalitoSorteo::where('lottery_id', $lottery->id)
            ->whereDate('sorteo_at', $now->toDateString())
            ->first();

        if ($existing) {
            $this->info("{$lottery->name}: ya hay un resultado registrado para hoy (N° {$existing->number} - {$existing->animal}).");

            return true;
        }

        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => $animal->number,
            'animal' => $animal->animal,
            'sorteo_at' => $now,
            'es_manual' => false,
            'is_resolved' => true,
        ]);

        $this->info("{$lottery->name}: resultado guardado — N° {$animal->number} - {$animal->animal}");

        return true;
    }

    /**
     * Extrae el número ganador del contenido de la fuente.
     *
     * Solo acepta patrones explícitos. Ante la duda devuelve null: es
     * preferible que el resultado quede pendiente de ingreso manual a que se
     * registre un número equivocado como ganador.
     */
    private function extractNumber(string $content): ?string
    {
        $patterns = [
            // "N° 5 - Ciempiés", "N 00 - Delfín", "Nº 12 - Caballo"
            '/N[°ºo\.]?\s*(\d{1,2})\s*[-–—:]\s*([\p{L}\p{N}][\p{L}\p{N}\s]*)/u',
            // "resultado: 5", "número ganador 5"
            '/(?:resultado|n[uú]mero\s+ganador)[^\d\n]{0,30}(\d{1,2})/iu',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $content, $matches) !== 1) {
                continue;
            }

            $digits = $matches[1] ?? null;

            if (is_string($digits) && preg_match('/^\d{1,2}$/', $digits) === 1) {
                return $digits;
            }
        }

        return null;
    }

    /**
     * Busca el animalito que corresponde al número extraído.
     *
     * "0" y "00" son números distintos, así que la coincidencia numérica solo
     * se usa cuando el valor no es cero.
     */
    private function resolveAnimal(Lottery $lottery, string $number): ?LotteryAnimal
    {
        $exact = $lottery->animals->firstWhere('number', $number);

        if ($exact) {
            return $exact;
        }

        $value = (int) $number;

        if ($value === 0) {
            return null;
        }

        return $lottery->animals->first(
            fn (LotteryAnimal $animal) => (int) $animal->number === $value
        );
    }
}
