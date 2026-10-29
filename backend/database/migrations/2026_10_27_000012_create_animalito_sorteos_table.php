<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('animalito_sorteos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lottery_id')->constrained()->onDelete('cascade')->nullable();
            $table->foreignId('race_id')->nullable()->constrained()->onDelete('set null');
            $table->integer('number'); // número ganador (1-36) para animalitos o número de caballo para hipismo
            $table->string('animal')->nullable(); // nombre del animal (ej. "Ciempiés")
            $table->string('caballo_ganador')->nullable(); // nombre del caballo ganador (hipismo)
            $table->timestamp('sorteo_at'); // fecha y hora del sorteo
            $table->boolean('es_manual')->default(false); // true si fue ingresado manualmente por admin
            $table->timestamps();

            $table->index(['lottery_id', 'sorteo_at']);
            $table->index(['race_id', 'sorteo_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('animalito_sorteos');
    }
};
