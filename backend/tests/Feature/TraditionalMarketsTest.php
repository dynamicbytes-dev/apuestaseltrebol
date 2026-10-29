<?php

namespace Tests\Feature;

use App\Models\Race;
use App\Models\TicketSelection;
use App\Models\User;
use App\Services\SportsApiService;
use App\Services\SportsSettlementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Mercados tradicionales y liquidacion de los totales por equipo.
 */
class TraditionalMarketsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
    }

    /**
     * Simula un partido con los mercados que publica el proveedor.
     */
    private function fakeOdds(): void
    {
        Http::fake([
            'v3.football.api-sports.io/odds*' => Http::response([
                'errors' => [],
                'response' => [[
                    'update' => '2026-10-29T10:00:00+00:00',
                    'bookmakers' => [[
                        'id' => 8,
                        'name' => 'Bet365',
                        'bets' => [
                            ['id' => 1, 'name' => 'Match Winner', 'values' => [
                                ['value' => 'Home', 'odd' => '1.71'],
                                ['value' => 'Draw', 'odd' => '3.68'],
                                ['value' => 'Away', 'odd' => '3.82'],
                            ]],
                            ['id' => 2, 'name' => 'Home/Away', 'values' => [
                                ['value' => 'Home', 'odd' => '1.55'],
                                ['value' => 'Away', 'odd' => '2.40'],
                            ]],
                            ['id' => 5, 'name' => 'Goals Over/Under', 'values' => [
                                ['value' => 'Over 1.5', 'odd' => '1.16'],
                                ['value' => 'Under 1.5', 'odd' => '4.10'],
                            ]],
                            ['id' => 8, 'name' => 'Both Teams Score', 'values' => [
                                ['value' => 'Yes', 'odd' => '1.59'],
                                ['value' => 'No', 'odd' => '2.15'],
                            ]],
                            ['id' => 12, 'name' => 'Double Chance', 'values' => [
                                ['value' => 'Home/Draw', 'odd' => '1.17'],
                                ['value' => 'Home/Away', 'odd' => '1.18'],
                                ['value' => 'Draw/Away', 'odd' => '1.88'],
                            ]],
                            ['id' => 13, 'name' => 'First Half Winner', 'values' => [
                                ['value' => 'Home', 'odd' => '2.27'],
                                ['value' => 'Draw', 'odd' => '2.28'],
                                ['value' => 'Away', 'odd' => '4.20'],
                            ]],
                            ['id' => 10, 'name' => 'Exact Score', 'values' => [
                                ['value' => '1:0', 'odd' => '7.70'],
                                ['value' => '2:1', 'odd' => '7.20'],
                            ]],
                            ['id' => 21, 'name' => 'Odd/Even', 'values' => [
                                ['value' => 'Odd', 'odd' => '1.83'],
                                ['value' => 'Even', 'odd' => '1.83'],
                            ]],
                        ],
                    ]],
                ]],
            ], 200),
        ]);
    }

    public function test_solo_se_muestran_los_mercados_tradicionales(): void
    {
        $this->fakeOdds();

        $cuotas = app(SportsApiService::class)->odds('football', '55');

        $nombres = collect($cuotas['markets'])->pluck('name')->all();

        // Los cinco tradicionales del fútbol.
        $this->assertContains('Match Winner', $nombres);
        $this->assertContains('Home/Away', $nombres);
        $this->assertContains('Goals Over/Under', $nombres);
        $this->assertContains('Both Teams Score', $nombres);
        $this->assertContains('Double Chance', $nombres);

        // Los exóticos quedan fuera.
        $this->assertNotContains('First Half Winner', $nombres);
        $this->assertNotContains('Exact Score', $nombres);
        $this->assertNotContains('Odd/Even', $nombres);

        $this->assertCount(5, $cuotas['markets']);
    }

    public function test_los_mercados_tradicionales_se_configuran_por_deporte(): void
    {
        // El identificador del mercado cambia entre deportes.
        $this->assertContains(1, config('sports.traditional_markets.football'));
        $this->assertContains(14, config('sports.traditional_markets.baseball'));
        $this->assertContains(4, config('sports.traditional_markets.basketball'));
        $this->assertContains(10, config('sports.traditional_markets.hockey'));
    }

    /**
     * Un total de un solo equipo se liquida contra ese equipo, no contra
     * la suma de los dos.
     */
    public function test_el_total_de_un_equipo_se_liquida_contra_ese_equipo(): void
    {
        $service = app(SportsSettlementService::class);

        // Local 2, visitante 1: el local no llega a 2.5 goles.
        $resultado = $this->evaluar($service, 'Total - Home', 'Over 2.5', 2, 1);
        $this->assertFalse($resultado, 'El total del local (2) no supera 2.5.');

        // El visitante tampoco llega a 2.5.
        $resultado = $this->evaluar($service, 'Total - Away', 'Over 2.5', 2, 1);
        $this->assertFalse($resultado, 'El total del visitante (1) no supera 2.5.');

        // El total del partido si llega: 2 + 1 = 3.
        $resultado = $this->evaluar($service, 'Goals Over/Under', 'Over 2.5', 2, 1);
        $this->assertTrue($resultado, 'El total del partido (3) supera 2.5.');
    }

    /**
     * Los totales de una parte del partido no se liquidan con el total del
     * partido: van a revision.
     */
    public function test_un_total_de_primer_tiempo_no_se_liquida_con_el_total_del_partido(): void
    {
        $service = app(SportsSettlementService::class);

        $resultado = $this->evaluar($service, 'Goals Over/Under First Half', 'Over 1.5', 2, 1);

        $this->assertNull($resultado, 'Un total de primer tiempo no se puede liquidar solo.');
    }

    /**
     * Evalua una regla de la liquidacion a traves del servicio publico.
     */
    private function evaluar(
        SportsSettlementService $service,
        string $market,
        string $label,
        int $homeScore,
        int $awayScore
    ): ?bool {
        $reflexion = new \ReflectionMethod($service, 'evaluate');
        $reflexion->setAccessible(true);

        $selection = new TicketSelection([
            'selection_label' => $label,
            'market' => $market,
            'odd' => 2.0,
            'amount' => 10,
        ]);
        $selection->metadata = ['number' => '5'];

        $result = $reflexion->invoke($service, $selection, [
            'home_score' => $homeScore,
            'away_score' => $awayScore,
            'home_name' => 'Local',
            'away_name' => 'Visitante',
        ]);

        return $result;
    }

    public function test_el_filtro_de_reuniones_devuelve_las_reuniones_de_hipismo(): void
    {
        $admin = User::factory()->create(['role' => 'administrador']);

        Race::create([
            'name' => '1ra Carrera',
            'meeting' => 'Reunión 12',
            'race_date' => now()->addHours(3),
            'status' => Race::STATUS_PENDING,
        ]);

        Race::create([
            'name' => '2da Carrera',
            'meeting' => 'Reunión 13',
            'race_date' => now()->addHours(4),
            'status' => Race::STATUS_PENDING,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($admin))
            ->getJson('/api/results/reuniones');

        $response->assertStatus(200);
        $this->assertEquals(['Reunión 12', 'Reunión 13'], $response->json('data'));
    }
}
