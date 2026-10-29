<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_selections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lottery_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('lottery_animal_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('race_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('horse_id')->nullable()->constrained()->nullOnDelete();
            $table->string('sport')->nullable();
            $table->string('external_event_id')->nullable();
            $table->string('event_name')->nullable();
            $table->string('market')->nullable();
            $table->string('selection_label');
            $table->decimal('odd', 10, 2);
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_selections');
    }
};
