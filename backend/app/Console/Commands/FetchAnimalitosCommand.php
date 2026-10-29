<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use App\Models\Lottery;
use App\Models\AnimalitoSorteo;
use App\Models\LotteryAnimal;
use Carbon\Carbon;

class FetchAnimalitosCommand extends Command
{
    protected $signature = 'fetch:animalitos';
    protected $description = 'Actualiza resultados de animalitos (automático + manual)';

    public function handle()
    {
        // Solo correr entre 9:00 AM y 7:00 PM
        $now = Carbon::now();
        $hour = $now->hour;
        if ($hour < 9 || $hour >= 19) {
            $this->info('Fuera de horario de sorteos. No se ejecuta.');
            return Command::SUCCESS;
        }

        $lotteries = Lottery::where('is_active', true)
            ->with('animals')
            ->get();

        foreach ($lotteries as $lottery) {
            try {
                // 1. Intentar scraping (ejemplo genérico - webs variadas)
                $response = Http::get("https://www.resultados-loteria-ve.com/{$lottery->slug}");
                
                if ($response->failed()) {
                    $this->warning("No se pudo consultar la web de {$lottery->name} (fallo HTTP). Quedará para ingreso manual.");
                    $this->manualMode($lottery, null, Carbon::now());
                    continue;
                }

                $content = $response->body();
                // Ejemplo de extracción: buscar "N° 5 - Ciempiés" o solo número
                // Esto varia por webs; aqui un patron simplificado:
                if (preg_match('/N° (\d+) - (\w+)/', $content, $matches)) {
                    $number = (int)$matches[1];
                    $animalName = $matches[2];
                } elseif (preg_match('/\b(\d{1,2})\b/', $content, $matches)) {
                    $number = (int)$matches[1];
                    $animalName = '—';
                } else {
                    $this->error("No se encontró patrón de resultado en {$lottery->name}. Marca como manual.");
                    // Marcar como manual para que admin pueda corregir después
                    $this->manualMode($lottery, null, Carbon::now());
                    continue;
                }

                // Buscar el animal correspondiente en la lotería
                $animalRecord = $lottery->animals->firstWhere('number', $number);
                if (!$animalRecord) {
                    $this->warning("Número $number no está habilitado en {$lottery->name}. Marca como manual.");
                    $this->manualMode($lottery, $number, Carbon::now());
                    continue;
                }

                // 2. Guardar en la tabla (idempotente: si ya existe ese número/fecha, no duplicar)
                $sorteoExisting = AnimalitoSorteo::where('lottery_id', $lottery->id)
                    ->where('number', $number)
                    ->first();

                if ($sorteoExisting) {
                    $this->info("Resultado ya registrado para {$lottery->name}: N° $number (fecha: {$sorteoExisting->sorteo_at})");
                    continue; // Ya existía, no hacer nada
                }

                AnimalitoSorteo::create([
                    'lottery_id' => $lottery->id,
                    'number' => $number,
                    'animal' => $animalRecord->animal,
                    'animal_name' => $animalName,
                    'sorteo_at' => Carbon::now(),
                    'es_manual' => false,
                ]);

                $this->info("Resultado automático guardado para {$lottery->name}: N° $number - {$animalRecord->animal}");

            } catch (\Exception $e) {
                $this->error("Error inesperado consultando {$lottery->name}: " . $e->getMessage());
                // En caso de error, marcamos que quedará para ingreso manual
                $this->manualMode($lottery, null, Carbon::now());
            }
        }

        return Command::SUCCESS;
    }

    /**
     * Marca un sorteo como manual y lo guarda para que el admin lo corrija después.
     */
    private function manualMode(Lottery $lottery, ?int $number, Carbon $fecha)
    {
        // Solo creamos registro si no existe; el admin lo completará después.
        $exists = AnimalitoSorteo::where('lottery_id', $lottery->id)
            ->where('sorteo_at', $fecha->toDateString())
            ->where('es_manual', true)
            ->exists();

        if (!$exists) {
            AnimalitoSorteo::create([
                'lottery_id' => $lottery->id,
                'number' => $number ?? 0,
                'animal' => '—',
                'sorteo_at' => $fecha,
                'es_manual' => true,
            ]);
            $this->info("Sorteo marcado como MANUAL para {$lottery->name}. El admin lo completará después.");
        }
    }
}
