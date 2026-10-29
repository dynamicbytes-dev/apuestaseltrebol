<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Normaliza los registros existentes a la nueva zona horaria de la operación.
 *
 * Antes de este cambio la app corría en UTC y escribía el reloj de pared en
 * UTC. Con APP_TIMEZONE=America/Caracas, el mismo reloj de pared pasa a
 * significar hora local, así que hay que reinterpretarlo para conservar el
 * instante.
 *
 * Se corrigen las columnas que escribía la aplicación. NO se corrigen las
 * fechas que escribía una persona: los sorteos registrados a mano por el
 * administrador ya estaban en hora local, y las fechas de carrera del mismo
 * modo.
 */
return new class extends Migration
{
    private const TIMEZONE = 'America/Caracas';

    /** Columnas escritas por la aplicación, por tabla. */
    private const APP_WRITTEN = [
        'users' => ['created_at', 'updated_at'],
        'agencies' => ['created_at', 'updated_at'],
        'lotteries' => ['created_at', 'updated_at'],
        'lottery_animals' => ['created_at', 'updated_at'],
        'races' => ['created_at', 'updated_at'],
        'horses' => ['created_at', 'updated_at'],
        'tickets' => ['created_at', 'updated_at', 'paid_at', 'cancelled_at'],
        'ticket_selections' => ['created_at', 'updated_at', 'settled_at'],
        'ticket_movements' => ['created_at', 'updated_at'],
        'animalito_sorteos' => ['created_at', 'updated_at'],
    ];

    public function up(): void
    {
        // El valor guardado era UTC: se reinterpreta como hora de Caracas.
        foreach (self::APP_WRITTEN as $table => $columns) {
            foreach ($columns as $column) {
                $this->reinterpret($table, $column, 'UTC', self::TIMEZONE);
            }
        }

        // El sorteo automático lo escribía el comando con la hora en UTC.
        // El manual lo escribe el administrador en hora local: no se toca.
        $this->reinterpret('animalito_sorteos', 'sorteo_at', 'UTC', self::TIMEZONE, function ($query) {
            $query->where('es_manual', false);
        });
    }

    public function down(): void
    {
        // La reversión deja los valores como estaban antes: UTC.
        foreach (self::APP_WRITTEN as $table => $columns) {
            foreach ($columns as $column) {
                $this->reinterpret($table, $column, self::TIMEZONE, 'UTC');
            }
        }
    }

    /**
     * Reinterpreta el reloj de pared guardado de una zona a otra, conservando
     * el instante.
     */
    private function reinterpret(
        string $table,
        string $column,
        string $from,
        string $to,
        ?callable $scope = null
    ): void {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        $query = DB::table($table)->whereNotNull($column);

        if ($scope) {
            $scope($query);
        }

        $query->chunkById(200, function ($rows) use ($table, $column, $from, $to) {
            foreach ($rows as $row) {
                $value = Carbon::parse($row->{$column}, $from)
                    ->setTimezone($to)
                    ->format('Y-m-d H:i:s');

                DB::table($table)
                    ->where('id', $row->id)
                    ->update([$column => $value]);
            }
        });
    }
};
