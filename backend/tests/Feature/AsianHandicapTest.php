<?php

namespace Tests\Feature;

use App\Models\TicketSelection;
use App\Services\SportsSettlementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * El handicap asiatico se liquida automaticamente con el marcador final.
 */
class AsianHandicapTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{status: string, payable: float, legs: array, note: string}
     */
    private function liquidar(string $label, int $homeScore, int $awayScore, string $market = 'Asian Handicap'): array
    {
        $service = app(SportsSettlementService::class);

        $reflexion = new \ReflectionMethod($service, 'evaluate');
        $reflexion->setAccessible(true);

        $selection = new TicketSelection([
            'selection_label' => $label,
            'market' => $market,
            'odd' => 2.0,
            'amount' => 10,
        ]);

        $resultado = $reflexion->invoke($service, $selection, [
            'home_score' => $homeScore,
            'away_score' => $awayScore,
            'home_name' => 'Local',
            'away_name' => 'Visitante',
        ]);

        return [
            'status' => $resultado === true ? 'won' : ($resultado === false ? 'lost' : 'review'),
            'payable' => $resultado === true ? 20.0 : 0.0,
            'legs' => [],
            'note' => '',
        ];
    }

    public function test_el_favorito_gana_con_la_linea_de_handicap(): void
    {
        // Local -1 y gana 2-0: diferencia 2, ajustada 1 > 0: gana.
        $this->assertEquals('won', $this->liquidar('Home -1', 2, 0)['status']);

        // Local -1 y gana 3-0: diferencia 3, ajustada 2 > 0: gana.
        $this->assertEquals('won', $this->liquidar('Home -1', 3, 0)['status']);
    }

    public function test_el_favorito_no_llega_a_la_linea(): void
    {
        // Local -1 y gana 1-0: diferencia 1, ajustada 0: empate en la linea.
        $this->assertEquals('review', $this->liquidar('Home -1', 1, 0)['status']);

        // Local -1 y empata 1-1: diferencia 0, ajustada -1: pierde.
        $this->assertEquals('lost', $this->liquidar('Home -1', 1, 1)['status']);
    }

    public function test_la_linea_de_cuarto_se_reparte_entre_dos_lineas(): void
    {
        // Local -1.25 son dos lineas: -1 y -1.5.
        // Con 2-0 la diferencia es 2: ajustada 1 y 0.5, las dos ganan.
        $this->assertEquals('won', $this->liquidar('Home -1.25', 2, 0)['status']);

        // Con 1-0 la diferencia es 1: ajustada 0 (empate) y -0.5 (pierde).
        $this->assertEquals('lost', $this->liquidar('Home -1.25', 1, 0)['status']);
    }

    public function test_el_habilitado_a_favor_gana_casi_siempre(): void
    {
        // Visitante +0.5 con 0-1: diferencia -1, ajustada -0.5: gana elAway.
        $this->assertEquals('won', $this->liquidar('Away +0.5', 0, 1)['status']);

        // Local +0.5 con 1-1: diferencia 0, ajustada 0.5: gana.
        $this->assertEquals('won', $this->liquidar('Home +0.5', 1, 1)['status']);
    }

    public function test_una_etiqueta_sin_handicap_no_se_liquida_con_esta_regla(): void
    {
        $this->assertEquals('review', $this->liquidar('Home', 2, 0)['status']);
    }
}
