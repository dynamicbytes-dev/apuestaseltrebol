<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\AnimalitoSorteo;
use App\Models\Lottery;
use App\Models\LotteryAnimal;
use App\Models\Ticket;
use App\Models\TicketSelection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnimalitosValidationTest extends TestCase
{
    use RefreshDatabase;

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

        $lottery = Lottery::create([
            'name' => 'Lotto Activo',
            'slug' => 'lotto-activo',
            'payout_multiplier' => 30.00,
            'is_active' => true,
        ]);

        $animalWinner = LotteryAnimal::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'is_enabled' => true,
        ]);

        $animalLoser = LotteryAnimal::create([
            'lottery_id' => $lottery->id,
            'number' => '12',
            'animal' => 'Caballo',
            'is_enabled' => true,
        ]);

        // Ticket con el León (ganador eventual)
        $ticketWinning = Ticket::create([
            'code' => '55555555',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
            'taquilla_id' => $taquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'stake' => 10.00,
            'total_odds' => 30.00,
            'potential_payout' => 300.00,
            'status' => Ticket::STATUS_PENDING,
        ]);
        TicketSelection::create([
            'ticket_id' => $ticketWinning->id,
            'lottery_id' => $lottery->id,
            'lottery_animal_id' => $animalWinner->id,
            'selection_label' => 'N° 5 - León',
            'odd' => 30.00,
            'metadata' => [
                'lottery' => 'Lotto Activo',
                'number' => '5',
                'animal' => 'León',
            ],
        ]);

        // Ticket con el Caballo (perdedor eventual)
        $ticketLosing = Ticket::create([
            'code' => '66666666',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
            'taquilla_id' => $taquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'stake' => 10.00,
            'total_odds' => 30.00,
            'potential_payout' => 300.00,
            'status' => Ticket::STATUS_PENDING,
        ]);
        TicketSelection::create([
            'ticket_id' => $ticketLosing->id,
            'lottery_id' => $lottery->id,
            'lottery_animal_id' => $animalLoser->id,
            'selection_label' => 'N° 12 - Caballo',
            'odd' => 30.00,
            'metadata' => [
                'lottery' => 'Lotto Activo',
                'number' => '12',
                'animal' => 'Caballo',
            ],
        ]);

        $taquillaToken = auth('api')->login($taquilla);
        $adminToken = auth('api')->login($admin);

        // 1. Intento de cobro antes de registrar el sorteo oficial -> Debe ser rechazado (422)
        $responsePre = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticketWinning->id}/pay", [
                'paid_amount' => 300.00,
            ]);

        $responsePre->assertStatus(422)
            ->assertJson([
                'message' => 'La lotería "Lotto Activo" aún no tiene resultados oficiales registrados por la administración para hoy.',
            ]);

        // 2. Administrador registra manualmente el sorteo oficial: Ganador N° 5 - León
        $responseAdmin = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->postJson('/api/admin/animalitos/sorteos', [
                'lottery_id' => $lottery->id,
                'sorteo_date' => now()->toDateString(),
                'sorteo_time' => '10:00',
                'lottery_animal_id' => $animalWinner->id,
            ]);

        $responseAdmin->assertStatus(201);
        $this->assertDatabaseHas('animalito_sorteos', [
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
        ]);

        // 3. Intento de cobro del ticket PERDEDOR -> Debe ser rechazado con mensaje del ganador oficial
        $responseLoser = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticketLosing->id}/pay", [
                'paid_amount' => 300.00,
            ]);

        $responseLoser->assertStatus(422)
            ->assertJson([
                'message' => 'El ticket no es ganador. En el sorteo oficial de Lotto Activo resultó ganador el N° 5 - León.',
            ]);

        // 4. Intento de cobro del ticket GANADOR -> Debe ser APROBADO (200)
        $responseWinner = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticketWinning->id}/pay", [
                'paid_amount' => 300.00,
            ]);

        $responseWinner->assertStatus(200);
        $this->assertEquals(Ticket::STATUS_PAID, $ticketWinning->fresh()->status);
        $this->assertEquals(300.00, (float) $ticketWinning->fresh()->paid_amount);
    }
}
