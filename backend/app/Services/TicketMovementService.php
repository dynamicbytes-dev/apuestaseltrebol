<?php

namespace App\Services;

use App\Models\Ticket;
use App\Models\TicketMovement;
use App\Models\User;

/**
 * Registra la trazabilidad de cada cambio de estado de un ticket.
 */
class TicketMovementService
{
    public function record(
        Ticket $ticket,
        string $type,
        ?User $actor = null,
        ?string $fromStatus = null,
        ?string $toStatus = null,
        ?float $amount = null,
        ?string $notes = null,
        array $metadata = []
    ): TicketMovement {
        return TicketMovement::create([
            'ticket_id' => $ticket->id,
            'agency_id' => $ticket->agency_id,
            'user_id' => $actor?->id,
            'type' => $type,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'amount' => $amount,
            'notes' => $notes,
            'metadata' => $metadata ?: null,
        ]);
    }
}
