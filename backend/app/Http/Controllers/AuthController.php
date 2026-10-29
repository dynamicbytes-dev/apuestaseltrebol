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

        $ttl = 5; // Duración máxima de la sesión: 5 minutos
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
