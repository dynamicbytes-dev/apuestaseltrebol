<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Lottery extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'is_active',
        'payout_multiplier',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'payout_multiplier' => 'decimal:2',
    ];

    public function animals(): HasMany
    {
        return $this->hasMany(LotteryAnimal::class)
            ->orderByRaw('CAST(number AS INTEGER) ASC, LENGTH(number) ASC');
    }
}
