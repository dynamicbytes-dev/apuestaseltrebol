<?php

namespace Tests\Feature;

use App\Models\AnimalitoSorteo;
use App\Models\Lottery;
use App\Models\LotteryAnimal;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Prueba de integración del comando contra un servidor HTTP real.
 *
 * A diferencia del resto de pruebas del comando, aquí no se usa Http::fake:
 * se levanta un servidor HTTP local y se comprueba el recorrido completo
 * (petición real -> parseo -> alta del sorteo).
 */
class FetchAnimalitosHttpTest extends TestCase
{
    use RefreshDatabase;

    /** @var resource|null */
    private static $server = null;

    private static int $port = 0;

    private static string $docroot = '';

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        self::$port = 8300 + random_int(100, 900);
        self::$docroot = sys_get_temp_dir().'/eltrebol-fixture-'.getmypid();

        if (! is_dir(self::$docroot)) {
            mkdir(self::$docroot, 0777, true);
        }

        // La fuente imita la estructura de una página de resultados: el
        // número viene con cero a la izquierda, que es como lo publican.
        file_put_contents(self::$docroot.'/index.html', <<<'HTML'
            <!DOCTYPE html>
            <html lang="es">
            <body>
                <h1>Resultados del sorteo</h1>
                <p>Ganador: N° 05 - León</p>
                <span class="numero">05</span>
            </body>
            </html>
            HTML);

        $descriptors = [
            0 => ['file', '/dev/null', 'r'],
            1 => ['file', '/dev/null', 'w'],
            2 => ['file', '/dev/null', 'w'],
        ];

        self::$server = proc_open(
            [PHP_BINARY, '-S', '127.0.0.1:'.self::$port, '-t', self::$docroot],
            $descriptors,
            $pipes
        );
    }

    public static function tearDownAfterClass(): void
    {
        if (is_resource(self::$server)) {
            proc_terminate(self::$server);
            proc_close(self::$server);
        }

        @unlink(self::$docroot.'/index.html');
        @rmdir(self::$docroot);

        parent::tearDownAfterClass();
    }

    protected function setUp(): void
    {
        parent::setUp();

        if (! $this->serverIsUp()) {
            $this->markTestSkipped('No se pudo levantar el servidor HTTP local.');
        }

        Carbon::setTestNow(Carbon::parse('2026-10-29 10:05:00'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function serverIsUp(): bool
    {
        $connection = @fsockopen('127.0.0.1', self::$port, $errno, $errstr, 0.3);

        if ($connection) {
            fclose($connection);

            return true;
        }

        // Puede necesitar un instante extra para levantar.
        for ($i = 0; $i < 20; $i++) {
            usleep(100000);

            $connection = @fsockopen('127.0.0.1', self::$port, $errno, $errstr, 0.3);

            if ($connection) {
                fclose($connection);

                return true;
            }
        }

        return false;
    }

    public function test_el_comando_descarga_y_registra_el_resultado_desde_una_fuente_real(): void
    {
        $lottery = Lottery::create([
            'name' => 'Lotto Activo',
            'slug' => 'lotto-activo',
            'payout_multiplier' => 30.00,
            'is_active' => true,
            'source_url' => 'http://127.0.0.1:'.self::$port.'/index.html',
        ]);

        LotteryAnimal::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'is_enabled' => true,
        ]);

        $this->artisan('fetch:animalitos')->assertExitCode(0);

        $sorteo = AnimalitoSorteo::where('lottery_id', $lottery->id)->first();

        $this->assertNotNull($sorteo);
        // La fuente publica "05": se normaliza al número canónico de la
        // lotería, que es "5".
        $this->assertSame('5', $sorteo->number);
        $this->assertSame('León', $sorteo->animal);
        $this->assertTrue($sorteo->is_resolved);
        $this->assertFalse($sorteo->es_manual);
    }
}
