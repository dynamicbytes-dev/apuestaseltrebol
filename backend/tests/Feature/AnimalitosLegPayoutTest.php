<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\AnimalitoSorteo;
use App\Models\Ticket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AnimalitosBet;
use Tests\TestCase;

/**
 * Con varios animalitos en un ticket solo pagan las piernas ganadoras:
 * el premio es la suma de los montos de los que salieron, por el
 * multiplicador de la lotería.
 */
class AnimalitosLegPayoutTest extends TestCase
{
    use AnimalitosBet;
    use RefreshDatabase;

    private Agency $agency;

    private User $taquilla;

    private string $sorteoAt = '';

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-29 10:00:00'));

        // El sorteo debe coincidir con el que declara la apuesta: por
        // defecto, el payload usa el día siguiente.
        $this->sorteoAt = Carbon::now()->addDay()->format('Y-m-d').' 19:00:00';

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

    private function token(): string
    {
        return auth('api')->login($this->taquilla);
    }

    /**
     * Emite la apuesta con dos animalitos y registra después el resultado
     * oficial del sorteo, que es el orden real de los hechos.
     */
    private function apuestaConDosPiernas(string $numeroGanador): int
    {
        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['09:00', '19:00']);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload($lottery, [
                ['animal' => $this->animalId($lottery, '5'), 'amount' => 50],
                ['animal' => $this->animalId($lottery, '12'), 'amount' => 30],
            ]));

        $response->assertStatus(201);

        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => $numeroGanador,
            'animal' => $lottery->animals()->firstWhere('number', $numeroGanador)?->animal,
            'sorteo_at' => Carbon::parse($this->sorteoAt),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        return (int) $response->json('data.id');
    }

    public function test_solo_pagan_las_piernas_ganadoras(): void
    {
        // Salió el 5: solo esa pierna paga.
        $ticketId = $this->apuestaConDosPiernas('5');

        // La vista previa dice que solo se paga la pierna ganadora.
        $preview = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->getJson("/api/taquilla/tickets/{$ticketId}/settlement");

        $preview->assertStatus(200);
        $this->assertEquals('won', $preview->json('data.status'));
        // 50 x 30 = 1500. La pierna perdedora no suma.
        $this->assertEquals(1500.00, (float) $preview->json('data.payable'));

        $legs = collect($preview->json('data.legs'));
        $this->assertEquals('won', $legs->firstWhere('label', 'N° 5 - León')['status']);
        $this->assertEquals('lost', $legs->firstWhere('label', 'N° 12 - Caballo')['status']);

        // El cobro paga exactamente el monto pagable.
        $pay = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson("/api/taquilla/tickets/{$ticketId}/pay", ['paid_amount' => 1500.00]);

        $pay->assertStatus(200);
        $this->assertEquals(1500.00, (float) Ticket::find($ticketId)->paid_amount);
    }

    public function test_el_premio_potencial_contempla_todas_las_piernas(): void
    {
        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['09:00', '19:00']);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload($lottery, [
                ['animal' => $this->animalId($lottery, '5'), 'amount' => 50],
                ['animal' => $this->animalId($lottery, '12'), 'amount' => 30],
            ]));

        $response->assertStatus(201);
        $this->assertEquals(2400.00, (float) $response->json('data.potential_payout'));
    }

    public function test_no_se_puede_pagar_mas_que_el_monto_pagable(): void
    {
        $ticketId = $this->apuestaConDosPiernas('5');

        // Se intenta pagar el premio potencial completo (2400).
        $pay = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson("/api/taquilla/tickets/{$ticketId}/pay", ['paid_amount' => 2400.00]);

        $pay->assertStatus(422);
        $this->assertStringContainsString('no puede superar el premio a pagar', $pay->json('message'));
        $this->assertEquals(Ticket::STATUS_PENDING, Ticket::find($ticketId)->status);
    }

    public function test_si_no_gana_ninguna_pierna_no_se_paga(): void
    {
        // Salió un número que no se jugó.
        $ticketId = $this->apuestaConDosPiernas('20');

        $pay = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson("/api/taquilla/tickets/{$ticketId}/pay", ['paid_amount' => 2400.00]);

        $pay->assertStatus(422);
        $this->assertStringContainsString('El ticket no es ganador', $pay->json('message'));
        $this->assertStringContainsString('resultó ganador el N° 20', $pay->json('message'));
        $this->assertEquals(Ticket::STATUS_PENDING, Ticket::find($ticketId)->status);
    }

    public function test_las_piernas_ganadoras_quedan_marcadas_en_el_ticket(): void
    {
        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['09:00', '19:00']);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload($lottery, [
                ['animal' => $this->animalId($lottery, '5'), 'amount' => 50],
                ['animal' => $this->animalId($lottery, '12'), 'amount' => 30],
            ]));

        $ticketId = (int) $response->json('data.id');

        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse($this->sorteoAt),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson("/api/taquilla/tickets/{$ticketId}/pay", ['paid_amount' => 1500.00])
            ->assertStatus(200);

        $ticket = Ticket::find($ticketId)->load('selections');

        $this->assertEquals('won', $ticket->settlement_status);
        $this->assertEquals(
            'won',
            $ticket->selections->firstWhere('lottery_animal_id', $this->animalId($lottery, '5'))->settlement_status
        );
        $this->assertEquals(
            'lost',
            $ticket->selections->firstWhere('lottery_animal_id', $this->animalId($lottery, '12'))->settlement_status
        );
    }
}
