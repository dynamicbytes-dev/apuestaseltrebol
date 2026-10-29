<?php

namespace App\Console;

use Illuminate\Foundation\Console\Kernel as Kernel;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\support\Facades\Log;

class Kernel extends Kernel
{
    protected $commands = [
        \App\Console\Commands\FetchAnimalitosCommand::class,
    ];

    protected function schedule(Schedule $schedule)
    {
        // Ejecutar el comando de animalitos cada 10 minutos entre 9:00 AM y 7:00 PM
        $schedule->command('fetch:animalitos')
            ->everyTenMinutes()
            ->between('09:00', '19:00');

        // Heredamos el schedule padre para otras funcionalidades
        $this->parent->schedule($schedule);
    }
}
