<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Ticket;
use App\Models\TicketMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AnimalitosBet;
use Tests\TestCase;

class TicketMovementTest extends TestCase
{
    use AnimalitosBet;
    use RefreshDatabase;

    private Agency $agency;

    private User $supervisor;

    private User $taquilla;

    protected function setUp(): void
    {
        parent::setUp();

        $this->agency = Agency::create(['name' => 'Agencia Centro', 'slug' => 'agencia-centro']);

        $this->supervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $this->agency->id,
        ]);

        $this->taquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->supervisor->id,
        ]);
    }

    private function animalitosPayloadFor($lottery): array
    {
        return $this->animalitosPayload($lottery, [
            ['animal' => $this->animalId($lottery, '5'), 'amount' => 10],
        ]);
    }

    public function test_la_emision_registra_un_movimiento(): void
    {
        $lottery = $this->lotteryWithSchedule();
        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/taquilla/tickets', $this->animalitosPayloadFor($lottery));

        $response->assertStatus(201);

        $ticketId = $response->json('data.id');

        $movement = TicketMovement::where('ticket_id', $ticketId)->first();

        $this->assertNotNull($movement);
        $this->assertEquals(TicketMovement::TYPE_CREATED, $movement->type);
        $this->assertEquals($this->taquilla->id, $movement->user_id);
        $this->assertEquals($this->agency->id, $movement->agency_id);
        $this->assertEquals(10.00, (float) $movement->amount);
        $this->assertEquals(Ticket::STATUS_PENDING, $movement->to_status);
    }

    public function test_la_anulacion_registra_un_movimiento(): void
    {
        $lottery = $this->lotteryWithSchedule();
        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/taquilla/tickets', $this->animalitosPayloadFor($lottery));

        $ticketId = $response->json('data.id');

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticketId}/cancel")
            ->assertStatus(200);

        $movement = TicketMovement::where('ticket_id', $ticketId)
            ->where('type', TicketMovement::TYPE_CANCELLED)
            ->first();

        $this->assertNotNull($movement);
        $this->assertEquals(Ticket::STATUS_CANCELLED, $movement->to_status);
    }

    public function test_la_taquilla_consulta_los_movimientos_de_su_ticket(): void
    {
        $lottery = $this->lotteryWithSchedule();
        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/taquilla/tickets', $this->animalitosPayloadFor($lottery));

        $ticketId = $response->json('data.id');

        $movements = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/taquilla/tickets/{$ticketId}/movements");

        $movements->assertStatus(200);
        $this->assertCount(1, $movements->json('data'));
        $this->assertEquals(TicketMovement::TYPE_CREATED, $movements->json('data.0.type'));
    }

    public function test_la_taquilla_no_puede_ver_los_movimientos_de_otra_taquilla(): void
    {
        $otraTaquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->supervisor->id,
        ]);

        $ticket = Ticket::create([
            'code' => '77777777',
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->supervisor->id,
            'taquilla_id' => $otraTaquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'stake' => 10,
            'total_odds' => 30,
            'potential_payout' => 300,
            'status' => Ticket::STATUS_PENDING,
        ]);

        $token = auth('api')->login($this->taquilla);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/taquilla/tickets/{$ticket->id}/movements")
            ->assertStatus(404);
    }

    public function test_el_supervisor_ve_los_tickets_de_su_agencia(): void
    {
        $lottery = $this->lotteryWithSchedule();
        $token = auth('api')->login($this->taquilla);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/taquilla/tickets', $this->animalitosPayloadFor($lottery))
            ->assertStatus(201);

        // Ticket de otra agencia: no debe aparecer.
        $otraAgencia = Agency::create(['name' => 'Agencia Norte', 'slug' => 'agencia-norte']);
        $otroSupervisor = User::factory()->create(['role' => 'supervisor', 'agency_id' => $otraAgencia->id]);
        $otraTaquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $otraAgencia->id,
            'supervisor_id' => $otroSupervisor->id,
        ]);

        Ticket::create([
            'code' => '88888888',
            'agency_id' => $otraAgencia->id,
            'supervisor_id' => $otroSupervisor->id,
            'taquilla_id' => $otraTaquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'stake' => 50,
            'total_odds' => 30,
            'potential_payout' => 1500,
            'status' => Ticket::STATUS_PENDING,
        ]);

        $supervisorToken = auth('api')->login($this->supervisor);

        $response = $this->withHeader('Authorization', "Bearer {$supervisorToken}")
            ->getJson('/api/supervisor/tickets');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals($this->agency->id, $response->json('data.0.agency_id'));
    }

    public function test_el_supervisor_filtra_los_tickets_por_estado(): void
    {
        $lottery = $this->lotteryWithSchedule();
        $token = auth('api')->login($this->taquilla);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/taquilla/tickets', $this->animalitosPayloadFor($lottery))
            ->assertStatus(201);

        $supervisorToken = auth('api')->login($this->supervisor);

        $this->withHeader('Authorization', "Bearer {$supervisorToken}")
            ->getJson('/api/supervisor/tickets?status=paid')
            ->assertStatus(200)
            ->assertJsonCount(0, 'data');

        $this->withHeader('Authorization', "Bearer {$supervisorToken}")
            ->getJson('/api/supervisor/tickets?status=pending')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }
}
