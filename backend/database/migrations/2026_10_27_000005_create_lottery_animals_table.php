<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lottery_animals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lottery_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('number');
            $table->string('animal');
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();

            $table->unique(['lottery_id', 'number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lottery_animals');
    }
};
