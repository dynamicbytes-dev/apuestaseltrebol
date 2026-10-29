<?php

namespace App\Http\Controllers;

use App\Models\Agency;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AgencyController extends Controller
{
    public function index(): JsonResponse
    {
        $agencies = Agency::withCount([
            'users as supervisors_count' => fn ($query) => $query->where('role', User::ROLE_SUPERVISOR),
            'users as taquillas_count' => fn ($query) => $query->where('role', User::ROLE_TICKETER),
        ])->orderBy('name')->get();

        return response()->json(['data' => $agencies]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:agencies,name'],
        ], [
            'name.required' => 'El nombre de la agencia es obligatorio.',
            'name.unique' => 'Ya existe una agencia con ese nombre.',
        ]);

        $agency = Agency::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']).'-'.Str::lower(Str::random(5)),
        ]);

        return response()->json(['data' => $agency], 201);
    }

    public function update(Request $request, Agency $agency): JsonResponse
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('agencies', 'name')->ignore($agency->id),
            ],
        ], [
            'name.required' => 'El nombre de la agencia es obligatorio.',
            'name.unique' => 'Ya existe una agencia con ese nombre.',
        ]);

        $agency->update(['name' => $data['name']]);

        return response()->json(['data' => $agency]);
    }

    public function destroy(Agency $agency): JsonResponse
    {
        if ($agency->users()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar una agencia con usuarios asignados.',
            ], 422);
        }

        if ($agency->tickets()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar una agencia con tickets registrados.',
            ], 422);
        }

        $agency->delete();

        return response()->json(['message' => 'Agencia eliminada correctamente.']);
    }

    public function updateLimits(Request $request, Agency $agency): JsonResponse
    {
        $data = $request->validate([
            'max_bet_amount' => ['nullable', 'numeric', 'min:0'],
            'max_ticket_payout' => ['nullable', 'numeric', 'min:0'],
        ], [
            'max_bet_amount.numeric' => 'El monto máximo por apuesta debe ser un número.',
            'max_bet_amount.min' => 'El monto máximo por apuesta no puede ser negativo.',
            'max_ticket_payout.numeric' => 'La ganancia máxima por ticket debe ser un número.',
            'max_ticket_payout.min' => 'La ganancia máxima por ticket no puede ser negativa.',
        ]);

        $agency->update($data);

        return response()->json(['data' => $agency]);
    }
}
