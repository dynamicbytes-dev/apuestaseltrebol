<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Detalle de liquidación por cada pierna de la jugada.
 * market_id guarda el id del mercado en API-SPORTS (id numérico, estable
 * por deporte), necesario para liquidar la apuesta contra el resultado.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ticket_selections', function (Blueprint $table) {
            $table->integer('market_id')->nullable()->after('market');
            $table->string('settlement_status')->default('pending')->after('odd');
            $table->text('settlement_note')->nullable()->after('settlement_status');
            $table->timestamp('settled_at')->nullable()->after('settlement_note');

            $table->index('settlement_status');
        });
    }

    public function down(): void
    {
        Schema::table('ticket_selections', function (Blueprint $table) {
            $table->dropIndex(['settlement_status']);
            $table->dropColumn([
                'market_id',
                'settlement_status',
                'settlement_note',
                'settled_at',
            ]);
        });
    }
};
