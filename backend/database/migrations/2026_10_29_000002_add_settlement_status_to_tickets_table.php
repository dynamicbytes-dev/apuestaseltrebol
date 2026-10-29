<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La liquidación (settlement) se separa del ciclo de pago:
 *   tickets.status          -> pending | paid | cancelled (ciclo del dinero)
 *   tickets.settlement_status -> pending | won | lost | review (ciclo del resultado)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('settlement_status')->default('pending')->after('status');
            $table->text('settlement_note')->nullable()->after('settlement_status');

            $table->index('settlement_status');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex(['settlement_status']);
            $table->dropColumn(['settlement_status', 'settlement_note']);
        });
    }
};
