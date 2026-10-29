<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Lottery;
use App\Models\LotteryAnimal;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Los topes los gestiona el supervisor, para su agencia y sus taquillas.
 */
class SupervisorLimitsTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $supervisor;

    private User $taquilla;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-29 12:00:00'));

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

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function token(): string
    {
        return auth('api')->login($this->supervisor);
    }

    public function test_el_supervisor_ve_los_topes_de_su_agencia_y_de_sus_taquillas(): void
    {
        $this->agency->update(['max_bet_amount' => 500, 'max_ticket_payout' => 10000]);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->getJson('/api/supervisor/limits');

        $response->assertStatus(200);

        $this->assertEquals(500.0, (float) $response->json('data.agency.max_bet_amount'));
        $this->assertCount(1, $response->json('data.taquillas'));

        // Sin topes propios, la taquilla hereda los de la agencia.
        $this->assertEquals(500.0, (float) $response->json('data.taquillas.0.effective.max_bet_amount'));
    }

    public function test_el_supervisor_modifica_los_topes_de_su_agencia(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->patchJson('/api/supervisor/limits', [
                'max_bet_amount' => 750,
                'max_ticket_payout' => 20000,
            ]);

        $response->assertStatus(200);

        $this->assertEquals(750.00, (float) $this->agency->fresh()->max_bet_amount);
        $this->assertEquals(20000.00, (float) $this->agency->fresh()->max_ticket_payout);
    }

    public function test_el_supervisor_modifica_los_topes_de_su_taquilla(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->patchJson("/api/supervisor/taquillas/{$this->taquilla->id}/limits", [
                'max_bet_amount' => 300,
            ]);

        $response->assertStatus(200);

        $this->assertEquals(300.00, (float) $this->taquilla->fresh()->max_bet_amount);
    }

    public function test_el_supervisor_no_puede_tocar_topes_de_otra_agencia(): void
    {
        $otraAgencia = Agency::create(['name' => 'Agencia Norte', 'slug' => 'agencia-norte']);
        $otroSupervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $otraAgencia->id,
        ]);
        $otraTaquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $otraAgencia->id,
            'supervisor_id' => $otroSupervisor->id,
        ]);

        // Topes de una taquilla ajena.
        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->patchJson("/api/supervisor/taquillas/{$otraTaquilla->id}/limits", [
                'max_bet_amount' => 999999,
            ]);

        $response->assertStatus(404);
        $this->assertNull($otraTaquilla->fresh()->max_bet_amount);
    }

    public function test_el_tope_propio_de_la_taquilla_manda_sobre_el_de_la_agencia(): void
    {
        $this->agency->update(['max_bet_amount' => 500, 'max_ticket_payout' => 10000]);
        $this->taquilla->update(['max_bet_amount' => 100, 'max_ticket_payout' => 2000]);

        $limites = $this->taquilla->fresh()->effectiveLimits();

        $this->assertEquals(100.0, (float) $limites['max_bet_amount']);
        $this->assertEquals(2000.0, (float) $limites['max_ticket_payout']);
    }

    public function test_la_apuesta_se_bloquea_con_el_tope_de_la_taquilla(): void
    {
        $this->agency->update(['max_bet_amount' => 50000]);
        $this->taquilla->update(['max_bet_amount' => 100]);

        $lottery = Lottery::create([
            'name' => 'Lotto Activo',
            'slug' => 'lotto-activo',
            'payout_multiplier' => 30,
            'is_active' => true,
            'draw_times' => ['09:00', '19:00'],
        ]);

        $animal = LotteryAnimal::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'is_enabled' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->postJson('/api/taquilla/tickets', [
                'type' => 'animalitos',
                'lottery_id' => $lottery->id,
                'sorteo_date' => Carbon::now()->addDay()->toDateString(),
                'sorteo_time' => '19:00',
                'selections' => [
                    ['lottery_animal_id' => $animal->id, 'amount' => 500],
                ],
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('monto máximo por apuesta', $response->json('message'));
    }
}
