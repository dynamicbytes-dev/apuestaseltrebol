<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Ticket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnalyticsTest extends TestCase
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

    private function ticket(array $attributes = []): Ticket
    {
        return Ticket::create(array_merge([
            'code' => (string) random_int(10000000, 99999999),
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->supervisor->id,
            'taquilla_id' => $this->taquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'stake' => 100.00,
            'total_odds' => 30,
            'potential_payout' => 3000.00,
            'status' => Ticket::STATUS_PENDING,
        ], $attributes));
    }

    public function test_el_supervisor_ve_las_analiticas_de_su_agencia(): void
    {
        $this->ticket(['stake' => 100]);
        $this->ticket([
            'stake' => 50,
            'status' => Ticket::STATUS_PAID,
            'paid_amount' => 1500,
            'paid_at' => now(),
        ]);

        $token = auth('api')->login($this->supervisor);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/supervisor/analytics');

        $response->assertStatus(200);

        $totals = $response->json('data.totals');

        $this->assertEquals(2, $totals['tickets']);
        $this->assertEquals(150.00, $totals['stake']);
        $this->assertEquals(1500.00, $totals['paid']);
        $this->assertEquals(-1350.00, $totals['net']);
        $this->assertEquals(1, $totals['paid_count']);
        $this->assertEquals(1, $totals['pending']);
    }

    public function test_las_analiticas_del_supervisor_no_incluyen_otras_agencias(): void
    {
        $this->ticket(['stake' => 100]);

        $otraAgencia = Agency::create(['name' => 'Agencia Norte', 'slug' => 'agencia-norte']);
        $otroSupervisor = User::factory()->create(['role' => 'supervisor', 'agency_id' => $otraAgencia->id]);
        $otraTaquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $otraAgencia->id,
            'supervisor_id' => $otroSupervisor->id,
        ]);

        Ticket::create([
            'code' => '99999999',
            'agency_id' => $otraAgencia->id,
            'supervisor_id' => $otroSupervisor->id,
            'taquilla_id' => $otraTaquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'stake' => 9999.00,
            'total_odds' => 30,
            'potential_payout' => 299970.00,
            'status' => Ticket::STATUS_PENDING,
        ]);

        $token = auth('api')->login($this->supervisor);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/supervisor/analytics');

        $response->assertStatus(200);

        $this->assertEquals(1, $response->json('data.totals.tickets'));
        $this->assertEquals(100.00, $response->json('data.totals.stake'));
    }

    public function test_el_admin_ve_el_desglose_por_agencia(): void
    {
        $this->ticket(['stake' => 100]);

        $otraAgencia = Agency::create(['name' => 'Agencia Norte', 'slug' => 'agencia-norte']);
        $otroSupervisor = User::factory()->create(['role' => 'supervisor', 'agency_id' => $otraAgencia->id]);
        $otraTaquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $otraAgencia->id,
            'supervisor_id' => $otroSupervisor->id,
        ]);

        Ticket::create([
            'code' => '99999999',
            'agency_id' => $otraAgencia->id,
            'supervisor_id' => $otroSupervisor->id,
            'taquilla_id' => $otraTaquilla->id,
            'type' => Ticket::TYPE_PARLEY,
            'stake' => 500.00,
            'total_odds' => 4,
            'potential_payout' => 2000.00,
            'status' => Ticket::STATUS_PENDING,
            'settlement_status' => Ticket::SETTLEMENT_WON,
        ]);

        $token = auth('api')->login(User::factory()->create(['role' => 'administrador']));

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/admin/analytics');

        $response->assertStatus(200);

        $this->assertEquals(2, $response->json('data.totals.tickets'));
        $this->assertEquals(600.00, $response->json('data.totals.stake'));
        $this->assertCount(2, $response->json('data.by_agency'));

        $agencies = collect($response->json('data.by_agency'));
        $norte = $agencies->firstWhere('agency_name', 'Agencia Norte');

        $this->assertNotNull($norte);
        $this->assertEquals(1, $norte['tickets']);
        $this->assertEquals(500.00, $norte['stake']);
    }

    public function test_la_analitica_desglosa_por_tipo_de_juego(): void
    {
        $this->ticket(['type' => Ticket::TYPE_ANIMALITOS]);
        $this->ticket(['type' => Ticket::TYPE_HIPISMO]);

        $token = auth('api')->login($this->supervisor);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/supervisor/analytics');

        $response->assertStatus(200);

        $byType = collect($response->json('data.by_type'));

        $this->assertCount(2, $byType);
        $this->assertEquals(1, $byType->firstWhere('type', Ticket::TYPE_ANIMALITOS)['tickets']);
        $this->assertEquals(1, $byType->firstWhere('type', Ticket::TYPE_HIPISMO)['tickets']);
    }

    public function test_la_analitica_respeta_el_rango_de_fechas(): void
    {
        // Eloquent sobrescribe created_at al insertar: hay que fijarlo después.
        $antiguo = $this->ticket();
        $antiguo->created_at = now()->subDays(60);
        $antiguo->save();

        $this->ticket();

        $token = auth('api')->login($this->supervisor);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/supervisor/analytics?from='.now()->toDateString().'&to='.now()->toDateString());

        $response->assertStatus(200);

        $this->assertEquals(1, $response->json('data.totals.tickets'));
        $this->assertEquals(now()->toDateString(), $response->json('data.period.from'));
    }
}
