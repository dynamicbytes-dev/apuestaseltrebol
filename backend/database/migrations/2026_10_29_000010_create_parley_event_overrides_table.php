<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Correcciones manuales del calendario de eventos deportivos.
 *
 * El proveedor puede devolver fechas equivocadas para un partido (partidos
 * aplazados, jornadas movidas). La aplicación no puede deducir la fecha
 * correcta, así que el administrador la corrige una vez y la corrección se
 * aplica en todas partes: apuestas, liquidación y cartelera.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parley_event_overrides', function (Blueprint $table) {
            $table->id();
            $table->string('sport');
            $table->string('external_event_id');
            $table->timestamp('starts_at');
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->unique(['sport', 'external_event_id']);
            $table->index('starts_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parley_event_overrides');
    }
};
