<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketSelection extends Model
{
    use HasFactory;

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
        'selection_label',
        'odd',
        'metadata',
    ];

    protected $casts = [
        'lottery_id' => 'integer',
        'lottery_animal_id' => 'integer',
        'race_id' => 'integer',
        'horse_id' => 'integer',
        'odd' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }
}
