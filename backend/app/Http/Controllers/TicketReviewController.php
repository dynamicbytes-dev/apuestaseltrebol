<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\TicketMovement;
use App\Models\TicketSelection;
use App\Models\User;
use App\Services\TicketMovementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Revisión manual de tickets que el motor de liquidación no pudo resolver
 * (mercado no reconocido, evento no disponible en el proveedor, evento
 * aplazado o cancelado).
 */
class TicketReviewController extends Controller
{
    public function __construct(private readonly TicketMovementService $movements) {}

    public function store(Request $request, Ticket $ticket): JsonResponse
    {
        /** @var User $supervisor */
        $supervisor = auth('api')->user();

        $this->ensureOwnedByAgency($ticket, $supervisor);

        if ($ticket->status !== Ticket::STATUS_PENDING) {
            return response()->json([
                'message' => 'Solo se pueden revisar tickets pendientes.',
            ], 422);
        }

        $data = $request->validate([
            'decision' => ['required', Rule::in([
                Ticket::SETTLEMENT_WON,
                Ticket::SETTLEMENT_LOST,
            ])],
            'notes' => ['required', 'string', 'max:500'],
        ], [
            'decision.required' => 'Debe indicar la decisión de la revisión.',
            'decision.in' => 'La decisión de la revisión no es válida.',
            'notes.required' => 'Debe indicar el motivo de la decisión.',
        ]);

        $previousStatus = $ticket->settlement_status;

        $ticket->update([
            'settlement_status' => $data['decision'],
            'settlement_note' => $data['notes'],
            // La decisión manual tiene prioridad sobre el motor automático.
            'settlement_source' => 'manual',
        ]);

        // Las piernas que seguían sin resolver se alinean con la decisión.
        // El where va agrupado: sin el closure, el orWhere se aplicaría
        // fuera del filtro por ticket y tocaría selecciones ajenas.
        $ticket->selections()
            ->where(function ($query) {
                $query->where('settlement_status', TicketSelection::SETTLEMENT_PENDING)
                    ->orWhere('settlement_status', TicketSelection::SETTLEMENT_REVIEW);
            })
            ->update([
                'settlement_status' => $data['decision'],
                'settlement_note' => $data['notes'],
                'settled_at' => now(),
            ]);

        $this->movements->record(
            $ticket,
            $data['decision'] === Ticket::SETTLEMENT_WON
                ? TicketMovement::TYPE_SETTLEMENT_WON
                : TicketMovement::TYPE_SETTLEMENT_LOST,
            $supervisor,
            fromStatus: $previousStatus,
            toStatus: $data['decision'],
            notes: $data['notes'],
            metadata: ['source' => 'manual_review'],
        );

        return response()->json([
            'data' => $ticket->load(['selections', 'agency', 'taquilla']),
            'message' => $data['decision'] === Ticket::SETTLEMENT_WON
                ? 'Ticket marcado como ganador. Ya puede pagarse en taquilla.'
                : 'Ticket marcado como perdedor. No podrá pagarse.',
        ]);
    }

    private function ensureOwnedByAgency(Ticket $ticket, User $supervisor): void
    {
        abort_unless(
            $supervisor->agency_id !== null && $ticket->agency_id === $supervisor->agency_id,
            404
        );
    }
}
