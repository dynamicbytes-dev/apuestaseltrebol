<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $ttl = $this->sessionTtlMinutes();
        $token = auth('api')->setTTL($ttl)->attempt($credentials);

        if (! $token) {
            return response()->json(['message' => 'Credenciales inválidas.'], 401);
        }

        /** @var User $user */
        $user = auth('api')->user();

        return response()->json([
            'token' => $token,
            'token_type' => 'bearer',
            'expires_in' => $ttl * 60,
            'user' => $this->formatUser($user),
        ]);
    }

    /**
     * Renueva el token de la sesión activa.
     *
     * El token debe estar todavía vigente: el middleware de autenticación
     * rechaza los expirados antes de llegar aquí. El frontend renueva de
     * forma automática poco antes de que caduque.
     */
    public function refresh(): JsonResponse
    {
        $ttl = $this->sessionTtlMinutes();
        $token = auth('api')->setTTL($ttl)->refresh();

        if (! $token) {
            return response()->json(['message' => 'La sesión no se puede renovar.'], 401);
        }

        /** @var User $user */
        $user = auth('api')->user();

        return response()->json([
            'token' => $token,
            'token_type' => 'bearer',
            'expires_in' => $ttl * 60,
            'user' => $this->formatUser($user),
        ]);
    }

    public function me(): JsonResponse
    {
        /** @var User $user */
        $user = auth('api')->user();

        return response()->json(['user' => $this->formatUser($user)]);
    }

    public function logout(): JsonResponse
    {
        auth('api')->logout();

        return response()->json(['message' => 'Sesión cerrada correctamente.']);
    }

    /**
     * Duración de la sesión en minutos, tomada de JWT_TTL.
     */
    private function sessionTtlMinutes(): int
    {
        $ttl = (int) config('jwt.ttl', 60);

        return $ttl > 0 ? $ttl : 60;
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'agency_id' => $user->agency_id,
            'supervisor_id' => $user->supervisor_id,
            'agency' => $user->agency?->only(['id', 'name']),
        ];
    }
}
