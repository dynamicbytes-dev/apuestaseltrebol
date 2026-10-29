<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SessionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // La duración de la sesión se toma de la configuración.
        config(['jwt.ttl' => 45]);
    }

    public function test_el_login_usa_el_ttl_configurado(): void
    {
        User::factory()->create([
            'email' => 'admin@eltrebol.com',
            'password' => 'secreto123',
            'role' => 'administrador',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@eltrebol.com',
            'password' => 'secreto123',
        ]);

        $response->assertStatus(200);

        // 45 minutos -> 2700 segundos.
        $this->assertEquals(2700, $response->json('expires_in'));
        $this->assertNotEmpty($response->json('token'));
        $this->assertEquals('bearer', $response->json('token_type'));
    }

    public function test_el_refresh_renueva_el_token(): void
    {
        User::factory()->create([
            'email' => 'admin@eltrebol.com',
            'password' => 'secreto123',
            'role' => 'administrador',
        ]);

        $login = $this->postJson('/api/auth/login', [
            'email' => 'admin@eltrebol.com',
            'password' => 'secreto123',
        ]);

        $token = $login->json('token');

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/auth/refresh');

        $response->assertStatus(200);
        $this->assertNotEmpty($response->json('token'));
        $this->assertEquals(2700, $response->json('expires_in'));
        $this->assertEquals('administrador', $response->json('user.role'));
    }

    public function test_el_refresh_requiere_un_token_valido(): void
    {
        $this->postJson('/api/auth/refresh')->assertStatus(401);
    }

    public function test_el_ttl_por_defecto_si_no_esta_configurado(): void
    {
        config(['jwt.ttl' => 0]);

        User::factory()->create([
            'email' => 'admin@eltrebol.com',
            'password' => 'secreto123',
            'role' => 'administrador',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@eltrebol.com',
            'password' => 'secreto123',
        ]);

        $response->assertStatus(200);
        // 0 significa "sin límite": se aplica el valor por defecto de 60 min.
        $this->assertEquals(3600, $response->json('expires_in'));
    }
}
