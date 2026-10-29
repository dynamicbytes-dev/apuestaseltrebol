<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Distingue una liquidación automática de una decisión manual del supervisor.
 * Cuando la liquidación es manual, el motor automático no vuelve a
 * sobrescribir el resultado.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('settlement_source')->default('auto')->after('settlement_note');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn('settlement_source');
        });
    }
};
