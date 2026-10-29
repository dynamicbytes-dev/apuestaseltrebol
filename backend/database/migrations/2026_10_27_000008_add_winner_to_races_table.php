<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('races', function (Blueprint $table) {
            $table->foreignId('winner_horse_id')
                ->nullable()
                ->constrained('horses')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('races', function (Blueprint $table) {
            $table->dropConstrainedForeignId('winner_horse_id');
        });
    }
};
