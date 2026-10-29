<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\AnimalitoSorteo;
use App\Models\Lottery;
use App\Models\LotteryAnimal;
use App\Models\Ticket;
use App\Models\TicketSelection;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * La lista de tickets debe mostrar el resultado real de la liquidacion
 * (ganador o perdedor) y no solo "pendiente".
 */
class TicketListSettlementTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $taquilla;

    private Lottery $lottery;

    private LotteryAnimal $ganador;

    private LotteryAnimal $perdedor;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-29 08:00:00'));

        $this->agency = Agency::create(['name' => 'Agencia Centro', 'slug' => 'agencia-centro']);

        $supervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $this->agency->id,
        ]);

        $this->taquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $this->agency->id,
            'supervisor_id' => $supervisor->id,
        ]);

        $this->lottery = Lottery::create([
            'name' => 'Lotto Activo',
            'slug' => 'lotto-activo',
            'payout_multiplier' => 30.00,
            'is_active' => true,
            'draw_times' => ['09:00', '19:00'],
        ]);

        $this->ganador = LotteryAnimal::create([
            'lottery_id' => $this->lottery->id,
            'number' => '5',
            'animal' => 'León',
            'is_enabled' => true,
        ]);

        $this->perdedor = LotteryAnimal::create([
            'lottery_id' => $this->lottery->id,
            'number' => '12',
            'animal' => 'Caballo',
            'is_enabled' => true,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    /**
     * Emite un ticket de animalitos para el sorteo de las 19:00 de hoy.
     */
    private function ticket(string $number, string $code): Ticket
    {
        $animal = $number === '5' ? $this->ganador : $this->perdedor;

        $ticket = Ticket::create([
            'code' => $code,
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->taquilla->supervisor_id,
            'taquilla_id' => $this->taquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'stake' => 50.00,
            'total_odds' => 30.00,
            'potential_payout' => 1500.00,
            'status' => Ticket::STATUS_PENDING,
        ]);

        TicketSelection::create([
            'ticket_id' => $ticket->id,
            'lottery_id' => $this->lottery->id,
            'lottery_animal_id' => $animal->id,
            'selection_label' => 'N° '.$number,
            'odd' => 30.00,
            'amount' => 50.00,
            'metadata' => ['lottery' => 'Lotto Activo', 'number' => $number],
        ]);

        return $ticket->fresh();
    }

    public function test_la_lista_marca_el_ticket_perdedor(): void
    {
        // Salio el N° 5: el ticket que juega el N° 12 es perdedor.
        AnimalitoSorteo::create([
            'lottery_id' => $this->lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $this->ticket('12', '11111111');

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->getJson('/api/taquilla/tickets');

        $response->assertStatus(200);

        $row = $response->json('data.0');

        // El estado del pago sigue siendo pendiente...
        $this->assertEquals(Ticket::STATUS_PENDING, $row['status']);
        // ...pero la liquidacion dice que es perdedor, y se ve en la tabla.
        $this->assertEquals(Ticket::SETTLEMENT_LOST, $row['settlement_status']);
        $this->assertStringContainsString('no es ganador', (string) $row['settlement_note']);
    }

    public function test_la_lista_marca_el_ticket_ganador(): void
    {
        AnimalitoSorteo::create([
            'lottery_id' => $this->lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $this->ticket('5', '22222222');

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->getJson('/api/taquilla/tickets');

        $response->assertStatus(200);

        $this->assertEquals(Ticket::SETTLEMENT_WON, $response->json('data.0.settlement_status'));
    }

    public function test_sin_resultado_oficial_queda_pendiente_de_resultado(): void
    {
        $this->ticket('5', '33333333');

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->getJson('/api/taquilla/tickets');

        $response->assertStatus(200);

        $this->assertEquals(Ticket::SETTLEMENT_PENDING, $response->json('data.0.settlement_status'));
    }

    public function test_la_lista_no_toca_la_decision_manual_del_supervisor(): void
    {
        AnimalitoSorteo::create([
            'lottery_id' => $this->lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $ticket = $this->ticket('12', '44444444');

        // El supervisor lo reviso a mano y lo dio por ganador.
        $ticket->update([
            'settlement_status' => Ticket::SETTLEMENT_WON,
            'settlement_note' => 'Revisado a mano.',
            'settlement_source' => 'manual',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->getJson('/api/taquilla/tickets');

        $response->assertStatus(200);

        $this->assertEquals(Ticket::SETTLEMENT_WON, $response->json('data.0.settlement_status'));
        $this->assertEquals('manual', $response->json('data.0.settlement_source'));
    }
}
