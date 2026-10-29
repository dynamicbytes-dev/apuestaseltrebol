<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Ticket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * El 13% del supervisor es por taquilla: cada una tiene su propio.
 */
class TaquillaShareTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $supervisor;

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
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
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

    public function test_cada_taquilla_muestra_su_propio_porcentaje(): void
    {
        $taquilla1 = $this->taquilla('Taquilla Norte');
        $taquilla2 = $this->taquilla('Taquilla Sur');

        $this->ticket(1000, $taquilla1);
        $this->ticket(400, $taquilla1);
        $this->ticket(2500, $taquilla2);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->getJson('/api/supervisor/taquillas');

        $response->assertStatus(200);

        $norte = collect($response->json('data'))->firstWhere('name', 'Taquilla Norte');
        $sur = collect($response->json('data'))->firstWhere('name', 'Taquilla Sur');

        // Cada taquilla se liquida por separado.
        $this->assertEquals(1400.00, $norte['sales']['stake']);
        $this->assertEquals(2, $norte['sales']['tickets']);
        $this->assertEquals(182.00, $norte['sales']['share_amount']);

        $this->assertEquals(2500.00, $sur['sales']['stake']);
        $this->assertEquals(1, $sur['sales']['tickets']);
        $this->assertEquals(325.00, $sur['sales']['share_amount']);

        // El mismo porcentaje para todas.
        $this->assertEquals(13.0, $norte['sales']['share_percentage']);
        $this->assertEquals(13.0, $sur['sales']['share_percentage']);
    }

    public function test_una_taquilla_sin_ventas_muestra_cero(): void
    {
        $this->taquilla('Taquilla Nueva');

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->getJson('/api/supervisor/taquillas');

        $response->assertStatus(200);

        $taquilla = $response->json('data.0');

        $this->assertEquals(0.0, $taquilla['sales']['stake']);
        $this->assertEquals(0.0, $taquilla['sales']['share_amount']);
        $this->assertEquals(13.0, $taquilla['sales']['share_percentage']);
    }

    public function test_no_incluye_las_taquillas_de_otro_supervisor(): void
    {
        $otroSupervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $this->agency->id,
        ]);

        $otraTaquilla = User::factory()->create([
            'name' => 'Taquilla Ajena',
            'role' => 'taquilla',
            'agency_id' => $this->agency->id,
            'supervisor_id' => $otroSupervisor->id,
        ]);

        $this->ticket(9999, $otraTaquilla);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->getJson('/api/supervisor/taquillas');

        $response->assertStatus(200);

        $this->assertCount(0, $response->json('data'));
    }

    public function test_las_ventas_se_pueden_filtrar_por_periodo(): void
    {
        $taquilla = $this->taquilla('Taquilla Norte');

        $this->ticket(1000, $taquilla);

        $antiguo = $this->ticket(9000, $taquilla);
        $antiguo->created_at = now()->subDays(60);
        $antiguo->save();

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->getJson('/api/supervisor/taquillas?from='.now()->toDateString().'&to='.now()->toDateString());

        $response->assertStatus(200);

        $this->assertEquals(1000.00, $response->json('data.0.sales.stake'));
        $this->assertEquals(130.00, $response->json('data.0.sales.share_amount'));
    }
}
