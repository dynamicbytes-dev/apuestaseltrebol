<?php

return [

    /*
    |--------------------------------------------------------------------------
    | API deportiva (API-SPORTS)
    |--------------------------------------------------------------------------
    |
    | Cada deporte usa un host distinto pero la misma clave y el mismo
    | formato de respuesta. Las cuotas se consultan por evento y se
    | almacenan en caché para no agotar el límite diario del plan.
    |
    */

    'api_key' => env('SPORTS_API_KEY'),

    'timeout' => (int) env('SPORTS_API_TIMEOUT', 20),

    'timezone' => 'America/Caracas',

    'events_cache_minutes' => 10,

    'odds_cache_minutes' => 15,

    'status_host' => 'https://v3.football.api-sports.io',

    'sports' => [
        'football' => [
            'label' => 'Fútbol',
            'host' => 'https://v3.football.api-sports.io',
            'events_path' => '/fixtures',
            'odds_path' => '/odds',
            'odds_query' => 'fixture',
        ],
        'baseball' => [
            'label' => 'Béisbol',
            'host' => 'https://v1.baseball.api-sports.io',
            'events_path' => '/games',
            'odds_path' => '/odds',
            'odds_query' => 'game',
        ],
        'basketball' => [
            'label' => 'Baloncesto',
            'host' => 'https://v1.basketball.api-sports.io',
            'events_path' => '/games',
            'odds_path' => '/odds',
            'odds_query' => 'game',
        ],
        'hockey' => [
            'label' => 'Hockey',
            'host' => 'https://v1.hockey.api-sports.io',
            'events_path' => '/games',
            'odds_path' => '/odds',
            'odds_query' => 'game',
        ],
        'nba' => [
            'label' => 'NBA',
            'host' => 'https://v2.nba.api-sports.io',
            'events_path' => '/games',
            'odds_path' => null,
            'odds_query' => null,
        ],
    ],

];
