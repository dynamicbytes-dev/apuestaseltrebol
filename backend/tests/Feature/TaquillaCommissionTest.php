<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Ticket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * El porcentaje de comision es propio de cada taquilla y vive en el modulo
 * de Gestion de Taquillas, no en el de Analiticas.
 */
class TaquillaCommissionTest extends TestCase
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

    private function taquilla(string $nombre, float $porcentaje): User
    {
        return User::factory()->create([
            'name' => $nombre,
            'role' => 'taquilla',
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->supervisor->id,
            'commission_percentage' => $porcentaje,
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

    public function test_el_registro_guarda_el_porcentaje_de_cada_taquilla(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->postJson('/api/supervisor/taquillas', [
                'name' => 'Taquilla Norte',
                'email' => 'norte@eltrebol.com',
                'password' => 'clave12345',
                'commission_percentage' => 11.5,
            ]);

        $response->assertStatus(201);

        $this->assertEquals(11.5, (float) $response->json('data.commission_percentage'));
        $this->assertDatabaseHas('users', [
            'email' => 'norte@eltrebol.com',
            'commission_percentage' => 11.5,
        ]);
    }

    public function test_sin_porcentaje_se_usa_el_valor_por_defecto(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->postJson('/api/supervisor/taquillas', [
                'name' => 'Taquilla Sur',
                'email' => 'sur@eltrebol.com',
                'password' => 'clave12345',
            ]);

        $response->assertStatus(201);

        // El valor por defecto viene de la configuracion (13%).
        $this->assertEquals(13.0, (float) $response->json('data.commission_percentage'));
    }

    public function test_cada_taquilla_aplica_su_propio_porcentaje(): void
    {
        $norte = $this->taquilla('Taquilla Norte', 11.5);
        $sur = $this->taquilla('Taquilla Sur', 20);

        $this->ticket(1000, $norte);
        $this->ticket(1000, $sur);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->getJson('/api/supervisor/taquillas');

        $response->assertStatus(200);

        $datos = collect($response->json('data'))->keyBy('name');

        // 11.5% de 1000
        $this->assertEquals(115.00, $datos['Taquilla Norte']['sales']['share_amount']);
        $this->assertEquals(11.5, $datos['Taquilla Norte']['sales']['share_percentage']);

        // 20% de 1000
        $this->assertEquals(200.00, $datos['Taquilla Sur']['sales']['share_amount']);
        $this->assertEquals(20.0, $datos['Taquilla Sur']['sales']['share_percentage']);
    }

    public function test_el_porcentaje_se_puede_editar(): void
    {
        $taquilla = $this->taquilla('Taquilla Norte', 13);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->putJson("/api/supervisor/taquillas/{$taquilla->id}", [
                'name' => 'Taquilla Norte',
                'email' => $taquilla->email,
                'commission_percentage' => 9.75,
            ]);

        $response->assertStatus(200);
        $this->assertEquals(9.75, (float) $response->json('data.commission_percentage'));
    }

    public function test_rechaza_un_porcentaje_invalido(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->postJson('/api/supervisor/taquillas', [
                'name' => 'Taquilla Norte',
                'email' => 'norte@eltrebol.com',
                'password' => 'clave12345',
                'commission_percentage' => 150,
            ]);

        $response->assertStatus(422);
    }

    public function test_el_modulo_de_analiticas_ya_no_muestra_el_porcentaje(): void
    {
        $this->ticket(1000, $this->taquilla('Taquilla Norte', 11.5));

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->getJson('/api/supervisor/analytics');

        $response->assertStatus(200);

        // El porcentaje vive en el modulo de taquillas.
        $this->assertNull($response->json('data.share'));
    }
}
