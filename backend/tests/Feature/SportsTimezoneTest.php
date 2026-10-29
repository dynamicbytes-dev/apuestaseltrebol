<?php

namespace Tests\Feature;

use App\Services\SportsApiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Las horas de los eventos deportivos son las de la operación: hora de
 * Caracas, sin importar lo que devuelva el proveedor.
 */
class SportsTimezoneTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
    }

    public function test_los_eventos_se_normalizan_a_hora_de_caracas(): void
    {
        Http::fake([
            'v3.football.api-sports.io/fixtures*' => Http::response([
                'errors' => [],
                'response' => [
                    [
                        'fixture' => [
                            'id' => 1,
                            'date' => '2026-10-29T23:00:00+00:00',
                            'status' => ['short' => 'NS', 'long' => 'Not Started'],
                        ],
                        'teams' => [
                            'home' => ['id' => 1, 'name' => 'Local'],
                            'away' => ['id' => 2, 'name' => 'Visitante'],
                        ],
                        'goals' => ['home' => null, 'away' => null],
                    ],
                ],
            ], 200),
        ]);

        $eventos = app(SportsApiService::class)->events('football', '2026-10-29');

        $this->assertCount(1, $eventos);

        // 23:00 UTC son las 19:00 en Caracas.
        $this->assertEquals('2026-10-29T19:00:00-04:00', $eventos[0]['starts_at']);
    }

    public function test_los_eventos_se_ordenan_de_forma_cronologica(): void
    {
        Http::fake([
            'v3.football.api-sports.io/fixtures*' => Http::response([
                'errors' => [],
                'response' => [
                    [
                        'fixture' => [
                            'id' => 1,
                            'date' => '2026-10-29T23:00:00+00:00',
                            'status' => ['short' => 'NS', 'long' => 'Not Started'],
                        ],
                        'teams' => [
                            'home' => ['id' => 1, 'name' => 'Tarde'],
                            'away' => ['id' => 2, 'name' => 'Visitante'],
                        ],
                        'goals' => ['home' => null, 'away' => null],
                    ],
                    [
                        'fixture' => [
                            'id' => 2,
                            'date' => '2026-10-29T20:00:00+00:00',
                            'status' => ['short' => 'NS', 'long' => 'Not Started'],
                        ],
                        'teams' => [
                            'home' => ['id' => 3, 'name' => 'Tarde'],
                            'away' => ['id' => 4, 'name' => 'Mañana'],
                        ],
                        'goals' => ['home' => null, 'away' => null],
                    ],
                ],
            ], 200),
        ]);

        $eventos = app(SportsApiService::class)->events('football', '2026-10-29');

        // El de las 20:00 UTC (16:00 Caracas) va primero, aunque su texto
        // sea posterior: el orden es cronológico, no alfabético.
        $this->assertEquals(2, $eventos[0]['id']);
        $this->assertEquals('2026-10-29T16:00:00-04:00', $eventos[0]['starts_at']);
        $this->assertEquals(1, $eventos[1]['id']);
        $this->assertEquals('2026-10-29T19:00:00-04:00', $eventos[1]['starts_at']);
    }

    public function test_los_eventos_de_nba_se_normalizan_desde_utc(): void
    {
        Http::fake([
            'v2.nba.api-sports.io/games*' => Http::response([
                'errors' => [],
                'response' => [
                    [
                        'id' => 100,
                        'date' => ['start' => '2026-10-29T23:00:00+00:00'],
                        'status' => ['short' => '1', 'long' => 'Scheduled'],
                        'teams' => [
                            'home' => ['id' => 1, 'name' => 'Hawks'],
                            'visitors' => ['id' => 2, 'name' => 'Heat'],
                        ],
                        'scores' => [
                            'home' => ['points' => 0],
                            'visitors' => ['points' => 0],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $eventos = app(SportsApiService::class)->events('nba', '2026-10-29');

        $this->assertCount(1, $eventos);
        // La NBA no admite el parámetro timezone: llega en UTC y se corrige.
        $this->assertEquals('2026-10-29T19:00:00-04:00', $eventos[0]['starts_at']);
    }

    public function test_el_resultado_del_evento_also_se_normaliza(): void
    {
        Http::fake([
            'v3.football.api-sports.io/fixtures*' => Http::response([
                'errors' => [],
                'response' => [
                    [
                        'fixture' => [
                            'id' => 55,
                            'date' => '2026-10-29T23:00:00+00:00',
                            'status' => ['short' => 'FT', 'long' => 'Match Finished'],
                        ],
                        'teams' => [
                            'home' => ['id' => 1, 'name' => 'Local'],
                            'away' => ['id' => 2, 'name' => 'Visitante'],
                        ],
                        'goals' => ['home' => 2, 'away' => 1],
                    ],
                ],
            ], 200),
        ]);

        $resultado = app(SportsApiService::class)->eventResult('football', '55');

        $this->assertTrue($resultado['found']);
        $this->assertTrue($resultado['finished']);
        $this->assertEquals(2, $resultado['home_score']);
        $this->assertEquals(1, $resultado['away_score']);
        $this->assertEquals('2026-10-29T19:00:00-04:00', $resultado['starts_at']);
    }
}
