<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Ticket;
use App\Models\TicketSelection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ParleySettlementTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $supervisor;

    private User $taquilla;

    protected function setUp(): void
    {
        parent::setUp();

        $this->agency = Agency::create([
            'name' => 'Agencia Centro',
            'slug' => 'agencia-centro',
        ]);

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

    /**
     * Crea un ticket de parley con las selecciones indicadas.
     *
     * @param  array<int, array<string, mixed>>  $legs
     */
    private function parleyTicket(array $legs, string $code = '11111111'): Ticket
    {
        $ticket = Ticket::create([
            'code' => $code,
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->supervisor->id,
            'taquilla_id' => $this->taquilla->id,
            'type' => Ticket::TYPE_PARLEY,
            'stake' => 10.00,
            'total_odds' => 4.00,
            'potential_payout' => 40.00,
            'status' => Ticket::STATUS_PENDING,
        ]);

        foreach ($legs as $leg) {
            TicketSelection::create(array_merge([
                'ticket_id' => $ticket->id,
                'sport' => 'football',
                'external_event_id' => '100',
                'event_name' => 'Barcelona vs Real Madrid',
                'market' => 'Match Winner',
                'market_id' => 1,
                'odd' => 2.00,
                'metadata' => [
                    'home' => 'Barcelona',
                    'away' => 'Real Madrid',
                ],
            ], $leg));
        }

        return $ticket->fresh();
    }

    /**
     * Simula el resultado oficial de un partido de fútbol.
     */
    private function fakeFootballResult(string $eventId, ?int $home, ?int $away, string $status = 'FT'): void
    {
        Http::fake([
            'v3.football.api-sports.io/fixtures*' => Http::response([
                'errors' => [],
                'response' => [[
                    'fixture' => [
                        'id' => (int) $eventId,
                        'date' => '2026-10-29T18:00:00+00:00',
                        'status' => ['short' => $status, 'long' => $status === 'FT' ? 'Match Finished' : 'Match Scheduled'],
                    ],
                    'teams' => [
                        'home' => ['id' => 1, 'name' => 'Barcelona'],
                        'away' => ['id' => 2, 'name' => 'Real Madrid'],
                    ],
                    'goals' => ['home' => $home, 'away' => $away],
                ]],
            ], 200),
        ]);
    }

    public function test_paga_el_ticket_cuando_todas_las_piernas_ganan(): void
    {
        $this->fakeFootballResult('100', 2, 1);

        $ticket = $this->parleyTicket([
            ['external_event_id' => '100', 'selection_label' => 'Home'],
            [
                'external_event_id' => '100',
                'selection_label' => 'Over 1.5',
                'market' => 'Goals Over/Under',
                'market_id' => 5,
            ],
        ]);

        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", [
                'paid_amount' => 40.00,
            ]);

        $response->assertStatus(200);

        $ticket->refresh();

        $this->assertEquals(Ticket::STATUS_PAID, $ticket->status);
        $this->assertEquals(Ticket::SETTLEMENT_WON, $ticket->settlement_status);
        $this->assertEquals(40.00, (float) $ticket->paid_amount);

        foreach ($ticket->selections as $selection) {
            $this->assertEquals(Ticket::SETTLEMENT_WON, $selection->settlement_status);
            $this->assertNotNull($selection->settled_at);
        }
    }

    public function test_bloquea_el_pago_si_una_pierna_perdio(): void
    {
        $this->fakeFootballResult('100', 1, 3);

        $ticket = $this->parleyTicket([
            ['external_event_id' => '100', 'selection_label' => 'Home'],
        ]);

        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", [
                'paid_amount' => 40.00,
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('El ticket no es ganador.', $response->json('message'));

        $ticket->refresh();

        $this->assertEquals(Ticket::STATUS_PENDING, $ticket->status);
        $this->assertEquals(Ticket::SETTLEMENT_LOST, $ticket->settlement_status);
        $this->assertNull($ticket->paid_amount);
    }

    public function test_bloquea_el_pago_si_el_evento_aun_no_tiene_resultado(): void
    {
        $this->fakeFootballResult('100', null, null, 'NS');

        $ticket = $this->parleyTicket([
            ['external_event_id' => '100', 'selection_label' => 'Home'],
        ]);

        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", [
                'paid_amount' => 40.00,
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('Aún no hay resultados oficiales', $response->json('message'));

        $ticket->refresh();

        $this->assertEquals(Ticket::STATUS_PENDING, $ticket->status);
        $this->assertEquals(Ticket::SETTLEMENT_PENDING, $ticket->settlement_status);
    }

    public function test_un_mercado_no_reconocido_pasa_a_revision(): void
    {
        $this->fakeFootballResult('100', 2, 1);

        $ticket = $this->parleyTicket([
            [
                'external_event_id' => '100',
                'market' => 'Correct Score',
                'market_id' => 11,
                'selection_label' => '2-1',
            ],
        ]);

        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", [
                'paid_amount' => 40.00,
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('El ticket requiere validación del supervisor.', $response->json('message'));

        $ticket->refresh();

        $this->assertEquals(Ticket::STATUS_PENDING, $ticket->status);
        $this->assertEquals(Ticket::SETTLEMENT_REVIEW, $ticket->settlement_status);
    }

    public function test_el_supervisor_puede_aprobar_un_ticket_en_revision_y_la_taquilla_paga(): void
    {
        $this->fakeFootballResult('100', 2, 1);

        $ticket = $this->parleyTicket([
            [
                'external_event_id' => '100',
                'market' => 'Correct Score',
                'market_id' => 11,
                'selection_label' => '2-1',
            ],
        ]);

        $taquillaToken = auth('api')->login($this->taquilla);
        $supervisorToken = auth('api')->login($this->supervisor);

        // 1. El pago queda bloqueado por revisión.
        $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", ['paid_amount' => 40.00])
            ->assertStatus(422);

        // 2. El supervisor resuelve el caso.
        $review = $this->withHeader('Authorization', "Bearer {$supervisorToken}")
            ->postJson("/api/supervisor/tickets/{$ticket->id}/review", [
                'decision' => 'won',
                'notes' => 'Marcador verificado manualmente con el proveedor oficial.',
            ]);

        $review->assertStatus(200);

        $ticket->refresh();

        $this->assertEquals(Ticket::SETTLEMENT_WON, $ticket->settlement_status);
        $this->assertEquals('manual', $ticket->settlement_source);

        // 3. La taquilla ya puede cobrar. El motor automático no debe
        //    sobrescribir la decisión manual del supervisor.
        $response = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", [
                'paid_amount' => 40.00,
            ]);

        $response->assertStatus(200);

        $ticket->refresh();

        $this->assertEquals(Ticket::STATUS_PAID, $ticket->status);
        $this->assertEquals(Ticket::SETTLEMENT_WON, $ticket->settlement_status);
    }

    public function test_el_supervisor_no_puede_revisar_tickets_de_otra_agencia(): void
    {
        $ticket = $this->parleyTicket([
            ['external_event_id' => '100', 'selection_label' => 'Home'],
        ]);

        $otraAgencia = Agency::create([
            'name' => 'Agencia Norte',
            'slug' => 'agencia-norte',
        ]);

        $otroSupervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $otraAgencia->id,
        ]);

        $token = auth('api')->login($otroSupervisor);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/supervisor/tickets/{$ticket->id}/review", [
                'decision' => 'won',
                'notes' => 'Intento fuera de mi agencia.',
            ])
            ->assertStatus(404);
    }

    public function test_la_apuesta_ganadora_por_nombre_de_equipo_se_liquida(): void
    {
        $this->fakeFootballResult('100', 0, 2);

        $ticket = $this->parleyTicket([
            ['external_event_id' => '100', 'selection_label' => 'Real Madrid'],
        ]);

        $token = auth('api')->login($this->taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", [
                'paid_amount' => 40.00,
            ]);

        $response->assertStatus(200);

        $this->assertEquals(Ticket::SETTLEMENT_WON, $ticket->fresh()->settlement_status);
    }

    public function test_la_doble_oportunidad_se_liquida(): void
    {
        $this->fakeFootballResult('100', 2, 2);

        $ticket = $this->parleyTicket([
            [
                'external_event_id' => '100',
                'market' => 'Double Chance',
                'market_id' => 12,
                'selection_label' => 'Home or Draw',
            ],
        ]);

        $token = auth('api')->login($this->taquilla);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/taquilla/tickets/{$ticket->id}/pay", [
                'paid_amount' => 40.00,
            ])
            ->assertStatus(200);

        $this->assertEquals(Ticket::SETTLEMENT_WON, $ticket->fresh()->settlement_status);
    }
}
