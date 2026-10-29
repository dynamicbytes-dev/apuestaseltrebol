<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Porcentaje de comisión propio de cada taquilla.
 *
 * Antes el 13% era un valor global de la configuración. Cada taquilla tiene
 * ahora el suyo, que es el que se aplica sobre sus ventas y el que se
 * muestra en la tabla de taquillas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('commission_percentage', 5, 2)->default(13.00)->after('supervisor_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('commission_percentage');
        });
    }
};
