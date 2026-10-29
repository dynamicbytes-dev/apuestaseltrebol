<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ticket extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_PAID = 'paid';

    public const STATUS_CANCELLED = 'cancelled';

    public const TYPE_ANIMALITOS = 'animalitos';

    public const TYPE_HIPISMO = 'hipismo';

    public const TYPE_PARLEY = 'parley';

    protected $fillable = [
        'code',
        'agency_id',
        'supervisor_id',
        'taquilla_id',
        'type',
        'stake',
        'total_odds',
        'potential_payout',
        'status',
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
}
