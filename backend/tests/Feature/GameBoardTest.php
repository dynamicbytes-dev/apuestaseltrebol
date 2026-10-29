<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\AnimalitoSorteo;
use App\Models\Lottery;
use App\Models\ParleyEventOverride;
use App\Models\Race;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Cartelera de juegos y correcciones manuales del calendario.
 */
class GameBoardTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $taquilla;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();

        Carbon::setTestNow(Carbon::parse('2026-10-29 08:00:00'));

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

    private function fakeFootball(string $date, string $kickoffUtc, int $id = 900): void
    {
        Http::fake([
            'v3.football.api-sports.io/fixtures*' => Http::response([
                'errors' => [],
                'response' => [[
                    'fixture' => [
                        'id' => $id,
                        'date' => $kickoffUtc,
                        'status' => ['short' => 'NS', 'long' => 'Not Started'],
                    ],
                    'teams' => [
                        'home' => ['id' => 1, 'name' => 'Local'],
                        'away' => ['id' => 2, 'name' => 'Visitante'],
                    ],
                    'goals' => ['home' => null, 'away' => null],
                ]],
            ], 200),
        ]);
    }

    public function test_la_cartelera_lista_los_eventos_de_parley(): void
    {
        $this->fakeFootball('2026-10-29', '2026-10-29T23:00:00+00:00');

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->getJson('/api/games?from=2026-10-29&to=2026-10-29&sport=football');

        $response->assertStatus(200);

        $parley = $response->json('data.parley');

        $this->assertCount(1, $parley);
        $this->assertEquals('Local', $parley[0]['home']);
        $this->assertEquals('football', $parley[0]['sport']);
        // 23:00 UTC son las 19:00 en Caracas.
        $this->assertEquals('2026-10-29T19:00:00-04:00', $parley[0]['starts_at']);
    }

    public function test_la_cartelera_filtra_por_liga_y_por_busqueda(): void
    {
        $this->fakeFootball('2026-10-29', '2026-10-29T23:00:00+00:00');

        $token = auth('api')->login($this->taquilla);

        $porLiga = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/games?from=2026-10-29&to=2026-10-29&sport=football&league=NoExiste');
        $porLiga->assertStatus(200);
        $this->assertCount(0, $porLiga->json('data.parley'));

        $porBusqueda = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/games?from=2026-10-29&to=2026-10-29&sport=football&search=Visitante');
        $porBusqueda->assertStatus(200);
        $this->assertCount(1, $porBusqueda->json('data.parley'));
    }

    public function test_la_cartelera_incluye_hipismo_y_animalitos(): void
    {
        $race = Race::create([
            'name' => '1ra Carrera',
            'track' => 'La Rinconada',
            'meeting' => 'Reunión 12',
            'race_date' => Carbon::parse('2026-10-29 15:00:00'),
            'status' => Race::STATUS_PENDING,
        ]);

        $lottery = Lottery::create([
            'name' => 'Lotto Activo',
            'slug' => 'lotto-activo',
            'payout_multiplier' => 30,
            'is_active' => true,
            'draw_times' => ['09:00', '19:00'],
        ]);

        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->getJson('/api/games?from=2026-10-29&to=2026-10-29&type=hipismo');

        $response->assertStatus(200);

        $this->assertCount(1, $response->json('data.hipismo'));
        $this->assertEquals('1ra Carrera', $response->json('data.hipismo.0.name'));
        $this->assertEquals(0, $response->json('data.counts.parley'));

        $responseAnimalitos = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->getJson('/api/games?from=2026-10-29&to=2026-10-29&type=animalitos');

        $responseAnimalitos->assertStatus(200);
        $this->assertCount(1, $responseAnimalitos->json('data.animalitos'));
        $this->assertEquals('5', $responseAnimalitos->json('data.animalitos.0.number'));
    }

    public function test_el_admin_puede_corregir_la_fecha_de_un_evento(): void
    {
        $this->fakeFootball('2026-10-28', '2026-10-28T18:00:00+00:00', 1644366);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->admin))
            ->putJson('/api/admin/parley/events/football/1644366/schedule', [
                'starts_at' => '2026-10-29T15:30:00-04:00',
            ]);

        $response->assertStatus(200);

        $override = ParleyEventOverride::first();

        $this->assertNotNull($override);
        $this->assertEquals('football', $override->sport);
        $this->assertEquals('1644366', $override->external_event_id);
        $this->assertEquals('2026-10-29 15:30:00', $override->starts_at->format('Y-m-d H:i:s'));
    }

    public function test_la_correccion_mueve_el_evento_de_dia(): void
    {
        $this->fakeFootball('2026-10-28', '2026-10-28T18:00:00+00:00', 1644366);

        $adminToken = auth('api')->login($this->admin);

        $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson('/api/admin/parley/events/football/1644366/schedule', [
                'starts_at' => '2026-10-29T15:30:00-04:00',
            ])
            ->assertStatus(200);

        Cache::flush();

        // El dia original ya no lo muestra.
        $original = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->getJson('/api/games?from=2026-10-28&to=2026-10-28&sport=football');
        $original->assertStatus(200);
        $this->assertCount(0, $original->json('data.parley'));

        // Y el dia corregido si, con la fecha del proveedor a la vista.
        $corregido = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->getJson('/api/games?from=2026-10-29&to=2026-10-29&sport=football');
        $corregido->assertStatus(200);

        $evento = $corregido->json('data.parley.0');

        $this->assertEquals('2026-10-29T15:30:00-04:00', $evento['starts_at']);
        $this->assertTrue($evento['schedule_corrected']);
        $this->assertEquals('2026-10-28T14:00:00-04:00', $evento['original_starts_at']);
    }

    public function test_un_taquilla_no_puede_corregir_el_calendario(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->putJson('/api/admin/parley/events/football/1644366/schedule', [
                'starts_at' => '2026-10-29T15:30:00-04:00',
            ]);

        $response->assertStatus(403);
    }

    public function test_se_puede_quitar_una_correccion(): void
    {
        ParleyEventOverride::create([
            'sport' => 'football',
            'external_event_id' => '1644366',
            'starts_at' => Carbon::parse('2026-10-29 15:30:00'),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->admin))
            ->deleteJson('/api/admin/parley/events/football/1644366/schedule');

        $response->assertStatus(200);
        $this->assertSame(0, ParleyEventOverride::count());
    }

    public function test_el_filtro_de_ligas_y_loterias(): void
    {
        $lottery = Lottery::create([
            'name' => 'Lotto Activo',
            'slug' => 'lotto-activo',
            'payout_multiplier' => 30,
            'is_active' => true,
            'draw_times' => ['09:00'],
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->getJson('/api/games/lotteries');

        $response->assertStatus(200);
        $this->assertEquals('Lotto Activo', $response->json('data.0.name'));
        $this->assertEquals(['09:00'], $response->json('data.0.draw_times'));
        $this->assertEquals($lottery->id, $response->json('data.0.id'));
    }
}
