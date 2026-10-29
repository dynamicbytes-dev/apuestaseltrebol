<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * El número de cada animalito pasa a ser texto para poder distinguir
 * "0" (Delfín) de "00" (Ballena), algo imposible con una columna entera.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE lottery_animals ALTER COLUMN "number" TYPE VARCHAR(2) USING "number"::VARCHAR(2)');

            return;
        }

        Schema::table('lottery_animals', function (Blueprint $table) {
            $table->string('number', 2)->change();
        });
    }

    public function down(): void
    {
        // "00" no es representable como entero: se elimina antes de revertir.
        DB::table('lottery_animals')->where('number', '00')->delete();

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE lottery_animals ALTER COLUMN "number" TYPE SMALLINT USING "number"::SMALLINT');

            return;
        }

        Schema::table('lottery_animals', function (Blueprint $table) {
            $table->unsignedTinyInteger('number')->change();
        });
    }
};
