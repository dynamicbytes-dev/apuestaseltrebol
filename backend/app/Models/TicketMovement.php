<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketMovement extends Model
{
    use HasFactory;

    /** El ticket fue emitido por la taquilla. */
    public const TYPE_CREATED = 'created';

    /** Se pagó el premio del ticket. */
    public const TYPE_PAID = 'paid';

    /** El ticket fue anulado por la taquilla. */
    public const TYPE_CANCELLED = 'cancelled';

    /** La liquidación automática determinó que la jugada es ganadora. */
    public const TYPE_SETTLEMENT_WON = 'settlement_won';

    /** La liquidación automática (+ o - manual) determinó que la jugada pierde. */
    public const TYPE_SETTLEMENT_LOST = 'settlement_lost';

    /** La jugada requiere revisión manual del supervisor. */
    public const TYPE_REVIEW = 'review';

    protected $fillable = [
        'ticket_id',
        'agency_id',
        'user_id',
        'type',
        'from_status',
        'to_status',
        'amount',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
