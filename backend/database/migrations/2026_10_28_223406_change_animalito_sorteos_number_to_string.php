<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE animalito_sorteos ALTER COLUMN "number" TYPE VARCHAR(10) USING "number"::VARCHAR(10)');

            return;
        }

        Schema::table('animalito_sorteos', function (Blueprint $table) {
            $table->string('number', 10)->change();
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE animalito_sorteos ALTER COLUMN "number" TYPE INTEGER USING "number"::INTEGER');

            return;
        }

        Schema::table('animalito_sorteos', function (Blueprint $table) {
            $table->integer('number')->change();
        });
    }
};
