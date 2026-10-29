<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Race extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_FINISHED = 'finished';

    protected $fillable = [
        'name',
        'meeting',
        'track',
        'race_date',
        'status',
        'winner_horse_id',
        'second_horse_id',
        'third_horse_id',
    ];

    protected $casts = [
        'race_date' => 'datetime:Y-m-d\TH:i',
        'winner_horse_id' => 'integer',
        'second_horse_id' => 'integer',
        'third_horse_id' => 'integer',
    ];

    public function horses(): HasMany
    {
        return $this->hasMany(Horse::class)->orderBy('number');
    }

    public function winner(): BelongsTo
    {
        return $this->belongsTo(Horse::class, 'winner_horse_id');
    }

    public function second(): BelongsTo
    {
        return $this->belongsTo(Horse::class, 'second_horse_id');
    }

    public function third(): BelongsTo
    {
        return $this->belongsTo(Horse::class, 'third_horse_id');
    }
}
