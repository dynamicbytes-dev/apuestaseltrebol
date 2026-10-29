<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\AnimalitoSorteo;
use App\Models\Ticket;
use App\Models\TicketSelection;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AnimalitosBet;
use Tests\TestCase;

/**
 * Regresión del defecto reportado: una apuesta hecha a las 18:30 se validaba
 * contra el sorteo de las 09:00 del mismo día.
 *
 * Ahora el ticket declara a qué sorteo pertenece y la validación busca
 * exactamente ese sorteo.
 */
class AnimalitosDrawTimeTest extends TestCase
{
    use AnimalitosBet;
    use RefreshDatabase;

    private Agency $agency;

    private User $taquilla;

    protected function setUp(): void
    {
        parent::setUp();

        // 18:30: la apuesta se emite después del sorteo de las 09:00.
        Carbon::setTestNow(Carbon::parse('2026-10-29 18:30:00'));

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
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    /**
     * Emite un ticket de animalitos para un sorteo concreto.
     */
    private function ticketParaSorteo($lottery, string $sorteoAt, string $number = '5', float $amount = 50.00): Ticket
    {
        $ticket = Ticket::create([
            'code' => (string) random_int(10000000, 99999999),
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->taquilla->supervisor_id,
            'taquilla_id' => $this->taquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'sorteo_at' => Carbon::parse($sorteoAt),
            'stake' => $amount,
            'total_odds' => 30.00,
            'potential_payout' => $amount * 30,
            'status' => Ticket::STATUS_PENDING,
        ]);

        TicketSelection::create([
            'ticket_id' => $ticket->id,
            'lottery_id' => $lottery->id,
            'lottery_animal_id' => $this->animalId($lottery, $number),
            'selection_label' => 'N° '.$number,
            'odd' => 30.00,
            'amount' => $amount,
            'metadata' => ['lottery' => $lottery->name, 'number' => $number],
        ]);

        return $ticket->fresh();
    }

    public function test_el_ticket_no_se_valida_contra_el_sorteo_de_otra_hora(): void
    {
        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['09:00', '19:00']);

        // El resultado de la mañana salió el número 5: es el número jugado.
        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 09:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        // La apuesta es de la noche: no puede validar contra el de la mañana.
        $ticket = $this->ticketParaSorteo($lottery, '2026-10-29 19:00:00');

        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", ['paid_amount' => 1500.00]);

        $response->assertStatus(422);
        $this->assertStringContainsString('aún no tiene resultado oficial', $response->json('message'));
        $this->assertEquals(Ticket::STATUS_PENDING, $ticket->fresh()->status);
    }

    public function test_el_ticket_se_valida_contra_el_sorteo_que_declara(): void
    {
        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['09:00', '19:00']);

        // El sorteo de la mañana salió 12; el de la noche salió 5.
        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => '12',
            'animal' => 'Caballo',
            'sorteo_at' => Carbon::parse('2026-10-29 09:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $ticket = $this->ticketParaSorteo($lottery, '2026-10-29 19:00:00');

        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", ['paid_amount' => 1500.00]);

        $response->assertStatus(200);
        $this->assertEquals(Ticket::STATUS_PAID, $ticket->fresh()->status);
    }

    public function test_un_sorteo_sin_resolver_se_descarta(): void
    {
        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['09:00', '19:00']);

        // Placeholder pendiente: no debe validar nada.
        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'es_manual' => true,
            'is_resolved' => false,
        ]);

        $ticket = $this->ticketParaSorteo($lottery, '2026-10-29 19:00:00');

        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", ['paid_amount' => 1500.00]);

        $response->assertStatus(422);
        $this->assertEquals(Ticket::STATUS_PENDING, $ticket->fresh()->status);
    }

    public function test_la_vista_previa_informa_cuanto_se_paga(): void
    {
        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['09:00', '19:00']);

        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $ticket = $this->ticketParaSorteo($lottery, '2026-10-29 19:00:00');

        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/taquilla/tickets/{$ticket->id}/settlement");

        $response->assertStatus(200);
        $this->assertEquals('won', $response->json('data.status'));
        $this->assertEquals(1500.00, (float) $response->json('data.payable'));
        $this->assertCount(1, $response->json('data.legs'));
        $this->assertEquals('won', $response->json('data.legs.0.status'));
    }
}
