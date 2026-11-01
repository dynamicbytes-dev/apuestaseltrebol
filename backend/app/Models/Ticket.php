<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Ticket extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_PAID = 'paid';

    public const STATUS_CANCELLED = 'cancelled';

    public const TYPE_ANIMALITOS = 'animalitos';

    public const TYPE_HIPISMO = 'hipismo';

    public const TYPE_PARLEY = 'parley';

    /** La liquidación todavía no pudo resolverse. */
    public const SETTLEMENT_PENDING = 'pending';

    /** La jugada es ganadora: se puede pagar. */
    public const SETTLEMENT_WON = 'won';

    /** La jugada es perdedora: no se puede pagar. */
    public const SETTLEMENT_LOST = 'lost';

    /** La jugada requiere revisión manual del supervisor. */
    public const SETTLEMENT_REVIEW = 'review';

    protected $fillable = [
        'code',
        'agency_id',
        'supervisor_id',
        'taquilla_id',
        'type',
        'sorteo_at',
        'stake',
        'total_odds',
        'potential_payout',
        'status',
        'settlement_status',
        'settlement_note',
        'settlement_source',
        'paid_amount',
        'paid_at',
        'cancelled_at',
        'notes',
    ];

    protected $casts = [
        'agency_id' => 'integer',
        'supervisor_id' => 'integer',
        'taquilla_id' => 'integer',
        'stake' => 'decimal:2',
        'total_odds' => 'decimal:4',
        'potential_payout' => 'decimal:2',
        'sorteo_at' => 'datetime',
        'settlement_status' => 'string',
        'paid_amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function taquilla(): BelongsTo
    {
        return $this->belongsTo(User::class, 'taquilla_id');
    }

    public function selections(): HasMany
    {
        return $this->hasMany(TicketSelection::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(TicketMovement::class)->latest();
    }

    public function horseRacingBet(): HasOne
    {
        return $this->hasOne(HorseRacingBet::class);
    }
}
