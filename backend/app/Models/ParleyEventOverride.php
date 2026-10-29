<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Fecha corregida de un evento deportivo. Si existe, la aplicación usa esta
 * en lugar de la que devuelve el proveedor.
 */
class ParleyEventOverride extends Model
{
    use HasFactory;

    protected $fillable = [
        'sport',
        'external_event_id',
        'starts_at',
        'notes',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
    ];
}
