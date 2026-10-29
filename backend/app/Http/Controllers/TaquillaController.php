<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TaquillaController extends Controller
{
    public function __construct(private readonly AnalyticsService $analytics) {}

    /**
     * Taquillas del supervisor con sus ventas y el porciento que
     * corresponde sobre cada una.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $supervisor */
        $supervisor = auth('api')->user();

        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ], [
            'from.date_format' => 'La fecha inicial debe tener el formato AAAA-MM-DD.',
            'to.date_format' => 'La fecha final debe tener el formato AAAA-MM-DD.',
            'to.after_or_equal' => 'La fecha final no puede ser anterior a la inicial.',
        ]);

        $ventas = $this->analytics->taquillaSales(
            $data['from'] ?? null,
            $data['to'] ?? null,
            $supervisor->id
        );

        $taquillas = User::where('role', User::ROLE_TICKETER)
            ->where('supervisor_id', $supervisor->id)
            ->orderBy('name')
            ->get()
            ->map(fn (User $taquilla) => $this->formatTaquilla($taquilla, $ventas));

        return response()->json(['data' => $taquillas]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $supervisor */
        $supervisor = auth('api')->user();

        if ($supervisor->agency_id === null) {
            return response()->json([
                'message' => 'Tu usuario no tiene una agencia asignada. Contacta al administrador.',
            ], 422);
        }

        $data = $this->validateTaquilla($request);

        $taquilla = User::create([
            ...$data,
            'role' => User::ROLE_TICKETER,
            'agency_id' => $supervisor->agency_id,
            'supervisor_id' => $supervisor->id,
            'commission_percentage' => $data['commission_percentage']
                ?? $this->defaultCommissionPercentage(),
        ]);

        return response()->json([
            'data' => $this->formatTaquilla($taquilla),
        ], 201);
    }

    public function update(Request $request, User $taquilla): JsonResponse
    {
        $this->ensureOwnedBySupervisor($taquilla);

        $data = $this->validateTaquilla($request, $taquilla);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $taquilla->update($data);

        return response()->json([
            'data' => $this->formatTaquilla($taquilla),
        ]);
    }

    public function destroy(User $taquilla): JsonResponse
    {
        $this->ensureOwnedBySupervisor($taquilla);

        if ($taquilla->tickets()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar una taquilla con tickets registrados.',
            ], 422);
        }

        $taquilla->delete();

        return response()->json(['message' => 'Taquilla eliminada correctamente.']);
    }

    private function ensureOwnedBySupervisor(User $taquilla): void
    {
        /** @var User $supervisor */
        $supervisor = auth('api')->user();

        abort_unless(
            $taquilla->role === User::ROLE_TICKETER
            && $taquilla->supervisor_id === $supervisor->id,
            404
        );
    }

    private function validateTaquilla(Request $request, ?User $taquilla = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($taquilla?->id),
            ],
            'password' => [$taquilla ? 'nullable' : 'required', 'string', 'min:6'],
            'commission_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ], [
            'name.required' => 'El nombre de la taquilla es obligatorio.',
            'email.required' => 'El correo electrónico es obligatorio.',
            'email.email' => 'El correo electrónico no es válido.',
            'email.unique' => 'Ya existe un usuario con ese correo electrónico.',
            'password.required' => 'La contraseña es obligatoria.',
            'password.min' => 'La contraseña debe tener al menos 6 caracteres.',
            'commission_percentage.numeric' => 'El porcentaje de comisión debe ser un número.',
            'commission_percentage.min' => 'El porcentaje de comisión no puede ser negativo.',
            'commission_percentage.max' => 'El porcentaje de comisión no puede superar 100.',
        ]);
    }

    /**
     * Porcentaje por defecto para las taquillas nuevas.
     */
    private function defaultCommissionPercentage(): float
    {
        return round((float) config('business.supervisor_share', 0.13) * 100, 2);
    }

    private function formatTaquilla(User $taquilla, array $ventas = []): array
    {
        $porcentaje = (float) ($taquilla->commission_percentage ?? $this->defaultCommissionPercentage());

        $datos = $ventas[$taquilla->id] ?? [
            'tickets' => 0,
            'stake' => 0.0,
            'paid' => 0.0,
            'net' => 0.0,
            'share_percentage' => $porcentaje,
            'share_amount' => 0.0,
        ];

        return [
            'id' => $taquilla->id,
            'name' => $taquilla->name,
            'email' => $taquilla->email,
            'agency_id' => $taquilla->agency_id,
            'supervisor_id' => $taquilla->supervisor_id,
            'commission_percentage' => (float) ($taquilla->commission_percentage ?? $this->defaultCommissionPercentage()),
            'created_at' => $taquilla->created_at?->toISOString(),
            'sales' => $datos,
        ];
    }
}
