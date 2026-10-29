<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\TicketMovement;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Consulta del historial de movimientos y de los tickets de la agencia.
 */
class TicketMovementController extends Controller
{
    /**
     * Movimientos de un ticket propio de la taquilla.
     */
    public function ticketMovements(Request $request, Ticket $ticket): JsonResponse
    {
        abort_unless($ticket->taquilla_id === auth('api')->id(), 404);

        return $this->movementsResponse($ticket);
    }

    /**
     * Tickets de la agencia del supervisor, con filtros.
     */
    public function agencyTickets(Request $request): JsonResponse
    {
        /** @var User $supervisor */
        $supervisor = auth('api')->user();

        if ($supervisor->agency_id === null) {
            return response()->json(['data' => [], 'meta' => ['count' => 0]]);
        }

        $data = $request->validate([
            'status' => ['nullable', Rule::in([
                Ticket::STATUS_PENDING,
                Ticket::STATUS_PAID,
                Ticket::STATUS_CANCELLED,
            ])],
            'type' => ['nullable', Rule::in([
                Ticket::TYPE_ANIMALITOS,
                Ticket::TYPE_HIPISMO,
                Ticket::TYPE_PARLEY,
            ])],
            'settlement_status' => ['nullable', Rule::in([
                Ticket::SETTLEMENT_PENDING,
                Ticket::SETTLEMENT_WON,
                Ticket::SETTLEMENT_LOST,
                Ticket::SETTLEMENT_REVIEW,
            ])],
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $query = Ticket::with(['agency', 'taquilla', 'selections'])
            ->where('agency_id', $supervisor->agency_id)
            ->latest();

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        if (! empty($data['type'])) {
            $query->where('type', $data['type']);
        }

        if (! empty($data['settlement_status'])) {
            $query->where('settlement_status', $data['settlement_status']);
        }

        if (! empty($data['search'])) {
            // LOWER + LIKE funciona igual en PostgreSQL y en SQLite.
            $query->whereRaw('LOWER(code) LIKE ?', ['%'.mb_strtolower($data['search']).'%']);
        }

        if (! empty($data['from'])) {
            $query->whereDate('created_at', '>=', $data['from']);
        }

        if (! empty($data['to'])) {
            $query->whereDate('created_at', '<=', $data['to']);
        }

        $tickets = $query->limit(200)->get();

        return response()->json([
            'data' => $tickets,
            'meta' => ['count' => $tickets->count()],
        ]);
    }

    /**
     * Movimientos de un ticket de la agencia del supervisor.
     */
    public function agencyTicketMovements(Request $request, Ticket $ticket): JsonResponse
    {
        /** @var User $supervisor */
        $supervisor = auth('api')->user();

        abort_unless(
            $supervisor->agency_id !== null && $ticket->agency_id === $supervisor->agency_id,
            404
        );

        return $this->movementsResponse($ticket);
    }

    private function movementsResponse(Ticket $ticket): JsonResponse
    {
        $movements = TicketMovement::with('user:id,name,email')
            ->where('ticket_id', $ticket->id)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $movements,
            'meta' => ['count' => $movements->count()],
        ]);
    }
}
