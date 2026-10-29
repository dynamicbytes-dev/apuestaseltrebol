<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Historial de movimientos: cada cambio de estado de un ticket queda
 * registrado con su autor, para trazabilidad y analítica.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            // Desnormalizado a propósito: permite agregar por agencia sin
            // unir contra tickets en cada consulta de analítica.
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            // Autor del movimiento. Null si el usuario fue eliminado.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type');
            $table->string('from_status')->nullable();
            $table->string('to_status')->nullable();
            $table->decimal('amount', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['agency_id', 'created_at']);
            $table->index(['ticket_id', 'created_at']);
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_movements');
    }
};
