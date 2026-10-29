<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Tareas programadas
|--------------------------------------------------------------------------
|
| En Laravel 11 y 12 el planificador se define aquí: el app/Console/Kernel.php
| del esqueleto anterior ya no se carga y su schedule() quedaba sin efecto.
|
| La ventana horaria va en la propia expresión cron (9-19) y no con
| ->between(): este último captura la hora en la que se define el planificador,
| no la hora en la que se evalúa la tarea. La expresión cron se resuelve
| siempre contra la hora actual.
|
*/

Schedule::command('fetch:animalitos')
    ->cron('*/10 9-19 * * *')
    ->withoutOverlapping();

/*
|--------------------------------------------------------------------------
| Liquidacion de tickets
|--------------------------------------------------------------------------
|
| Liquida los tickets de parley pendientes contra el resultado oficial, para
| que el estado de las jugadas se actualice solo. El proveedor limita las
| peticiones por minuto, asi que la corrida es pausada.
|
*/

Schedule::command('tickets:settle')
    ->everyTenMinutes()
    ->withoutOverlapping();
