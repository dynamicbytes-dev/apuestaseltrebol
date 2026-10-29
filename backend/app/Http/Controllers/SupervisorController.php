<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SupervisorController extends Controller
{
    public function index(): JsonResponse
    {
        $supervisors = User::with('agency:id,name')
            ->withCount('taquillas')
            ->where('role', User::ROLE_SUPERVISOR)
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->formatSupervisor($user));

        return response()->json(['data' => $supervisors]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'agency_id' => ['required', 'integer', 'exists:agencies,id'],
        ], [
            'name.required' => 'El nombre del supervisor es obligatorio.',
            'email.required' => 'El correo electrónico es obligatorio.',
            'email.email' => 'El correo electrónico no es válido.',
            'email.unique' => 'Ya existe un usuario con ese correo electrónico.',
            'password.required' => 'La contraseña es obligatoria.',
            'password.min' => 'La contraseña debe tener al menos 6 caracteres.',
            'agency_id.required' => 'Debe seleccionar una agencia.',
            'agency_id.exists' => 'La agencia seleccionada no existe.',
        ]);

        $supervisor = User::create([
            ...$data,
            'role' => User::ROLE_SUPERVISOR,
        ]);

        return response()->json([
            'data' => $this->formatSupervisor($supervisor->load('agency:id,name')->loadCount('taquillas')),
        ], 201);
    }

    public function update(Request $request, User $supervisor): JsonResponse
    {
        abort_unless($supervisor->role === User::ROLE_SUPERVISOR, 404);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($supervisor->id),
            ],
            'password' => ['nullable', 'string', 'min:6'],
            'agency_id' => ['required', 'integer', 'exists:agencies,id'],
        ], [
            'name.required' => 'El nombre del supervisor es obligatorio.',
            'email.required' => 'El correo electrónico es obligatorio.',
            'email.email' => 'El correo electrónico no es válido.',
            'email.unique' => 'Ya existe un usuario con ese correo electrónico.',
            'password.min' => 'La contraseña debe tener al menos 6 caracteres.',
            'agency_id.required' => 'Debe seleccionar una agencia.',
            'agency_id.exists' => 'La agencia seleccionada no existe.',
        ]);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $supervisor->update($data);

        return response()->json([
            'data' => $this->formatSupervisor($supervisor->load('agency:id,name')->loadCount('taquillas')),
        ]);
    }

    public function destroy(User $supervisor): JsonResponse
    {
        abort_unless($supervisor->role === User::ROLE_SUPERVISOR, 404);

        if ($supervisor->taquillas()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar un supervisor con taquillas asignadas.',
            ], 422);
        }

        $supervisor->delete();

        return response()->json(['message' => 'Supervisor eliminado correctamente.']);
    }

    private function formatSupervisor(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'agency_id' => $user->agency_id,
            'agency' => $user->agency?->only(['id', 'name']),
            'taquillas_count' => $user->taquillas_count ?? 0,
            'created_at' => $user->created_at?->toISOString(),
        ];
    }
}
