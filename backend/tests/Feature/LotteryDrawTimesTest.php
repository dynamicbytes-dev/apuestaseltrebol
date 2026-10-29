<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AnimalitosBet;
use Tests\TestCase;

/**
 * Los horarios de sorteo de cada lotería y el horario por defecto que
 * recibe una lotería nueva.
 */
class LotteryDrawTimesTest extends TestCase
{
    use AnimalitosBet;
    use RefreshDatabase;

    private User $admin;

    private User $taquilla;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-29 08:30:00'));

        $this->admin = User::factory()->create(['role' => 'administrador']);

        $agency = Agency::create(['name' => 'Agencia Centro', 'slug' => 'agencia-centro']);
        $supervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $agency->id,
        ]);
        $this->taquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_una_loteria_nueva_recibe_el_horario_por_defecto(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->admin))
            ->postJson('/api/admin/lotteries', [
                'name' => 'Lotto Nuevo',
                'animals' => [['number' => '1', 'animal' => 'Carnero']],
            ]);

        $response->assertStatus(201);

        $drawTimes = $response->json('data.draw_times');

        $this->assertEquals(config('animalitos.draw_times'), $drawTimes);
        // De 8:00 a 19:00 en punto: doce horarios.
        $this->assertCount(12, $drawTimes);
        $this->assertSame('08:00', $drawTimes[0]);
        $this->assertSame('19:00', $drawTimes[11]);
        $this->assertContains('12:00', $drawTimes);
    }

    public function test_el_horario_por_defecto_cubre_de_ocho_a_siete_de_la_tarde(): void
    {
        $this->assertSame(
            [
                '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
                '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
            ],
            config('animalitos.draw_times')
        );
    }

    public function test_el_admin_puede_cambiar_los_horarios_de_una_loteria(): void
    {
        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['09:00', '19:00']);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->admin))
            ->putJson("/api/admin/lotteries/{$lottery->id}", [
                'name' => 'Lotto Activo',
                'is_active' => true,
                'payout_multiplier' => 30,
                'draw_times' => ['08:00', '14:00'],
            ]);

        $response->assertStatus(200);
        $this->assertEquals(['08:00', '14:00'], $response->json('data.draw_times'));
    }

    public function test_se_puede_apostar_a_cualquiera_de_los_horarios_del_horario_comun(): void
    {
        $lottery = $this->lotteryWithSchedule('Lotto Activo', config('animalitos.draw_times'));

        // 14:00 es uno de los horarios y todavía no ha pasado.
        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload(
                $lottery,
                [['animal' => $this->animalId($lottery, '5'), 'amount' => 50]],
                '2026-10-29',
                '14:00'
            ));

        $response->assertStatus(201);
        $this->assertEquals(50.00, (float) $response->json('data.stake'));
    }
}
