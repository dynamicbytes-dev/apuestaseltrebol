<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Horse;
use App\Models\Race;
use App\Models\Ticket;
use App\Models\TicketSelection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HipismoAutoValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_taquilla_validates_tickets_automatically_against_official_race_winner(): void
    {
        // 1. Crear Administrador y Taquilla
        $admin = User::factory()->create(['role' => 'administrador']);
        $agency = Agency::create([
            'name' => 'Agencia Centro',
            'slug' => 'agencia-centro',
        ]);
        $supervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $agency->id,
        ]);
        $taquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
        ]);

        // 2. Crear Carrera con 2 caballos
        $race = Race::create([
            'name' => '1ra Carrera',
            'track' => 'La Rinconada',
            'meeting' => 'Reunión 42',
            'race_date' => now()->addHours(2),
            'status' => Race::STATUS_PENDING,
        ]);

        $horseWinner = Horse::create([
            'race_id' => $race->id,
            'number' => 1,
            'name' => 'Gran Gladiador',
            'dividend' => 2.50,
            'is_retired' => false,
        ]);

        $horseLoser = Horse::create([
            'race_id' => $race->id,
            'number' => 2,
            'name' => 'Rayo Veloz',
            'dividend' => 3.00,
            'is_retired' => false,
        ]);

        // 3. Crear 2 tickets: uno con el caballo 1 (ganador) y otro con el caballo 2 (perdedor)
        $ticketWinning = Ticket::create([
            'code' => 'TKT-WIN-001',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
            'taquilla_id' => $taquilla->id,
            'type' => Ticket::TYPE_HIPISMO,
            'stake' => 10.00,
            'total_odds' => 2.50,
            'potential_payout' => 25.00,
            'status' => Ticket::STATUS_PENDING,
        ]);

        TicketSelection::create([
            'ticket_id' => $ticketWinning->id,
            'race_id' => $race->id,
            'horse_id' => $horseWinner->id,
            'selection_label' => "N° {$horseWinner->number} - {$horseWinner->name}",
            'odd' => 2.50,
        ]);

        $ticketLosing = Ticket::create([
            'code' => 'TKT-LOSE-002',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
            'taquilla_id' => $taquilla->id,
            'type' => Ticket::TYPE_HIPISMO,
            'stake' => 10.00,
            'total_odds' => 3.00,
            'potential_payout' => 30.00,
            'status' => Ticket::STATUS_PENDING,
        ]);

        TicketSelection::create([
            'ticket_id' => $ticketLosing->id,
            'race_id' => $race->id,
            'horse_id' => $horseLoser->id,
            'selection_label' => "N° {$horseLoser->number} - {$horseLoser->name}",
            'odd' => 3.00,
        ]);

        $taquillaToken = auth('api')->login($taquilla);
        $adminToken = auth('api')->login($admin);

        // 4. Intento de cobro en taquilla ANTES de que la carrera tenga resultados oficiales -> Debe ser rechazado
        $responsePreResult = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticketWinning->id}/pay", [
                'paid_amount' => 25.00,
            ]);

        $responsePreResult->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'La carrera "1ra Carrera" aún no tiene resultados oficiales registrados.',
            ]);

        // 5. Administrador registra el resultado oficial (Caballo 1 Ganador)
        $resultResponse = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/admin/races/{$race->id}/result", [
                'winner_horse_id' => $horseWinner->id,
                'second_horse_id' => $horseLoser->id,
            ]);

        $resultResponse->assertStatus(200);
        $this->assertEquals(Race::STATUS_FINISHED, $race->fresh()->status);
        $this->assertEquals($horseWinner->id, $race->fresh()->winner_horse_id);

        // 6. Intento de pago del ticket PERDEDOR en taquilla -> Debe ser bloqueado automáticamente
        $responseLosingPay = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticketLosing->id}/pay", [
                'paid_amount' => 30.00,
            ]);

        $responseLosingPay->assertStatus(422);
        $this->assertStringContainsString('El ticket no es ganador', $responseLosingPay->json('message'));
        $this->assertEquals(Ticket::STATUS_PENDING, $ticketLosing->fresh()->status);

        // 7. Intento de pago del ticket GANADOR en taquilla -> Debe ser aprobado y pagado automáticamente
        $responseWinningPay = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticketWinning->id}/pay", [
                'paid_amount' => 25.00,
            ]);

        $responseWinningPay->assertStatus(200);
        $this->assertEquals(Ticket::STATUS_PAID, $ticketWinning->fresh()->status);
        $this->assertEquals(25.00, (float) $ticketWinning->fresh()->paid_amount);
    }
}
