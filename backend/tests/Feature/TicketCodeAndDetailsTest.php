<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Horse;
use App\Models\Race;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TicketCodeAndDetailsTest extends TestCase
{
    use RefreshDatabase;

    public function test_ticket_code_is_strictly_numeric_and_eight_digits(): void
    {
        $agency = Agency::create([
            'name' => 'Agencia Los Chaguaramos',
            'slug' => 'agencia-los-chaguaramos',
        ]);
        $supervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $agency->id,
        ]);
        $taquilla = User::factory()->create([
            'name' => 'Taquilla Principal 01',
            'role' => 'taquilla',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
        ]);

        $race = Race::create([
            'name' => '5ta Carrera Clásico',
            'track' => 'La Rinconada',
            'meeting' => 'Reunión 12',
            'race_date' => now()->addHours(3),
            'status' => Race::STATUS_PENDING,
        ]);

        $horse = Horse::create([
            'race_id' => $race->id,
            'number' => 5,
            'name' => 'Catire Pedro',
            'dividend' => 3.50,
            'is_retired' => false,
        ]);

        $taquillaToken = auth('api')->login($taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson('/api/taquilla/tickets', [
                'type' => Ticket::TYPE_HIPISMO,
                'stake' => 100,
                'race_id' => $race->id,
                'horse_id' => $horse->id,
            ]);

        $response->assertStatus(201);
        $data = $response->json('data');

        // Código numérico de máximo 8 dígitos
        $this->assertMatchesRegularExpression('/^[0-9]{8}$/', $data['code']);
        $this->assertEquals(8, strlen($data['code']));
        $this->assertTrue(ctype_digit($data['code']));

        // Datos de comercio: agencia y taquilla cargados
        $this->assertEquals('Agencia Los Chaguaramos', $data['agency']['name']);
        $this->assertEquals('Taquilla Principal 01', $data['taquilla']['name']);

        // Jugadas contienen metadata de la reunión / carrera
        $this->assertNotEmpty($data['selections']);
        $this->assertEquals('Reunión 12', $data['selections'][0]['metadata']['meeting']);
    }

    public function test_parley_ticket_includes_bet_team_in_selection_metadata(): void
    {
        $agency = Agency::create([
            'name' => 'Agencia Altamira',
            'slug' => 'agencia-altamira',
        ]);
        $supervisor = User::factory()->create([
            'role' => 'supervisor',
            'agency_id' => $agency->id,
        ]);
        $taquilla = User::factory()->create([
            'name' => 'Taquilla 2',
            'role' => 'taquilla',
            'agency_id' => $agency->id,
            'supervisor_id' => $supervisor->id,
        ]);

        $taquillaToken = auth('api')->login($taquilla);

        $response = $this->withHeader('Authorization', "Bearer {$taquillaToken}")
            ->postJson('/api/taquilla/tickets', [
                'type' => Ticket::TYPE_PARLEY,
                'stake' => 50,
                'selections' => [
                    [
                        'sport' => 'football',
                        'event_id' => 'evt_101',
                        'event_name' => 'Real Madrid vs Barcelona',
                        'market' => 'Ganador del Partido',
                        'selection' => 'Home',
                        'home' => 'Real Madrid',
                        'away' => 'Barcelona',
                        'odd' => 1.95,
                        'league' => 'La Liga',
                    ],
                    [
                        'sport' => 'football',
                        'event_id' => 'evt_102',
                        'event_name' => 'Arsenal vs Chelsea',
                        'market' => 'Ganador del Partido',
                        'selection' => 'Arsenal',
                        'home' => 'Arsenal',
                        'away' => 'Chelsea',
                        'odd' => 1.80,
                        'league' => 'Premier League',
                    ],
                ],
            ]);

        $response->assertStatus(201);
        $data = $response->json('data');

        $this->assertCount(2, $data['selections']);
        // La primera selección tenía 'Home' con home 'Real Madrid' -> equipo debe ser 'Real Madrid'
        $this->assertEquals('Real Madrid', $data['selections'][0]['metadata']['team']);
        // La segunda selección tenía directamente 'Arsenal' -> equipo debe ser 'Arsenal'
        $this->assertEquals('Arsenal', $data['selections'][1]['metadata']['team']);
    }
}

