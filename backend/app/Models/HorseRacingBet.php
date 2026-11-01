<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HorseRacingBet extends Model
{
    use HasFactory;

    public const TYPE_GANADOR = 'ganador';
    public const TYPE_PLACE = 'place';
    public const TYPE_EXACTA = 'exacta';
    public const TYPE_TRIFECTA = 'trifecta';
    public const TYPE_POOL_DE_4 = 'pool_de_4';
    public const TYPE_POOL_DE_5 = 'pool_de_5';
    public const TYPE_CINCO_Y_SEIS = 'cinco_y_seis';

    public const BET_TYPES = [
        self::TYPE_GANADOR,
        self::TYPE_PLACE,
        self::TYPE_EXACTA,
        self::TYPE_TRIFECTA,
        self::TYPE_POOL_DE_4,
        self::TYPE_POOL_DE_5,
        self::TYPE_CINCO_Y_SEIS,
    ];

    protected $fillable = [
        'ticket_id',
        'bet_type',
        'meeting',
        'race_id',
        'selections',
        'combinations_count',
    ];

    protected $casts = [
        'ticket_id' => 'integer',
        'race_id' => 'integer',
        'selections' => 'array',
        'combinations_count' => 'integer',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function race(): BelongsTo
    {
        return $this->belongsTo(Race::class);
    }
}
