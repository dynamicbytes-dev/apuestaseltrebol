<?php

namespace Tests\Feature;

use App\Models\AnimalitoSorteo;
use App\Models\Lottery;
use App\Models\LotteryAnimal;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FetchAnimalitosCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // El comando solo corre entre las 09:00 y las 19:00: se fija la hora
        // para que el resultado no dependa de cuándo se ejecuten los tests.
        Carbon::setTestNow(Carbon::parse('2026-10-29 12:00:00'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function lotteryWithAnimals(?string $sourceUrl = null): Lottery
    {
        $lottery = Lottery::create([
            'name' => 'Lotto Activo',
            'slug' => 'lotto-activo',
            'payout_multiplier' => 30.00,
            'is_active' => true,
            'source_url' => $sourceUrl,
        ]);

        LotteryAnimal::create([
            'lottery_id' => $lottery->id,
            'number' => '00',
            'animal' => 'Delfín',
            'is_enabled' => true,
        ]);

        LotteryAnimal::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'is_enabled' => true,
        ]);

        return $lottery;
    }

    public function test_no_crea_filas_cuando_la_loteria_no_tiene_source_url(): void
    {
        $this->lotteryWithAnimals();

        $this->artisan('fetch:animalitos')
            ->assertExitCode(0);

        // Sin fuente configurada no debe existir ninguna fila: un placeholder
        // sin resultado real nunca debe llegar a la tabla de sorteos.
        $this->assertSame(0, AnimalitoSorteo::count());
    }

    public function test_registra_el_resultado_conservando_el_numero_como_texto(): void
    {
        $lottery = $this->lotteryWithAnimals('https://ejemplo.test/lotto');

        Http::fake([
            'https://ejemplo.test/*' => Http::response('N° 00 - Delfín', 200),
        ]);

        $this->artisan('fetch:animalitos')->assertExitCode(0);

        $sorteo = AnimalitoSorteo::where('lottery_id', $lottery->id)->first();

        $this->assertNotNull($sorteo);
        // "00" debe seguir siendo "00" y no convertirse en 0.
        $this->assertSame('00', $sorteo->number);
        $this->assertSame('Delfín', $sorteo->animal);
        $this->assertTrue($sorteo->is_resolved);
        $this->assertFalse($sorteo->es_manual);
    }

    public function test_la_idempotencia_esta_acotada_por_fecha(): void
    {
        $lottery = $this->lotteryWithAnimals('https://ejemplo.test/lotto');

        Http::fake([
            'https://ejemplo.test/*' => Http::response('N° 5 - León', 200),
        ]);

        $this->artisan('fetch:animalitos')->assertExitCode(0);

        $this->assertSame(1, AnimalitoSorteo::where('lottery_id', $lottery->id)->count());

        // Un día después el mismo número debe poder registrarse de nuevo:
        // el chequeo de duplicados no puede depender solo del número.
        $ayer = now()->subDay();

        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => $ayer,
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $this->artisan('fetch:animalitos')->assertExitCode(0);

        $this->assertSame(2, AnimalitoSorteo::where('lottery_id', $lottery->id)->count());
    }

    public function test_no_registra_un_sorteo_pendiente_nuevo_si_ya_hay_resultado_hoy(): void
    {
        $lottery = $this->lotteryWithAnimals('https://ejemplo.test/lotto');

        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => now(),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        Http::fake([
            'https://ejemplo.test/*' => Http::response('N° 5 - León', 200),
        ]);

        $this->artisan('fetch:animalitos')->assertExitCode(0);

        $this->assertSame(1, AnimalitoSorteo::where('lottery_id', $lottery->id)->count());
    }

    public function test_no_registra_nada_si_la_fuente_no_entrega_un_resultado_legible(): void
    {
        $lottery = $this->lotteryWithAnimals('https://ejemplo.test/lotto');

        Http::fake([
            'https://ejemplo.test/*' => Http::response('<html><body>Próximamente</body></html>', 200),
        ]);

        $this->artisan('fetch:animalitos')->assertExitCode(0);

        $this->assertSame(0, AnimalitoSorteo::where('lottery_id', $lottery->id)->count());
    }

    public function test_no_registra_el_numero_si_no_esta_habilitado_en_la_loteria(): void
    {
        $lottery = $this->lotteryWithAnimals('https://ejemplo.test/lotto');

        Http::fake([
            'https://ejemplo.test/*' => Http::response('N° 21 - Gallo', 200),
        ]);

        $this->artisan('fetch:animalitos')->assertExitCode(0);

        $this->assertSame(0, AnimalitoSorteo::where('lottery_id', $lottery->id)->count());
    }
}
