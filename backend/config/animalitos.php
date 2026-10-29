<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Listado base de animalitos (00 al 36)
    |--------------------------------------------------------------------------
    |
    | Plantilla usada cuando se registra una lotería sin enviar su propio
    | listado. El número es SIEMPRE texto ("00" y "0" son valores distintos).
    | Cada lotería puede personalizar nombres y habilitar/inhabilitar números.
    |
    */

    'animals' => [
        ['number' => '00', 'animal' => 'Delfín'],
        ['number' => '1', 'animal' => 'Carnero'],
        ['number' => '2', 'animal' => 'Toro'],
        ['number' => '3', 'animal' => 'Ciempiés'],
        ['number' => '4', 'animal' => 'Alacrán'],
        ['number' => '5', 'animal' => 'León'],
        ['number' => '6', 'animal' => 'Rana'],
        ['number' => '7', 'animal' => 'Perico'],
        ['number' => '8', 'animal' => 'Ratón'],
        ['number' => '9', 'animal' => 'Águila'],
        ['number' => '10', 'animal' => 'Tigre'],
        ['number' => '11', 'animal' => 'Gato'],
        ['number' => '12', 'animal' => 'Caballo'],
        ['number' => '13', 'animal' => 'Mono'],
        ['number' => '14', 'animal' => 'Paloma'],
        ['number' => '15', 'animal' => 'Zorro'],
        ['number' => '16', 'animal' => 'Oso'],
        ['number' => '17', 'animal' => 'Pavo'],
        ['number' => '18', 'animal' => 'Burro'],
        ['number' => '19', 'animal' => 'Chivo'],
        ['number' => '20', 'animal' => 'Cochino'],
        ['number' => '21', 'animal' => 'Gallo'],
        ['number' => '22', 'animal' => 'Camello'],
        ['number' => '23', 'animal' => 'Cebra'],
        ['number' => '24', 'animal' => 'Iguana'],
        ['number' => '25', 'animal' => 'Gallina'],
        ['number' => '26', 'animal' => 'Vaca'],
        ['number' => '27', 'animal' => 'Perro'],
        ['number' => '28', 'animal' => 'Zamuro'],
        ['number' => '29', 'animal' => 'Elefante'],
        ['number' => '30', 'animal' => 'Caimán'],
        ['number' => '31', 'animal' => 'Lapa'],
        ['number' => '32', 'animal' => 'Ardilla'],
        ['number' => '33', 'animal' => 'Pescado'],
        ['number' => '34', 'animal' => 'Venado'],
        ['number' => '35', 'animal' => 'Jirafa'],
        ['number' => '36', 'animal' => 'Culebra'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Horarios de sorteo por defecto
    |--------------------------------------------------------------------------
    |
    | Horario de juego de las loterías, de 8:00 a 19:00 en punto. Es el
    | que se asigna a una lotería nueva, y el que el administrador puede
    | ajustar después desde el detalle de la lotería.
    |
    | Nota: "12:00" es el mediodía.
    |
    */

    'draw_times' => [
        '08:00',
        '09:00',
        '10:00',
        '11:00',
        '12:00',
        '13:00',
        '14:00',
        '15:00',
        '16:00',
        '17:00',
        '18:00',
        '19:00',
    ],

];
