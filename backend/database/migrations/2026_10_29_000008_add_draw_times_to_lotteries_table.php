<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Horarios de sorteo de cada lotería: lista de horas del día (HH:MM) en las
 * que se juega. El jugador elige uno de estos horarios al apostar y el
 * backend exige que la hora escolhida sea una de las configuradas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lotteries', function (Blueprint $table) {
            $table->json('draw_times')->nullable()->after('source_url');
        });
    }

    public function down(): void
    {
        Schema::table('lotteries', function (Blueprint $table) {
            $table->dropColumn('draw_times');
        });
    }
};
