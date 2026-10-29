<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Ticket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * KPI del 1.5% de la agencia sobre sus ventas.
 */
class AgencyShareTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $supervisor;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-29 12:00:00'));

        config(['business.agency_share' => 0.015]);

        $this->agency = Agency::create(['name' => 'Agencia Centro', 'slug' => 'agencia-centro']);

        $this->supervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $this->agency->id,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function ticket(float $stake, User $taquilla): Ticket
    {
        return Ticket::create([
            'code' => (string) random_int(10000000, 99999999),
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->supervisor->id,
            'taquilla_id' => $taquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'stake' => $stake,
            'total_odds' => 30,
            'potential_payout' => $stake * 30,
            'status' => Ticket::STATUS_PENDING,
        ]);
    }

    private function taquilla(string $nombre): User
    {
        return User::factory()->create([
            'name' => $nombre,
            'role' => 'taquilla',
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->supervisor->id,
        ]);
    }

    public function test_el_kpi_suma_las_ventas_de_todas_las_taquillas_de_la_agencia(): void
    {
        // Una agencia puede tener tantas taquillas como quiera.
        $this->ticket(1000, $this->taquilla('Taquilla 1'));
        $this->ticket(2500, $this->taquilla('Taquilla 2'));
        $this->ticket(500, $this->taquilla('Taquilla 3'));

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login(
            User::factory()->create(['role' => 'administrador'])
        ))->getJson('/api/admin/agencies');

        $response->assertStatus(200);

        $agencia = collect($response->json('data'))->firstWhere('name', 'Agencia Centro');

        $this->assertNotNull($agencia);
        // Las ventas de la agencia son la suma de las de sus tres taquillas.
        $this->assertEquals(4000.00, $agencia['sales']['stake']);
        $this->assertEquals(3, $agencia['sales']['tickets']);
        $this->assertEquals(1.5, $agencia['sales']['share_percentage']);
        // 1.5% de 4000 = 60
        $this->assertEquals(60.00, $agencia['sales']['share_amount']);
    }

    public function test_una_agencia_sin_ventas_muestra_cero(): void
    {
        $otra = Agency::create(['name' => 'Agencia Norte', 'slug' => 'agencia-norte']);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login(
            User::factory()->create(['role' => 'administrador'])
        ))->getJson('/api/admin/agencies');

        $response->assertStatus(200);

        $agencia = collect($response->json('data'))->firstWhere('id', $otra->id);

        $this->assertEquals(0.0, $agencia['sales']['stake']);
        $this->assertEquals(0.0, $agencia['sales']['share_amount']);
    }

    public function test_el_porcentaje_es_configurable(): void
    {
        config(['business.agency_share' => 0.05]);

        $this->ticket(1000, $this->taquilla('Taquilla 1'));

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login(
            User::factory()->create(['role' => 'administrador'])
        ))->getJson('/api/admin/agencies');

        $response->assertStatus(200);

        $agencia = collect($response->json('data'))->firstWhere('id', $this->agency->id);

        $this->assertEquals(5.0, $agencia['sales']['share_percentage']);
        $this->assertEquals(50.00, $agencia['sales']['share_amount']);
    }

    public function test_las_ventas_se_pueden_filtrar_por_periodo(): void
    {
        $this->ticket(1000, $this->taquilla('Taquilla 1'));

        $antiguo = $this->ticket(9000, $this->taquilla('Taquilla 2'));
        $antiguo->created_at = now()->subDays(60);
        $antiguo->save();

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login(
            User::factory()->create(['role' => 'administrador'])
        ))->getJson('/api/admin/agencies?from='.now()->toDateString().'&to='.now()->toDateString());

        $response->assertStatus(200);

        $agencia = collect($response->json('data'))->firstWhere('id', $this->agency->id);

        // Solo entra el ticket del periodo.
        $this->assertEquals(1000.00, $agencia['sales']['stake']);
    }
}
