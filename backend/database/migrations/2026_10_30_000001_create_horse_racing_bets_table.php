<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Campos de soporte para carreras válidas en la reunión
        Schema::table('races', function (Blueprint $table) {
            if (! Schema::hasColumn('races', 'is_valida')) {
                $table->boolean('is_valida')->default(false)->after('status');
            }
            if (! Schema::hasColumn('races', 'valida_number')) {
                $table->unsignedTinyInteger('valida_number')->nullable()->after('is_valida');
            }
        });

        Schema::create('horse_racing_bets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
            $table->enum('bet_type', [
                'ganador',
                'place',
                'exacta',
                'trifecta',
                'pool_de_4',
                'pool_de_5',
                'cinco_y_seis',
            ]);
            $table->string('meeting')->nullable()->index();
            $table->foreignId('race_id')->nullable()->constrained('races')->nullOnDelete();
            $table->json('selections');
            $table->unsignedInteger('combinations_count')->default(1);
            $table->timestamps();

            $table->index(['ticket_id', 'bet_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('horse_racing_bets');

        Schema::table('races', function (Blueprint $table) {
            if (Schema::hasColumn('races', 'valida_number')) {
                $table->dropColumn('valida_number');
            }
            if (Schema::hasColumn('races', 'is_valida')) {
                $table->dropColumn('is_valida');
            }
        });
    }
};
