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
 * Reglas de selección del sorteo aplicable en la validación de animalitos:
 *  - Solo cuentan los sorteos resueltos (los placeholders se descartan).
 *  - El sorteo aplicable es el primero posterior a la emisión del ticket.
 */
class AnimalitosSorteoSelectionTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $taquilla;

    private Lottery $lottery;

    private LotteryAnimal $winner;

    private LotteryAnimal $loser;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-29 09:00:00'));

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
        ]);

        $this->winner = LotteryAnimal::create([
            'lottery_id' => $this->lottery->id,
            'number' => '5',
            'animal' => 'León',
            'is_enabled' => true,
        ]);

        $this->loser = LotteryAnimal::create([
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

    private function ticketWithNumber(string $number): Ticket
    {
        $ticket = Ticket::create([
            'code' => (string) random_int(10000000, 99999999),
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->taquilla->supervisor_id,
            'taquilla_id' => $this->taquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'stake' => 10.00,
            'total_odds' => 30.00,
            'potential_payout' => 300.00,
            'status' => Ticket::STATUS_PENDING,
        ]);

        TicketSelection::create([
            'ticket_id' => $ticket->id,
            'lottery_id' => $this->lottery->id,
            'lottery_animal_id' => $number === '5' ? $this->winner->id : $this->loser->id,
            'selection_label' => 'N° '.$number,
            'odd' => 30.00,
            'metadata' => ['number' => $number],
        ]);

        return $ticket->fresh();
    }

    public function test_un_sorteo_sin_resolver_se_descarta(): void
    {
        // Placeholder pendiente: is_resolved = false. No debe validar nada.
        AnimalitoSorteo::create([
            'lottery_id' => $this->lottery->id,
            'number' => '0',
            'animal' => '—',
            'sorteo_at' => now()->addHours(1),
            'es_manual' => true,
            'is_resolved' => false,
        ]);

        $ticket = $this->ticketWithNumber('5');
        $token = auth('api')->login($this->taquilla);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", ['paid_amount' => 300.00])
            ->assertStatus(422);

        $this->assertEquals(Ticket::STATUS_PENDING, $ticket->fresh()->status);
    }

    public function test_el_sorteo_anterior_a_la_emision_no_se_usa(): void
    {
        // Sorteo de ayer: es anterior al ticket y no aplica.
        AnimalitoSorteo::create([
            'lottery_id' => $this->lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => now()->subDay(),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $ticket = $this->ticketWithNumber('5');
        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", ['paid_amount' => 300.00]);

        $response->assertStatus(422);
        $this->assertStringContainsString('aún no tiene resultados oficiales', $response->json('message'));
    }

    public function test_se_valida_contra_el_primer_sorteo_posterior_a_la_emision(): void
    {
        // Dos sorteos posteriores: el primero es el aplicable.
        AnimalitoSorteo::create([
            'lottery_id' => $this->lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => now()->addHours(2),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        AnimalitoSorteo::create([
            'lottery_id' => $this->lottery->id,
            'number' => '12',
            'animal' => 'Caballo',
            'sorteo_at' => now()->addHours(5),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        // El ticket juega el N° 12: contra el primer sorteo (N° 5) debe perder,
        // aunque el segundo sorteo haya salido 12.
        $ticket = $this->ticketWithNumber('12');
        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", ['paid_amount' => 300.00]);

        $response->assertStatus(422);
        $this->assertStringContainsString('resultó ganador el N° 5 - León', $response->json('message'));
    }

    public function test_paga_cuando_el_sorteo_posterior_coincide_con_el_numero_jugado(): void
    {
        AnimalitoSorteo::create([
            'lottery_id' => $this->lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => now()->addHours(2),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $ticket = $this->ticketWithNumber('5');
        $token = auth('api')->login($this->taquilla);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", ['paid_amount' => 300.00])
            ->assertStatus(200);

        $this->assertEquals(Ticket::STATUS_PAID, $ticket->fresh()->status);
    }
}
