<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable;

    public const ROLE_ADMIN = 'administrador';

    public const ROLE_SUPERVISOR = 'supervisor';

    public const ROLE_TICKETER = 'taquilla';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'agency_id',
        'supervisor_id',
        'commission_percentage',
        'max_bet_amount',
        'max_ticket_payout',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'agency_id' => 'integer',
            'supervisor_id' => 'integer',
            'commission_percentage' => 'decimal:2',
            'max_bet_amount' => 'decimal:2',
            'max_ticket_payout' => 'decimal:2',
        ];
    }

    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims(): array
    {
        return [];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function supervisorOf(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function taquillas(): HasMany
    {
        return $this->hasMany(User::class, 'supervisor_id')
            ->where('role', self::ROLE_TICKETER);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'taquilla_id');
    }

    /**
     * Topes vigentes para este usuario.
     *
     * Si el usuario tiene topes propios, mandan; si no, se heredan los de su
     * agencia. Devuelve null cuando no hay ningun tope puesto.
     *
     * @return array{max_bet_amount: float|null, max_ticket_payout: float|null}
     */
    public function effectiveLimits(): array
    {
        $agency = $this->agency;

        return [
            'max_bet_amount' => $this->max_bet_amount ?? $agency?->max_bet_amount,
            'max_ticket_payout' => $this->max_ticket_payout ?? $agency?->max_ticket_payout,
        ];
    }
}
