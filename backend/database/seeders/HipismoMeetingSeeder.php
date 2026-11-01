<?php

namespace Database\Seeders;

use App\Models\Race;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class HipismoMeetingSeeder extends Seeder
{
    public function run(): void
    {
        $meetingName = 'Reunión 45 - La Rinconada';
        $track = 'La Rinconada';
        $baseDate = Carbon::now()->addHours(2);

        $validasConfig = [
            [
                'name' => '5ta Carrera (1ª Válida 5 y 6)',
                'valida_number' => 1,
                'time_offset' => 0,
                'horses' => [
                    ['number' => 1, 'name' => 'Catire Pedro', 'jockey' => 'R. Capriles', 'dividend' => 3.20],
                    ['number' => 2, 'name' => 'Gran Omero', 'jockey' => 'J. C. Rodríguez', 'dividend' => 2.10],
                    ['number' => 3, 'name' => 'Templario', 'jockey' => 'F. Quevedo', 'dividend' => 4.50],
                    ['number' => 4, 'name' => 'Barrywhite', 'jockey' => 'J. Aray', 'dividend' => 6.00],
                    ['number' => 5, 'name' => 'Papa Pedro', 'jockey' => 'H. Medina', 'dividend' => 5.20],
                    ['number' => 6, 'name' => 'El Dorado', 'jockey' => 'J. Lugo', 'dividend' => 8.00],
                ],
            ],
            [
                'name' => '6ta Carrera (2ª Válida 5 y 6)',
                'valida_number' => 2,
                'time_offset' => 30,
                'horses' => [
                    ['number' => 1, 'name' => 'Sandovalera', 'jockey' => 'J. Lugo', 'dividend' => 1.90],
                    ['number' => 2, 'name' => 'Sharapova', 'jockey' => 'R. Capriles', 'dividend' => 3.80],
                    ['number' => 3, 'name' => 'Lyndacarter', 'jockey' => 'F. Quevedo', 'dividend' => 2.60],
                    ['number' => 4, 'name' => 'Strength Mask', 'jockey' => 'J. Aray', 'dividend' => 7.50],
                    ['number' => 5, 'name' => 'Danierold', 'jockey' => 'H. Medina', 'dividend' => 9.00],
                    ['number' => 6, 'name' => 'La Nena', 'jockey' => 'C. Gil', 'dividend' => 11.00],
                ],
            ],
            [
                'name' => '7ma Carrera (3ª Válida 5 y 6)',
                'valida_number' => 3,
                'time_offset' => 60,
                'horses' => [
                    ['number' => 1, 'name' => 'The Brother Slew', 'jockey' => 'F. Quevedo', 'dividend' => 4.20],
                    ['number' => 2, 'name' => 'Amelazado', 'jockey' => 'R. Capriles', 'dividend' => 2.80],
                    ['number' => 3, 'name' => 'Lusitano', 'jockey' => 'J. C. Rodríguez', 'dividend' => 5.00],
                    ['number' => 4, 'name' => 'Master Yipi', 'jockey' => 'H. Medina', 'dividend' => 3.50],
                    ['number' => 5, 'name' => 'Rod Hendrick', 'jockey' => 'J. Lugo', 'dividend' => 6.20],
                    ['number' => 6, 'name' => 'Impresionante', 'jockey' => 'K. Aray', 'dividend' => 10.00],
                ],
            ],
            [
                'name' => '8va Carrera (4ª Válida 5 y 6)',
                'valida_number' => 4,
                'time_offset' => 90,
                'horses' => [
                    ['number' => 1, 'name' => 'Philomena', 'jockey' => 'R. Capriles', 'dividend' => 2.40],
                    ['number' => 2, 'name' => 'Paomi Police', 'jockey' => 'J. Lugo', 'dividend' => 4.00],
                    ['number' => 3, 'name' => 'Brave Yole', 'jockey' => 'F. Quevedo', 'dividend' => 5.50],
                    ['number' => 4, 'name' => 'Lady Soal', 'jockey' => 'H. Medina', 'dividend' => 3.90],
                    ['number' => 5, 'name' => 'La Sensacional', 'jockey' => 'J. Aray', 'dividend' => 7.00],
                    ['number' => 6, 'name' => 'Reina Her', 'jockey' => 'C. Gil', 'dividend' => 8.50],
                ],
            ],
            [
                'name' => '9na Carrera (5ª Válida 5 y 6)',
                'valida_number' => 5,
                'time_offset' => 120,
                'horses' => [
                    ['number' => 1, 'name' => 'El De Froix', 'jockey' => 'C. Gil', 'dividend' => 2.20],
                    ['number' => 2, 'name' => 'Futuro', 'jockey' => 'J. C. Rodríguez', 'dividend' => 3.10],
                    ['number' => 3, 'name' => 'Bravucon', 'jockey' => 'F. Quevedo', 'dividend' => 6.00],
                    ['number' => 4, 'name' => 'Morralete', 'jockey' => 'R. Capriles', 'dividend' => 5.40],
                    ['number' => 5, 'name' => 'King Fenix', 'jockey' => 'H. Medina', 'dividend' => 8.20],
                    ['number' => 6, 'name' => 'Suanfonson', 'jockey' => 'J. Aray', 'dividend' => 12.00],
                ],
            ],
            [
                'name' => '10ma Carrera (6ª Válida 5 y 6)',
                'valida_number' => 6,
                'time_offset' => 150,
                'horses' => [
                    ['number' => 1, 'name' => 'De Rous', 'jockey' => 'H. Medina', 'dividend' => 3.50],
                    ['number' => 2, 'name' => 'Papá Gino', 'jockey' => 'R. Capriles', 'dividend' => 4.80],
                    ['number' => 3, 'name' => 'My Father Antonio', 'jockey' => 'J. Lugo', 'dividend' => 5.00],
                    ['number' => 4, 'name' => 'King Ponchi', 'jockey' => 'F. Quevedo', 'dividend' => 2.90],
                    ['number' => 5, 'name' => 'Gran Pepe', 'jockey' => 'J. C. Rodríguez', 'dividend' => 6.50],
                    ['number' => 6, 'name' => 'El Gran Bricelio', 'jockey' => 'C. Gil', 'dividend' => 4.00],
                ],
            ],
        ];

        foreach ($validasConfig as $cfg) {
            $raceDate = (clone $baseDate)->addMinutes($cfg['time_offset'])->format('Y-m-d H:i:s');

            $race = Race::updateOrCreate(
                [
                    'meeting' => $meetingName,
                    'name' => $cfg['name'],
                ],
                [
                    'track' => $track,
                    'race_date' => $raceDate,
                    'status' => Race::STATUS_PENDING,
                    'is_valida' => true,
                    'valida_number' => $cfg['valida_number'],
                ]
            );

            foreach ($cfg['horses'] as $h) {
                $race->horses()->updateOrCreate(
                    ['number' => $h['number']],
                    [
                        'name' => $h['name'],
                        'jockey' => $h['jockey'],
                        'dividend' => $h['dividend'],
                        'is_retired' => false,
                    ]
                );
            }
        }
    }
}
