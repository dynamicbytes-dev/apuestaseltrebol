<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Horse;
use App\Models\HorseRacingBet;
use App\Models\Race;
use App\Models\Ticket;
use App\Models\TicketSelection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HorseRacingBetsTest extends TestCase
{
    use RefreshDatabase;

    private User $taquilla;
    private string $taquillaToken;
    private Agency $agency;

    protected function setUp(): void
    {
        parent::setUp();

        $this->agency = Agency::create([
            'name' => 'Agencia Hipódromo',
            'slug' => 'agencia-hipodromo',
            'max_bet_amount' => 1000.00,
            'max_ticket_payout' => 50000.00,
        ]);

        $supervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $this->agency->id,
        ]);

        $this->taquilla = User::factory()->create([
            'role' => 'taquilla',
            'agency_id' => $this->agency->id,
            'supervisor_id' => $supervisor->id,
        ]);

        $this->taquillaToken = auth('api')->login($this->taquilla);
    }

    public function test_horse_racing_bets_table_exists_with_required_columns(): void
    {
        $this->assertTrue(Schema::hasTable('horse_racing_bets'));
        $this->assertTrue(Schema::hasColumn('horse_racing_bets', 'id'));
        $this->assertTrue(Schema::hasColumn('horse_racing_bets', 'ticket_id'));
        $this->assertTrue(Schema::hasColumn('horse_racing_bets', 'bet_type'));
        $this->assertTrue(Schema::hasColumn('horse_racing_bets', 'selections'));
        $this->assertTrue(Schema::hasColumn('horse_racing_bets', 'meeting'));
        $this->assertTrue(Schema::hasColumn('horse_racing_bets', 'combinations_count'));
    }

    public function test_pos_blocks_cinco_y_seis_if_any_valid_race_is_missing_marks(): void
    {
        // Crear una reunión con 6 carreras válidas
        $meeting = 'Reunión 45';
        $races = [];

        for ($i = 1; $i <= 6; $i++) {
            $race = Race::create([
                'name' => "{$i}ra Válida",
                'meeting' => $meeting,
                'track' => 'La Rinconada',
                'race_date' => now()->addHours($i),
                'status' => Race::STATUS_PENDING,
                'is_valida' => true,
                'valida_number' => $i,
            ]);

            Horse::create([
                'race_id' => $race->id,
                'number' => 1,
                'name' => "Ejemplar A{$i}",
                'dividend' => 2.50,
                'is_retired' => false,
            ]);

            Horse::create([
                'race_id' => $race->id,
                'number' => 2,
                'name' => "Ejemplar B{$i}",
                'dividend' => 3.00,
                'is_retired' => false,
            ]);

            $races[$i] = $race->fresh('horses');
        }

        // El cajero solo marca 5 de las 6 válidas (falta la 6ta válida)
        $incompleteSelections = [
            ['race_id' => $races[1]->id, 'horse_ids' => [$races[1]->horses[0]->id]],
            ['race_id' => $races[2]->id, 'horse_ids' => [$races[2]->horses[0]->id]],
            ['race_id' => $races[3]->id, 'horse_ids' => [$races[3]->horses[0]->id]],
            ['race_id' => $races[4]->id, 'horse_ids' => [$races[4]->horses[0]->id]],
            ['race_id' => $races[5]->id, 'horse_ids' => [$races[5]->horses[0]->id]],
            // Válida 6 omitida intencionalmente
        ];

        $response = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->postJson('/api/taquilla/tickets', [
                'type' => Ticket::TYPE_HIPISMO,
                'bet_type' => HorseRacingBet::TYPE_CINCO_Y_SEIS,
                'meeting' => $meeting,
                'stake' => 10.00,
                'selections' => $incompleteSelections,
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['selections']);
        $this->assertStringContainsString(
            'El Cuadro del 5 y 6 requiere al menos una marca por cada carrera válida programada',
            $response->json('message')
        );
        $this->assertStringContainsString('6ª Válida', $response->json('message'));
        $this->assertEquals(0, Ticket::count());
        $this->assertEquals(0, HorseRacingBet::count());
    }

    public function test_pos_accepts_and_saves_cinco_y_seis_when_all_valid_races_have_at_least_one_mark(): void
    {
        $meeting = 'Reunión 45';
        $races = [];
        $selections = [];

        for ($i = 1; $i <= 6; $i++) {
            $race = Race::create([
                'name' => "{$i}ra Válida",
                'meeting' => $meeting,
                'track' => 'La Rinconada',
                'race_date' => now()->addHours($i),
                'status' => Race::STATUS_PENDING,
                'is_valida' => true,
                'valida_number' => $i,
            ]);

            $h1 = Horse::create([
                'race_id' => $race->id,
                'number' => 1,
                'name' => "Caballo A{$i}",
                'dividend' => 2.50,
                'is_retired' => false,
            ]);

            $h2 = Horse::create([
                'race_id' => $race->id,
                'number' => 2,
                'name' => "Caballo B{$i}",
                'dividend' => 3.50,
                'is_retired' => false,
            ]);

            $races[$i] = $race;

            // En la 1ra válida ponemos 2 marcas (combinación doble), en las demás 1 (línea)
            // Total combinaciones = 2 * 1 * 1 * 1 * 1 * 1 = 2 cuadros
            if ($i === 1) {
                $selections[] = [
                    'race_id' => $race->id,
                    'horse_ids' => [$h1->id, $h2->id],
                ];
            } else {
                $selections[] = [
                    'race_id' => $race->id,
                    'horse_ids' => [$h1->id],
                ];
            }
        }

        $response = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->postJson('/api/taquilla/tickets', [
                'type' => Ticket::TYPE_HIPISMO,
                'bet_type' => HorseRacingBet::TYPE_CINCO_Y_SEIS,
                'meeting' => $meeting,
                'stake' => 20.00,
                'selections' => $selections,
            ]);

        $response->assertStatus(201);

        $ticket = Ticket::with(['selections', 'horseRacingBet'])->first();
        $this->assertNotNull($ticket);
        $this->assertEquals(Ticket::TYPE_HIPISMO, $ticket->type);
        $this->assertEquals(20.00, (float) $ticket->stake);

        // Se crearon 7 selecciones (2 en la 1ra válida + 1 en cada una de las otras 5)
        $this->assertCount(7, $ticket->selections);

        // Verificar el registro en horse_racing_bets
        $bet = $ticket->horseRacingBet;
        $this->assertNotNull($bet);
        $this->assertEquals(HorseRacingBet::TYPE_CINCO_Y_SEIS, $bet->bet_type);
        $this->assertEquals($meeting, $bet->meeting);
        $this->assertEquals(2, $bet->combinations_count);
        $this->assertIsArray($bet->selections);
        $this->assertCount(6, $bet->selections); // 6 carreras válidas guardadas en JSON
    }

    public function test_pos_blocks_cinco_y_seis_if_a_selected_horse_is_retired(): void
    {
        $meeting = 'Reunión 46';
        $races = [];
        $selections = [];

        for ($i = 1; $i <= 6; $i++) {
            $race = Race::create([
                'name' => "{$i}ra Válida",
                'meeting' => $meeting,
                'track' => 'La Rinconada',
                'race_date' => now()->addHours($i),
                'status' => Race::STATUS_PENDING,
                'is_valida' => true,
                'valida_number' => $i,
            ]);

            $isRetired = ($i === 3); // El caballo de la 3ra válida está retirado
            $horse = Horse::create([
                'race_id' => $race->id,
                'number' => 1,
                'name' => "Caballo {$i}",
                'dividend' => 2.00,
                'is_retired' => $isRetired,
            ]);

            $races[$i] = $race;
            $selections[] = [
                'race_id' => $race->id,
                'horse_ids' => [$horse->id],
            ];
        }

        $response = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->postJson('/api/taquilla/tickets', [
                'type' => Ticket::TYPE_HIPISMO,
                'bet_type' => HorseRacingBet::TYPE_CINCO_Y_SEIS,
                'meeting' => $meeting,
                'stake' => 10.00,
                'selections' => $selections,
            ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('ha sido retirado y no admite apuestas', $response->json('message'));
        $this->assertEquals(0, Ticket::count());
    }

    public function test_pos_saves_simple_ganador_bet_and_creates_horse_racing_bet(): void
    {
        $race = Race::create([
            'name' => '1ra Carrera',
            'meeting' => 'Reunión 47',
            'track' => 'La Rinconada',
            'race_date' => now()->addHours(1),
            'status' => Race::STATUS_PENDING,
        ]);

        $horse = Horse::create([
            'race_id' => $race->id,
            'number' => 5,
            'name' => 'Catire Pedro',
            'dividend' => 3.50,
            'is_retired' => false,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->postJson('/api/taquilla/tickets', [
                'type' => Ticket::TYPE_HIPISMO,
                'bet_type' => HorseRacingBet::TYPE_GANADOR,
                'race_id' => $race->id,
                'horse_id' => $horse->id,
                'stake' => 15.00,
            ]);

        $response->assertStatus(201);
        $ticket = Ticket::with('horseRacingBet')->first();
        $this->assertNotNull($ticket);
        $this->assertEquals(52.50, (float) $ticket->potential_payout);

        $bet = $ticket->horseRacingBet;
        $this->assertNotNull($bet);
        $this->assertEquals(HorseRacingBet::TYPE_GANADOR, $bet->bet_type);
        $this->assertEquals($race->id, $bet->race_id);
        $this->assertIsArray($bet->selections);
    }

    public function test_pos_saves_simple_ganador_with_multiple_horses_and_individual_amounts(): void
    {
        $race = Race::create([
            'name' => '2da Carrera',
            'meeting' => 'Reunión 50',
            'track' => 'La Rinconada',
            'race_date' => now()->addHours(1),
            'status' => Race::STATUS_PENDING,
        ]);

        $h1 = Horse::create([
            'race_id' => $race->id,
            'number' => 2,
            'name' => 'Papá Pedro',
            'dividend' => 3.00,
            'is_retired' => false,
        ]);

        $h2 = Horse::create([
            'race_id' => $race->id,
            'number' => 5,
            'name' => 'Gran Pepe',
            'dividend' => 5.00,
            'is_retired' => false,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->postJson('/api/taquilla/tickets', [
                'type' => Ticket::TYPE_HIPISMO,
                'bet_type' => HorseRacingBet::TYPE_GANADOR,
                'race_id' => $race->id,
                'horses' => [
                    ['horse_id' => $h1->id, 'amount' => 10.00],
                    ['horse_id' => $h2->id, 'amount' => 20.00],
                ],
            ]);

        $response->assertStatus(201);

        $ticket = Ticket::with(['selections', 'horseRacingBet'])->latest('id')->first();
        $this->assertNotNull($ticket);
        // El monto total del ticket debe ser la suma de los montos de cada caballo jugado (10 + 20 = 30)
        $this->assertEquals(30.00, (float) $ticket->stake);
        $this->assertCount(2, $ticket->selections);

        // Selections individuales con sus montos
        $sel1 = $ticket->selections->firstWhere('horse_id', $h1->id);
        $sel2 = $ticket->selections->firstWhere('horse_id', $h2->id);
        $this->assertNotNull($sel1);
        $this->assertNotNull($sel2);
        $this->assertEquals(10.00, (float) $sel1->amount);
        $this->assertEquals(20.00, (float) $sel2->amount);

        // Ganancia potencial máxima calculada entre las selecciones (20 * 5.00 = 100.00)
        $this->assertEquals(100.00, (float) $ticket->potential_payout);

        // Horse racing bet metadata
        $this->assertEquals(2, $ticket->horseRacingBet->combinations_count);
        $this->assertCount(2, $ticket->horseRacingBet->selections[0]['horses']);

        // Ahora simulamos la finalización de la carrera con Gran Pepe (h2) como ganador oficial a dividendo 4.00
        $admin = User::factory()->create(['role' => 'administrador']);
        $adminToken = auth('api')->login($admin);

        $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/admin/races/{$race->id}/result", [
                'winner_horse_id' => $h2->id,
                'winner_dividend' => 4.00,
            ])
            ->assertStatus(200);

        // Liquidación del ticket: debe pagar 20 * 4.00 = 80.00
        $settlement = app(\App\Services\TicketSettlementService::class)->settle($ticket);
        $this->assertEquals(Ticket::SETTLEMENT_WON, $settlement['status']);
        $this->assertEquals(80.00, (float) $settlement['payable']);

        // Verificar el estado de las patas (legs)
        $leg1 = collect($settlement['legs'])->firstWhere('selection_id', $sel1->id);
        $leg2 = collect($settlement['legs'])->firstWhere('selection_id', $sel2->id);
        $this->assertEquals(TicketSelection::SETTLEMENT_LOST, $leg1['status']);
        $this->assertEquals(0.00, (float) $leg1['payout']);
        $this->assertEquals(TicketSelection::SETTLEMENT_WON, $leg2['status']);
        $this->assertEquals(80.00, (float) $leg2['payout']);
    }

    public function test_horse_jockey_can_be_registered_and_is_included_in_ticket_and_catalog(): void
    {
        $race = Race::create([
            'name' => '3ra Carrera Especial',
            'meeting' => 'Reunión 48',
            'track' => 'La Rinconada',
            'race_date' => now()->addHours(2),
            'status' => Race::STATUS_PENDING,
        ]);

        $horse = Horse::create([
            'race_id' => $race->id,
            'number' => 7,
            'name' => 'El De Froix',
            'jockey' => 'R. Capriles',
            'dividend' => 4.20,
            'is_retired' => false,
        ]);

        // 1. Verificamos catálogo de taquilla
        $catalogResponse = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->getJson('/api/taquilla/catalog');
        $catalogResponse->assertStatus(200);

        $raceInCatalog = collect($catalogResponse->json('data.races'))->firstWhere('id', $race->id);
        $this->assertNotNull($raceInCatalog);
        $horseInCatalog = collect($raceInCatalog['horses'])->firstWhere('id', $horse->id);
        $this->assertEquals('R. Capriles', $horseInCatalog['jockey']);

        // 2. Emitimos ticket simple y verificamos que incluye el jinete en la selección
        $ticketResponse = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->postJson('/api/taquilla/tickets', [
                'type' => Ticket::TYPE_HIPISMO,
                'bet_type' => HorseRacingBet::TYPE_GANADOR,
                'race_id' => $race->id,
                'horse_id' => $horse->id,
                'stake' => 20.00,
            ]);

        $ticketResponse->assertStatus(201);
        $ticket = Ticket::latest('id')->first();
        $this->assertStringContainsString('R. Capriles', $ticket->selections[0]['selection_label']);
        $this->assertEquals('R. Capriles', $ticket->selections[0]['metadata']['jockey']);

        // 3. Modificamos el jinete vía endpoint de administración
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
        ]);
        $adminToken = auth('api')->login($admin);

        $updateResponse = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/admin/races/{$race->id}/horses/{$horse->id}", [
                'number' => 7,
                'name' => 'El De Froix',
                'jockey' => 'J. C. Rodríguez',
                'dividend' => 4.50,
            ]);

        $updateResponse->assertStatus(200);
        $horse->refresh();
        $this->assertEquals('J. C. Rodríguez', $horse->jockey);
    }

    public function test_admin_can_update_meeting_in_bulk_and_edit_individual_race(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
        ]);
        $adminToken = auth('api')->login($admin);

        $race1 = Race::create([
            'name' => '1ra Carrera',
            'meeting' => 'Reunión 99 Error',
            'track' => 'Valencia',
            'race_date' => now()->addHours(1),
            'status' => Race::STATUS_PENDING,
            'is_valida' => false,
        ]);

        $race2 = Race::create([
            'name' => '2da Carrera',
            'meeting' => 'Reunión 99 Error',
            'track' => 'Valencia',
            'race_date' => now()->addHours(2),
            'status' => Race::STATUS_PENDING,
            'is_valida' => true,
            'valida_number' => 1,
        ]);

        // 1. Corregir reunión completa en lote
        $bulkResponse = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson('/api/admin/meetings/update', [
                'current_meeting' => 'Reunión 99 Error',
                'new_meeting' => 'Reunión 100 Oficial',
                'track' => 'La Rinconada',
            ]);

        $bulkResponse->assertStatus(200);
        $this->assertEquals(2, $bulkResponse->json('updated_count'));

        $race1->refresh();
        $race2->refresh();
        $this->assertEquals('Reunión 100 Oficial', $race1->meeting);
        $this->assertEquals('La Rinconada', $race1->track);
        $this->assertEquals('Reunión 100 Oficial', $race2->meeting);
        $this->assertEquals('La Rinconada', $race2->track);

        // 2. Corregir un registro de carrera individual
        $individualResponse = $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/admin/races/{$race1->id}", [
                'name' => '1ra Carrera Corregida (Especial)',
                'meeting' => 'Reunión 100 Oficial',
                'track' => 'La Rinconada',
                'is_valida' => true,
                'valida_number' => 2,
            ]);

        $individualResponse->assertStatus(200);
        $race1->refresh();
        $this->assertEquals('1ra Carrera Corregida (Especial)', $race1->name);
        $this->assertTrue($race1->is_valida);
        $this->assertEquals(2, $race1->valida_number);
    }

    public function test_cinco_y_seis_ticket_is_lost_if_any_single_valid_race_is_lost(): void
    {
        $meeting = 'Reunión 50 - 5y6 Test';
        $races = [];
        $selections = [];

        for ($i = 1; $i <= 6; $i++) {
            $race = Race::create([
                'name' => "{$i}ª Válida",
                'meeting' => $meeting,
                'track' => 'La Rinconada',
                'race_date' => now()->addHours($i),
                'status' => Race::STATUS_PENDING,
                'is_valida' => true,
                'valida_number' => $i,
            ]);

            $h1 = Horse::create([
                'race_id' => $race->id,
                'number' => 1,
                'name' => "Caballo A{$i}",
                'dividend' => 2.50,
                'is_retired' => false,
            ]);

            $h2 = Horse::create([
                'race_id' => $race->id,
                'number' => 2,
                'name' => "Caballo B{$i}",
                'dividend' => 3.50,
                'is_retired' => false,
            ]);

            $races[$i] = ['race' => $race, 'h1' => $h1, 'h2' => $h2];
            $selections[] = [
                'race_id' => $race->id,
                'horse_ids' => [$h1->id],
            ];
        }

        // Emitir ticket en taquilla
        $ticketRes = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->postJson('/api/taquilla/tickets', [
                'type' => Ticket::TYPE_HIPISMO,
                'bet_type' => HorseRacingBet::TYPE_CINCO_Y_SEIS,
                'meeting' => $meeting,
                'stake' => 20.00,
                'selections' => $selections,
            ]);

        $ticketRes->assertStatus(201);
        $ticketId = $ticketRes->json('data.id');

        // Ganan las válidas 1 a 5 con el caballo 1 (aciertos = 5)
        for ($i = 1; $i <= 5; $i++) {
            $races[$i]['race']->update([
                'status' => Race::STATUS_FINISHED,
                'winner_horse_id' => $races[$i]['h1']->id,
            ]);
        }

        // Pero la válida 6 la gana el caballo 2 (falló 1 de las 6)
        $races[6]['race']->update([
            'status' => Race::STATUS_FINISHED,
            'winner_horse_id' => $races[6]['h2']->id,
        ]);

        // Consultar liquidación del ticket
        $settleRes = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->getJson("/api/taquilla/tickets/{$ticketId}/settlement");

        $settleRes->assertStatus(200);
        $this->assertEquals(Ticket::SETTLEMENT_LOST, $settleRes->json('data.status'));
        $this->assertEquals(0.00, (float) $settleRes->json('data.payable'));
        $this->assertStringContainsString('se deben acertar las 6 válidas para ganar', $settleRes->json('data.note'));

        // Intento de cobro en taquilla debe ser rechazado
        $payRes = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticketId}/pay", [
                'paid_amount' => 20.00,
            ]);
        $payRes->assertStatus(422);
    }

    public function test_cinco_y_seis_ticket_is_won_when_all_6_valid_races_are_won(): void
    {
        $meeting = 'Reunión 51 - 5y6 Winner';
        $races = [];
        $selections = [];

        for ($i = 1; $i <= 6; $i++) {
            $race = Race::create([
                'name' => "{$i}ª Válida",
                'meeting' => $meeting,
                'track' => 'La Rinconada',
                'race_date' => now()->addHours($i),
                'status' => Race::STATUS_PENDING,
                'is_valida' => true,
                'valida_number' => $i,
            ]);

            $h1 = Horse::create([
                'race_id' => $race->id,
                'number' => 1,
                'name' => "Caballo Ganador {$i}",
                'dividend' => 2.00,
                'is_retired' => false,
            ]);

            $races[$i] = ['race' => $race, 'h1' => $h1];
            $selections[] = [
                'race_id' => $race->id,
                'horse_ids' => [$h1->id],
            ];
        }

        $ticketRes = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->postJson('/api/taquilla/tickets', [
                'type' => Ticket::TYPE_HIPISMO,
                'bet_type' => HorseRacingBet::TYPE_CINCO_Y_SEIS,
                'meeting' => $meeting,
                'stake' => 50.00,
                'selections' => $selections,
            ]);

        $ticketRes->assertStatus(201);
        $ticketId = $ticketRes->json('data.id');

        // Ganan las 6 carreras válidas
        for ($i = 1; $i <= 6; $i++) {
            $races[$i]['race']->update([
                'status' => Race::STATUS_FINISHED,
                'winner_horse_id' => $races[$i]['h1']->id,
            ]);
        }

        $settleRes = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->getJson("/api/taquilla/tickets/{$ticketId}/settlement");

        $settleRes->assertStatus(200);
        $this->assertEquals(Ticket::SETTLEMENT_WON, $settleRes->json('data.status'));
        $this->assertGreaterThan(0.00, (float) $settleRes->json('data.payable'));
        $this->assertStringContainsString('Acertó las 6 carreras válidas', $settleRes->json('data.note'));

        // Cobro en taquilla aprobado
        $payRes = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->postJson("/api/taquilla/tickets/{$ticketId}/pay", [
                'paid_amount' => (float) $settleRes->json('data.payable'),
            ]);
        $payRes->assertStatus(200);
    }

    public function test_ganador_bet_multiplies_dividend_by_ganadores_played_and_calculates_stake_by_ganador_price(): void
    {
        $race = Race::create([
            'name' => '1ra Carrera',
            'meeting' => 'Reunión 55',
            'track' => 'La Rinconada',
            'ganador_price' => 100.00,
            'race_date' => now()->addHours(1),
            'status' => Race::STATUS_PENDING,
        ]);

        $horse1 = Horse::create([
            'race_id' => $race->id,
            'number' => 3,
            'name' => 'Krakatoa',
            'dividend' => 250.00,
            'is_retired' => false,
        ]);

        $horse2 = Horse::create([
            'race_id' => $race->id,
            'number' => 7,
            'name' => 'Fast Sensations',
            'dividend' => 120.00,
            'is_retired' => false,
        ]);

        // Jugamos 2 ganadores a Krakatoa (2 * 100 Bs = 200 Bs de apuesta)
        $response = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->postJson('/api/taquilla/tickets', [
                'type' => Ticket::TYPE_HIPISMO,
                'bet_type' => HorseRacingBet::TYPE_GANADOR,
                'race_id' => $race->id,
                'horses' => [
                    ['horse_id' => $horse1->id, 'ganadores' => 2],
                ],
            ]);

        $response->assertStatus(201);
        $ticketId = $response->json('data.id');

        $ticket = Ticket::with(['selections', 'horseRacingBet'])->find($ticketId);
        $this->assertNotNull($ticket);

        // Monto de la apuesta: 2 ganadores * 100 Bs = 200 Bs
        $this->assertEquals(200.00, (float) $ticket->stake);

        // Premio potencial: 2 ganadores * 250 dividend = 500 Bs (NUNCA 200 * 250 = 50000)
        $this->assertEquals(500.00, (float) $ticket->potential_payout);

        $sel = $ticket->selections->first();
        $this->assertEquals(2, $sel->metadata['ganadores']);
        $this->assertEquals(100.00, (float) $sel->metadata['ganador_price']);

        // Ahora finaliza la carrera y el dividendo oficial de Krakatoa es 280.00 Bs
        $admin = User::factory()->create(['role' => 'administrador']);
        $adminToken = auth('api')->login($admin);

        $this->withHeader('Authorization', "Bearer {$adminToken}")
            ->putJson("/api/admin/races/{$race->id}/result", [
                'winner_horse_id' => $horse1->id,
                'winner_dividend' => 280.00,
            ])
            ->assertStatus(200);

        // El ticket actualizado debe tener potential_payout = 2 * 280.00 = 560.00
        $ticket->refresh();
        $this->assertEquals(560.00, (float) $ticket->potential_payout);

        // La liquidación debe pagar 2 ganadores * 280.00 = 560.00 Bs
        $settleRes = $this->withHeader('Authorization', "Bearer {$this->taquillaToken}")
            ->getJson("/api/taquilla/tickets/{$ticketId}/settlement");

        $settleRes->assertStatus(200);
        $this->assertEquals(Ticket::SETTLEMENT_WON, $settleRes->json('data.status'));
        $this->assertEquals(560.00, (float) $settleRes->json('data.payable'));
    }
}

