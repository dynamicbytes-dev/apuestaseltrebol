<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El ticket de animalitos declara a qué sorteo pertenece la apuesta
 * (sorteo_at) y cada selección guarda el monto apostado a ese animalito
 * (amount). El total del ticket es la suma de los montos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->timestamp('sorteo_at')->nullable()->after('type');
        });

        Schema::table('ticket_selections', function (Blueprint $table) {
            $table->decimal('amount', 12, 2)->nullable()->after('odd');
        });
    }

    public function down(): void
    {
        Schema::table('ticket_selections', function (Blueprint $table) {
            $table->dropColumn('amount');
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn('sorteo_at');
        });
    }
};
