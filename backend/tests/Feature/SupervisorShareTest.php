<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Ticket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * KPI del porciento del supervisor sobre las ventas de sus taquillas.
 */
class SupervisorShareTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $supervisor;

    private User $taquilla;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-29 12:00:00'));

        config(['business.supervisor_share' => 0.13]);

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

    private function ticket(float $stake, ?User $taquilla = null): Ticket
    {
        $taquilla ??= $this->taquilla;

        return Ticket::create([
            'code' => (string) random_int(10000000, 99999999),
            'agency_id' => $this->agency->id,
            'supervisor_id' => $taquilla->supervisor_id,
            'taquilla_id' => $taquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'stake' => $stake,
            'total_odds' => 30,
            'potential_payout' => $stake * 30,
            'status' => Ticket::STATUS_PENDING,
        ]);
    }

    public function test_el_kpi_es_el_porciento_sobre_las_ventas_de_sus_taquillas(): void
    {
        $this->ticket(1000);
        $this->ticket(500);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->getJson('/api/supervisor/analytics');

        $response->assertStatus(200);

        $share = $response->json('data.share');

        $this->assertEquals(13.0, $share['percentage']);
        // La base es la suma total de las ventas de sus taquillas.
        $this->assertEquals(1500.00, $share['base']);
        $this->assertEquals(195.00, $share['amount']);
    }

    public function test_el_kpi_solo_cuenta_las_taquillas_a_su_cargo(): void
    {
        $this->ticket(1000);

        // Otra taquilla de la misma agencia, a cargo de otro supervisor.
        $otroSupervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $this->agency->id,
        ]);

        $otraTaquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $this->agency->id,
            'supervisor_id' => $otroSupervisor->id,
        ]);

        $this->ticket(5000, $otraTaquilla);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->getJson('/api/supervisor/analytics');

        $response->assertStatus(200);

        $share = $response->json('data.share');

        // La-base no incluye lo de la otra taquilla.
        $this->assertEquals(1000.00, $share['base']);
        $this->assertEquals(130.00, $share['amount']);
    }

    public function test_el_porcentaje_es_configurable(): void
    {
        config(['business.supervisor_share' => 0.20]);

        $this->ticket(1000);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->getJson('/api/supervisor/analytics');

        $response->assertStatus(200);

        $this->assertEquals(20.0, $response->json('data.share.percentage'));
        $this->assertEquals(200.00, $response->json('data.share.amount'));
    }

    public function test_el_kpi_no_aparece_en_la_analitica_global(): void
    {
        $admin = User::factory()->create(['role' => 'administrador']);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($admin))
            ->getJson('/api/admin/analytics');

        $response->assertStatus(200);
        $this->assertNull($response->json('data.share'));
    }
}
