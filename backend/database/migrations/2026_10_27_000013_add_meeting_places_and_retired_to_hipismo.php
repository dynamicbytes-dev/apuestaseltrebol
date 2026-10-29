<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('races', function (Blueprint $table) {
            $table->string('meeting')->nullable()->after('name');
            $table->foreignId('second_horse_id')->nullable()->constrained('horses')->nullOnDelete();
            $table->foreignId('third_horse_id')->nullable()->constrained('horses')->nullOnDelete();
        });

        Schema::table('horses', function (Blueprint $table) {
            $table->boolean('is_retired')->default(false)->after('dividend');
        });
    }

    public function down(): void
    {
        Schema::table('horses', function (Blueprint $table) {
            $table->dropColumn('is_retired');
        });

        Schema::table('races', function (Blueprint $table) {
            $table->dropConstrainedForeignId('second_horse_id');
            $table->dropConstrainedForeignId('third_horse_id');
            $table->dropColumn('meeting');
        });
    }
};
