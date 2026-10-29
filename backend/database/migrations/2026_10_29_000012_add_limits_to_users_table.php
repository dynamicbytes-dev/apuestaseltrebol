<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Topes propios de cada taquilla.
 *
 * Los topes de la agencia son el valor por defecto. Si una taquilla tiene
 * topes propios, estos mandan sobre los de la agencia.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('max_bet_amount', 12, 2)->nullable()->after('commission_percentage');
            $table->decimal('max_ticket_payout', 12, 2)->nullable()->after('max_bet_amount');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['max_bet_amount', 'max_ticket_payout']);
        });
    }
};
