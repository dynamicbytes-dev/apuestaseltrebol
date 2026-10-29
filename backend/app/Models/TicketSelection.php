<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketSelection extends Model
{
    use HasFactory;

    /** La pierna todavía no tiene resultado oficial. */
    public const SETTLEMENT_PENDING = 'pending';

    /** La pierna es ganadora. */
    public const SETTLEMENT_WON = 'won';

    /** La pierna es perdedora. */
    public const SETTLEMENT_LOST = 'lost';

    /** El mercado no se puede liquidar automáticamente: requiere revisión. */
    public const SETTLEMENT_REVIEW = 'review';

    protected $fillable = [
        'ticket_id',
        'lottery_id',
        'lottery_animal_id',
        'race_id',
        'horse_id',
        'sport',
        'external_event_id',
        'event_name',
        'market',
        'market_id',
        'selection_label',
        'odd',
        'settlement_status',
        'settlement_note',
        'settled_at',
        'metadata',
    ];

    protected $casts = [
        'lottery_id' => 'integer',
        'lottery_animal_id' => 'integer',
        'race_id' => 'integer',
        'horse_id' => 'integer',
        'market_id' => 'integer',
        'odd' => 'decimal:2',
        'settlement_status' => 'string',
        'settled_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function lottery(): BelongsTo
    {
        return $this->belongsTo(Lottery::class);
    }

    public function lotteryAnimal(): BelongsTo
    {
        return $this->belongsTo(LotteryAnimal::class);
    }

    public function race(): BelongsTo
    {
        return $this->belongsTo(Race::class);
    }

    public function horse(): BelongsTo
    {
        return $this->belongsTo(Horse::class);
    }
}
