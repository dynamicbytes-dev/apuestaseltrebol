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
}
