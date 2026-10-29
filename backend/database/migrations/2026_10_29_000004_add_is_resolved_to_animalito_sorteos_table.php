<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * is_resolved distingue un resultado real de un placeholder pendiente.
 * La validación de pago solo toma en cuenta los sorteos resueltos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('animalito_sorteos', function (Blueprint $table) {
            $table->boolean('is_resolved')->default(true)->after('es_manual');
        });
    }

    public function down(): void
    {
        Schema::table('animalito_sorteos', function (Blueprint $table) {
            $table->dropColumn('is_resolved');
        });
    }
};
