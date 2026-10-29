<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\AnimalitoSorteo;
use App\Models\Lottery;
use App\Models\LotteryAnimal;
use App\Models\Ticket;
use App\Models\TicketSelection;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * El estado de las jugadas se actualiza solo: en cuanto se registra el
 * resultado oficial, el ticket pasa a ganador o no ganador.
 */
class TicketAutomaticStatusTest extends TestCase
{
    use RefreshDatabase;

    private Agency $agency;

    private User $supervisor;

    private User $taquilla;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Carbon::setTestNow(Carbon::parse('2026-10-29 08:00:00'));

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

    private function ticketAnimalitos(string $number): Ticket
    {
        $lottery = Lottery::create([
            'name' => 'Lotto Activo',
            'slug' => 'lotto-activo',
            'payout_multiplier' => 30.00,
            'is_active' => true,
            'draw_times' => ['09:00', '19:00'],
        ]);

        $animal = LotteryAnimal::create([
            'lottery_id' => $lottery->id,
            'number' => $number,
            'animal' => 'León',
            'is_enabled' => true,
        ]);

        $ticket = Ticket::create([
            'code' => (string) random_int(10000000, 99999999),
            'agency_id' => $this->agency->id,
            'supervisor_id' => $this->supervisor->id,
            'taquilla_id' => $this->taquilla->id,
            'type' => Ticket::TYPE_ANIMALITOS,
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'stake' => 50.00,
            'total_odds' => 30.00,
            'potential_payout' => 1500.00,
            'status' => Ticket::STATUS_PENDING,
        ]);

        TicketSelection::create([
            'ticket_id' => $ticket->id,
            'lottery_id' => $lottery->id,
            'lottery_animal_id' => $animal->id,
            'selection_label' => 'N° '.$number,
            'odd' => 30.00,
            'amount' => 50.00,
            'metadata' => ['number' => $number],
        ]);

        return $ticket->fresh();
    }

    public function test_el_historial_del_supervisor_actualiza_el_estado_solo(): void
    {
        $this->ticketAnimalitos('5');

        // Antes de registrar el resultado, el ticket esta pendiente.
        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->getJson('/api/supervisor/tickets');

        $response->assertStatus(200);
        $this->assertEquals(Ticket::SETTLEMENT_PENDING, $response->json('data.0.settlement_status'));

        // Se registra el resultado oficial.
        AnimalitoSorteo::create([
            'lottery_id' => Lottery::first()->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        // Ahora el ticket sale como ganador, sin tocar nada.
        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->supervisor))
            ->getJson('/api/supervisor/tickets');

        $response->assertStatus(200);
        $this->assertEquals(Ticket::SETTLEMENT_WON, $response->json('data.0.settlement_status'));
    }

    public function test_el_filtro_por_estado_de_liquidacion_usa_el_estado_actual(): void
    {
        $this->ticketAnimalitos('5');

        AnimalitoSorteo::create([
            'lottery_id' => Lottery::first()->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $token = auth('api')->login($this->supervisor);

        $ganadores = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/supervisor/tickets?settlement_status=won');
        $ganadores->assertStatus(200);
        $this->assertCount(1, $ganadores->json('data'));

        $perdedores = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/supervisor/tickets?settlement_status=lost');
        $perdedores->assertStatus(200);
        $this->assertCount(0, $perdedores->json('data'));
    }

    public function test_la_lista_de_la_taquilla_actualiza_el_estado_solo(): void
    {
        $this->ticketAnimalitos('12');

        AnimalitoSorteo::create([
            'lottery_id' => Lottery::first()->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 19:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.auth('api')->login($this->taquilla))
            ->getJson('/api/taquilla/tickets');

        $response->assertStatus(200);
        $this->assertEquals(Ticket::SETTLEMENT_LOST, $response->json('data.0.settlement_status'));
    }

    public function test_el_comando_de_liquidacion_procesa_los_tickets_pendientes(): void
    {
        $ticket = $this->ticketAnimalitos('5');

        // Sin resultado oficial, el comando no puede resolverlo.
        $this->artisan('tickets:settle')->assertExitCode(0);

        $this->assertEquals(Ticket::SETTLEMENT_PENDING, $ticket->fresh()->settlement_status);
    }

    public function test_el_comando_esta_registrado_en_el_planificador(): void
    {
        $eventos = app(Schedule::class)->events();

        $comandos = collect($eventos)->map(fn ($event) => $event->command ?? '')->implode(' ');

        $this->assertStringContainsString('tickets:settle', $comandos);
        $this->assertStringContainsString('fetch:animalitos', $comandos);
    }
}
