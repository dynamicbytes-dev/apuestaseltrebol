<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TicketCancellationTest extends TestCase
{
    use RefreshDatabase;

    public function test_cannot_cancel_ticket_after_five_minutes(): void
    {
        $agency = Agency::create([
            'name' => 'Agencia Las Mercedes',
            'slug' => 'agencia-las-mercedes',
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

        $taquillaToken = auth('api')->login($taquilla);

        // 1. Ticket creado y transcurridos 6 minutos
        $oldTicket = Ticket::create([
            'code' => '12345678',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
            'taquilla_id' => $taquilla->id,
            'type' => Ticket::TYPE_HIPISMO,
            'stake' => 50,
            'total_odds' => 2.0,
            'potential_payout' => 100,
            'status' => Ticket::STATUS_PENDING,
        ]);
        $oldTicket->created_at = now()->subMinutes(6);
        $oldTicket->save();

        $responseOld = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$oldTicket->id}/cancel");

        $responseOld->assertStatus(422)
            ->assertJson([
                'message' => 'No se puede anular el ticket. Han transcurrido más de 5 minutos desde su emisión.',
            ]);

        $this->assertEquals(Ticket::STATUS_PENDING, $oldTicket->fresh()->status);

        // 2. Ticket recién creado (hace 2 minutos)
        $recentTicket = Ticket::create([
            'code' => '87654321',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
            'taquilla_id' => $taquilla->id,
            'type' => Ticket::TYPE_HIPISMO,
            'stake' => 50,
            'total_odds' => 2.0,
            'potential_payout' => 100,
            'status' => Ticket::STATUS_PENDING,
        ]);
        $recentTicket->created_at = now()->subMinutes(2);
        $recentTicket->save();

        $responseRecent = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$recentTicket->id}/cancel");

        $responseRecent->assertStatus(200);
        $this->assertEquals(Ticket::STATUS_CANCELLED, $recentTicket->fresh()->status);
        $this->assertNotNull($recentTicket->fresh()->cancelled_at);
    }
}
