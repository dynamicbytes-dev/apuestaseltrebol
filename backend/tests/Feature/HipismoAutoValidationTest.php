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

        $responsePreResult->assertStatus(422);
        $this->assertStringContainsString(
            'La carrera "1ra Carrera" aún no tiene resultados oficiales registrados.',
            $responsePreResult->json('message')
        );

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

    public function test_winner_dividend_is_registered_when_marking_winner_and_settles_tickets_with_official_dividend(): void
    {
        $admin = User::factory()->create(['role' => 'administrador']);
        $agency = Agency::create([
            'name' => 'Agencia Hipódromo',
            'slug' => 'agencia-hipodromo',
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

        // Crear carrera con caballos sin dividendo inicial prefijado (0.00)
        $race = Race::create([
            'name' => '5ta Carrera (1ra Válida)',
            'track' => 'La Rinconada',
            'meeting' => 'Reunión 45',
            'race_date' => now()->addHours(1),
            'status' => Race::STATUS_PENDING,
        ]);

        $horse1 = Horse::create([
            'race_id' => $race->id,
            'number' => 1,
            'name' => 'Catire Pedro',
            'dividend' => 0.00,
            'is_retired' => false,
        ]);

        $horse2 = Horse::create([
            'race_id' => $race->id,
            'number' => 2,
            'name' => 'Gran Omero',
            'dividend' => 0.00,
            'is_retired' => false,
        ]);

        // Taquilla emite ticket apostando Bs. 20 al caballo 1 antes de la carrera
        $ticket = Ticket::create([
            'code' => 'TKT-HIP-777',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
            'taquilla_id' => $taquilla->id,
            'type' => Ticket::TYPE_HIPISMO,
            'stake' => 20.00,
            'total_odds' => 1.00,
            'potential_payout' => 20.00,
            'status' => Ticket::STATUS_PENDING,
        ]);

        TicketSelection::create([
            'ticket_id' => $ticket->id,
            'race_id' => $race->id,
            'horse_id' => $horse1->id,
            'selection_label' => "N° {$horse1->number} - {$horse1->name}",
            'odd' => 1.00,
            'amount' => 20.00,
        ]);

        $adminToken = auth('api')->login($admin);
        $taquillaToken = auth('api')->login($taquilla);

        // Cuando la carrera finaliza, el administrador marca al caballo 1 como ganador Y registra el dividendo oficial de 4.85
        $response = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/admin/races/{$race->id}/result", [
                'winner_horse_id' => $horse1->id,
                'winner_dividend' => 4.85,
                'second_horse_id' => $horse2->id,
                'second_dividend' => 2.10,
            ]);

        $response->assertStatus(200);

        // El dividendo del caballo ganador debe haberse actualizado al oficial
        $this->assertEquals(4.85, (float) $horse1->fresh()->dividend);
        $this->assertEquals(2.10, (float) $horse2->fresh()->dividend);

        // El ticket ganador debe haber actualizado su potencial de cobro con el dividendo oficial (20 * 4.85 = 97.00)
        $this->assertEquals(97.00, (float) $ticket->fresh()->potential_payout);

        // Taquilla ahora cobra el ticket por el monto oficial
        $payResponse = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", [
                'paid_amount' => 97.00,
            ]);

        $payResponse->assertStatus(200);
        $this->assertEquals(Ticket::STATUS_PAID, $ticket->fresh()->status);
        $this->assertEquals(97.00, (float) $ticket->fresh()->paid_amount);
    }
}
