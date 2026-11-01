<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Ticket;
use App\Models\TicketSelection;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AnimalitosBet;
use Tests\TestCase;

/**
 * La apuesta de animalitos declara a qué sorteo pertenece. El cobro se
 * valida contra ese sorteo exacto, nunca contra otro.
 */
class AnimalitosValidationTest extends TestCase
{
    use AnimalitosBet;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // 08:00: el sorteo de las 09:00 todavía no ha ocurrido.
        Carbon::setTestNow(Carbon::parse('2026-10-29 08:00:00'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function ticketConApuesta(string $number, float $amount = 10.00): Ticket
    {
        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['09:00']);
        $admin = User::factory()->create(['role' => 'administrador']);
        $agency = Agency::create(['name' => 'Agencia Centro', 'slug' => 'agencia-centro']);
        $supervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $agency->id,
        ]);
        $taquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
        ]);

        $ticket = Ticket::create([
            'code' => '55555555',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
            'taquilla_id' => $taquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'sorteo_at' => Carbon::parse('2026-10-29 09:00:00'),
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
            'metadata' => [
                'lottery' => $lottery->name,
                'number' => $number,
                'animal' => $lottery->animals()->firstWhere('number', $number)?->animal,
            ],
        ]);

        return $ticket->fresh()->load('selections');
    }

    public function test_taquilla_validates_animalitos_tickets_against_manual_official_results(): void
    {
        $admin = User::factory()->create(['role' => 'administrador']);
        $agency = Agency::create(['name' => 'Agencia Centro', 'slug' => 'agencia-centro']);
        $supervisor = User::factory()->create(['role' => 'supervisor', 'agency_id' => $agency->id]);
        $taquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
        ]);

        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['09:00']);

        $animalWinner = $lottery->animals()->firstWhere('number', '5');
        $animalLoser = $lottery->animals()->firstWhere('number', '12');

        $buildTicket = function (string $code, $animal, string $number) use (
            $agency, $supervisor, $taquilla, $lottery
        ) {
            $ticket = Ticket::create([
                'code' => $code,
                'agency_id' => $agency->id,
                'supervisor_id' => $supervisor->id,
                'taquilla_id' => $taquilla->id,
                'type' => Ticket::TYPE_ANIMALITOS,
                'sorteo_at' => Carbon::parse('2026-10-29 09:00:00'),
                'stake' => 10.00,
                'total_odds' => 30.00,
                'potential_payout' => 300.00,
                'status' => Ticket::STATUS_PENDING,
            ]);

            TicketSelection::create([
                'ticket_id' => $ticket->id,
                'lottery_id' => $lottery->id,
                'lottery_animal_id' => $animal->id,
                'selection_label' => 'N° '.$number,
                'odd' => 30.00,
                'amount' => 10.00,
                'metadata' => ['lottery' => $lottery->name, 'number' => $number],
            ]);

            return $ticket->fresh();
        };

        $ticketWinning = $buildTicket('55555555', $animalWinner, '5');
        $ticketLosing = $buildTicket('66666666', $animalLoser, '12');

        $taquillaToken = auth('api')->login($taquilla);
        $adminToken = auth('api')->login($admin);

        // 1. Intento de cobro antes de registrar el sorteo oficial -> rechazado
        $responsePre = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticketWinning->id}/pay", [
                'paid_amount' => 300.00,
            ]);

        $responsePre->assertStatus(422);
        $this->assertStringContainsString('aún no tiene resultado oficial', $responsePre->json('message'));

        // 2. El administrador registra el resultado de ese mismo sorteo
        $responseAdmin = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->postJson('/api/admin/animalitos/sorteos', [
                'lottery_id' => $lottery->id,
                'sorteo_date' => '2026-10-29',
                'sorteo_time' => '09:00',
                'lottery_animal_id' => $animalWinner->id,
            ]);

        $responseAdmin->assertStatus(201);
        $this->assertDatabaseHas('animalito_sorteos', [
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
        ]);

        // 3. El ticket perdedor se rechaza con el ganador oficial
        $responseLoser = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticketLosing->id}/pay", [
                'paid_amount' => 300.00,
            ]);

        $responseLoser->assertStatus(422);
        $this->assertStringContainsString('El ticket no es ganador', $responseLoser->json('message'));
        $this->assertStringContainsString('resultó ganador el N° 5 - León', $responseLoser->json('message'));

        // 4. El ticket ganador se paga
        $responseWinner = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticketWinning->id}/pay", [
                'paid_amount' => 300.00,
            ]);

        $responseWinner->assertStatus(200);
        $this->assertEquals(Ticket::STATUS_PAID, $ticketWinning->fresh()->status);
        $this->assertEquals(300.00, (float) $ticketWinning->fresh()->paid_amount);
    }

    public function test_animalitos_ticket_with_multiple_animals_pays_only_the_winning_selection(): void
    {
        $admin = User::factory()->create(['role' => 'administrador']);
        $agency = Agency::create(['name' => 'Agencia Multi', 'slug' => 'agencia-multi']);
        $supervisor = User::factory()->create(['role' => 'supervisor', 'agency_id' => $agency->id]);
        $taquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
        ]);

        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['10:00']);
        $animalWinner = $lottery->animals()->firstWhere('number', '5');
        $animalLoser = $lottery->animals()->firstWhere('number', '12');

        // Jugador apuesta Bs. 5 al animalito 12 y Bs. 20 al animalito 5 (Total Bs. 25)
        $ticket = Ticket::create([
            'code' => '77777777',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
            'taquilla_id' => $taquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'sorteo_at' => Carbon::parse('2026-10-29 10:00:00'),
            'stake' => 25.00,
            'total_odds' => 30.00,
            'potential_payout' => 600.00, // 20 * 30
            'status' => Ticket::STATUS_PENDING,
        ]);

        $selLoser = TicketSelection::create([
            'ticket_id' => $ticket->id,
            'lottery_id' => $lottery->id,
            'lottery_animal_id' => $animalLoser->id,
            'selection_label' => 'N° 12 - Caballo',
            'odd' => 30.00,
            'amount' => 5.00,
            'metadata' => ['lottery' => $lottery->name, 'number' => '12'],
        ]);

        $selWinner = TicketSelection::create([
            'ticket_id' => $ticket->id,
            'lottery_id' => $lottery->id,
            'lottery_animal_id' => $animalWinner->id,
            'selection_label' => 'N° 5 - León',
            'odd' => 30.00,
            'amount' => 20.00,
            'metadata' => ['lottery' => $lottery->name, 'number' => '5'],
        ]);

        $adminToken = auth('api')->login($admin);
        $taquillaToken = auth('api')->login($taquilla);

        // Administrador registra el resultado oficial del sorteo: Gana el 10
        $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->postJson('/api/admin/animalitos/sorteos', [
                'lottery_id' => $lottery->id,
                'sorteo_date' => '2026-10-29',
                'sorteo_time' => '10:00',
                'lottery_animal_id' => $animalWinner->id,
            ])
            ->assertStatus(201);

        // Consultamos la liquidación: el ticket debe ser ganador, pero pagar ÚNICAMENTE los 20 * 30 = 600 Bs
        $settlementResponse = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->getJson("/api/taquilla/tickets/{$ticket->id}/settlement");

        $settlementResponse->assertStatus(200);
        $this->assertEquals(Ticket::SETTLEMENT_WON, $settlementResponse->json('data.status'));
        $this->assertEquals(600.00, (float) $settlementResponse->json('data.payable'));

        // Las patas reflejan el resultado de cada animalito
        $legs = $settlementResponse->json('data.legs');
        $legLoser = collect($legs)->firstWhere('selection_id', $selLoser->id);
        $legWinner = collect($legs)->firstWhere('selection_id', $selWinner->id);
        $this->assertEquals(TicketSelection::SETTLEMENT_LOST, $legLoser['status']);
        $this->assertEquals(0.00, (float) $legLoser['payout']);
        $this->assertEquals(TicketSelection::SETTLEMENT_WON, $legWinner['status']);
        $this->assertEquals(600.00, (float) $legWinner['payout']);

        // Cobro en taquilla: si intenta cobrar más de 600 (ej: 750, como si la jugada perdedora también pagara), debe ser rechazado
        $overPayResponse = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", [
                'paid_amount' => 750.00,
            ]);
        $overPayResponse->assertStatus(422);

        // Cobro del monto exacto de la jugada ganadora (600 Bs): debe procesarse exitosamente
        $payResponse = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", [
                'paid_amount' => 600.00,
            ]);
        $payResponse->assertStatus(200);
        $this->assertEquals(Ticket::STATUS_PAID, $ticket->fresh()->status);
        $this->assertEquals(600.00, (float) $ticket->fresh()->paid_amount);
    }
}
