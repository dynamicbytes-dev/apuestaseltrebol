<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnimalitoSorteo extends Model
{
    use HasFactory;

    protected $fillable = [
        'lottery_id',
        'race_id',
        'number',
        'animal',
        'caballo_ganador',
        'sorteo_at',
        'es_manual',
    ];

    protected $casts = [
        'number' => 'string',
        'es_manual' => 'boolean',
        'sorteo_at' => 'datetime',
    ];

    public function lottery(): BelongsTo
    {
        return $this->belongsTo(Lottery::class);
    }

    public function race(): BelongsTo
    {
        return $this->belongsTo(Race::class);
    }
}
