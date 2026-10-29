<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsSupervisor
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('api');

        if ($user === null || $user->role !== User::ROLE_SUPERVISOR) {
            return response()->json(['message' => 'No tiene permisos para realizar esta acción.'], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
