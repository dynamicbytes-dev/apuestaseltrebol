<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LotteryAnimal extends Model
{
    use HasFactory;

    protected $fillable = [
        'lottery_id',
        'number',
        'animal',
        'is_enabled',
    ];

    protected $casts = [
        'number' => 'string',
        'is_enabled' => 'boolean',
    ];

    public function lottery(): BelongsTo
    {
        return $this->belongsTo(Lottery::class);
    }
}
