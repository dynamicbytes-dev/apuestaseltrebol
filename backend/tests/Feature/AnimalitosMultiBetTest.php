<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\AnimalitoSorteo;
use App\Models\Ticket;
use App\Models\TicketMovement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AnimalitosBet;
use Tests\TestCase;

/**
 * Un ticket de animalitos puede llevar varios animalitos, cada uno con su
 * monto. El total es la suma y lo calcula el backend.
 */
class AnimalitosMultiBetTest extends TestCase
{
    use AnimalitosBet;
    use RefreshDatabase;

    private Agency $agency;

    private User $taquilla;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-29 10:00:00'));

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

    public function test_emite_un_ticket_con_varios_animalitos_y_cada_monto(): void
    {
        $lottery = $this->lotteryWithSchedule();

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload($lottery, [
                ['animal' => $this->animalId($lottery, '5'), 'amount' => 50],
                ['animal' => $this->animalId($lottery, '12'), 'amount' => 30],
            ]));

        $response->assertStatus(201);

        $data = $response->json('data');

        // El total es la suma de los montos.
        $this->assertEquals(80.00, (float) $data['stake']);
        $this->assertCount(2, $data['selections']);
        $this->assertEquals(50.00, (float) $data['selections'][0]['amount']);
        $this->assertEquals(30.00, (float) $data['selections'][1]['amount']);

        // El premio potencial es la suma de los montos por el multiplicador.
        $this->assertEquals(2400.00, (float) $data['potential_payout']);

        // El ticket declara el sorteo al que apuesta. La API devuelve el
        // instante en UTC: se compara el momento, no la cadena.
        $this->assertNotNull($data['sorteo_at']);
        $this->assertEquals(
            Carbon::parse('2026-10-30 19:00:00', 'America/Caracas')->timestamp,
            Carbon::parse($data['sorteo_at'])->timestamp
        );
    }

    public function test_el_backend_ignora_el_monto_enviado_por_el_cliente(): void
    {
        $lottery = $this->lotteryWithSchedule();

        $payload = $this->animalitosPayload($lottery, [
            ['animal' => $this->animalId($lottery, '5'), 'amount' => 50],
            ['animal' => $this->animalId($lottery, '12'), 'amount' => 30],
        ]);

        // El cliente intenta：第一 el total de su cuenta.
        $payload['stake'] = 1;

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $payload);

        $response->assertStatus(201);
        $this->assertEquals(80.00, (float) $response->json('data.stake'));
    }

    public function test_rechaza_un_animalito_repetido(): void
    {
        $lottery = $this->lotteryWithSchedule();
        $animalId = $this->animalId($lottery, '5');

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload($lottery, [
                ['animal' => $animalId, 'amount' => 50],
                ['animal' => $animalId, 'amount' => 30],
            ]));

        $response->assertStatus(422);
        $this->assertStringContainsString('No puedes repetir el mismo animalito', $response->json('message'));
    }

    public function test_rechaza_un_monto_invalido(): void
    {
        $lottery = $this->lotteryWithSchedule();

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload($lottery, [
                ['animal' => $this->animalId($lottery, '5'), 'amount' => 0],
            ]));

        $response->assertStatus(422);
        $this->assertStringContainsString('mayor que cero', $response->json('message'));
    }

    public function test_rechaza_un_horario_que_no_pertenece_a_la_loteria(): void
    {
        $lottery = $this->lotteryWithSchedule('Lotto Activo', ['09:00']);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload(
                $lottery,
                [['animal' => $this->animalId($lottery, '5'), 'amount' => 50]],
                null,
                '19:00'
            ));

        $response->assertStatus(422);
        $this->assertStringContainsString('no corresponde a un sorteo de esta lotería', $response->json('message'));
    }

    public function test_rechaza_un_sorteo_ya_pasado(): void
    {
        $lottery = $this->lotteryWithSchedule();

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload(
                $lottery,
                [['animal' => $this->animalId($lottery, '5'), 'amount' => 50]],
                '2026-10-29',
                '09:00'
            ));

        $response->assertStatus(422);
        $this->assertStringContainsString('ya pasó', $response->json('message'));
    }

    public function test_rechaza_apostar_a_un_sorteo_con_resultado_registrado(): void
    {
        $lottery = $this->lotteryWithSchedule();

        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-30 19:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload(
                $lottery,
                [['animal' => $this->animalId($lottery, '5'), 'amount' => 50]],
                '2026-10-30',
                '19:00'
            ));

        $response->assertStatus(422);
        $this->assertStringContainsString('ya tiene resultado oficial', $response->json('message'));
    }

    public function test_rechaza_una_loteria_sin_horarios_configurados(): void
    {
        $lottery = $this->lotteryWithSchedule('Lotto Sin Horario', []);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload($lottery, [
                ['animal' => $this->animalId($lottery, '5'), 'amount' => 50],
            ]));

        $response->assertStatus(422);
        $this->assertStringContainsString('no tiene horarios de sorteo configurados', $response->json('message'));
    }

    public function test_respeta_el_tope_maximo_por_apuesta_de_la_agencia(): void
    {
        $this->agency->update(['max_bet_amount' => 60]);

        $lottery = $this->lotteryWithSchedule();

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload($lottery, [
                ['animal' => $this->animalId($lottery, '5'), 'amount' => 50],
                ['animal' => $this->animalId($lottery, '12'), 'amount' => 30],
            ]));

        $response->assertStatus(422);
        $this->assertStringContainsString('monto máximo por apuesta', $response->json('message'));
    }

    public function test_el_catalogo_expone_los_horarios_y_los_sorteos_resueltos(): void
    {
        $lottery = $this->lotteryWithSchedule();

        AnimalitoSorteo::create([
            'lottery_id' => $lottery->id,
            'number' => '5',
            'animal' => 'León',
            'sorteo_at' => Carbon::parse('2026-10-29 09:00:00'),
            'es_manual' => true,
            'is_resolved' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->getJson('/api/taquilla/catalog');

        $response->assertStatus(200);

        $catalog = collect($response->json('data.lotteries'))->firstWhere('id', $lottery->id);

        $this->assertNotNull($catalog);
        $this->assertEquals(['09:00', '19:00'], $catalog['draw_times']);
        $this->assertCount(1, $response->json('data.resolved_draws'));
    }

    public function test_el_registro_de_movimientos_guarda_el_total(): void
    {
        $lottery = $this->lotteryWithSchedule();

        $response = $this->withHeader('Authorization', 'Bearer '.$this->token())
            ->postJson('/api/taquilla/tickets', $this->animalitosPayload($lottery, [
                ['animal' => $this->animalId($lottery, '5'), 'amount' => 50],
                ['animal' => $this->animalId($lottery, '12'), 'amount' => 30],
            ]));

        $response->assertStatus(201);

        $movement = TicketMovement::where('ticket_id', $response->json('data.id'))->first();

        $this->assertNotNull($movement);
        $this->assertEquals(80.00, (float) $movement->amount);
    }
}
