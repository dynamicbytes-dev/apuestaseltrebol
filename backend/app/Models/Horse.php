<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Horse extends Model
{
    use HasFactory;

    protected $fillable = [
        'race_id',
        'number',
        'name',
        'jockey',
        'dividend',
        'is_retired',
    ];

    protected $casts = [
        'number' => 'integer',
        'dividend' => 'decimal:2',
        'is_retired' => 'boolean',
    ];

    public function race(): BelongsTo
    {
        return $this->belongsTo(Race::class);
    }
}
