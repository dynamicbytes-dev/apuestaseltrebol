<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * URL de origen para el scraping automático del resultado de la lotería.
 * Si es null, el comando fetch:animalitos no intenta consultar ninguna
 * fuente y el resultado queda pendiente de ingreso manual por el admin.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lotteries', function (Blueprint $table) {
            $table->string('source_url')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('lotteries', function (Blueprint $table) {
            $table->dropColumn('source_url');
        });
    }
};
