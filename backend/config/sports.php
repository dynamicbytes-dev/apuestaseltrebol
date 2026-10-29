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

    'result_cache_minutes' => 60,

    /*
    |--------------------------------------------------------------------------
    | Mercados liquidables automáticamente
    |--------------------------------------------------------------------------
    |
    | Los mercados se identifican por su nombre normalizado (sin acentos, sin
    | espacios ni signos). Solo se liquidan automáticamente los mercados
    | reconocidos: cualquier otro mercado deja el ticket en estado "review"
    | para que lo revise el supervisor. Es preferible escalar a revisión
    | antes que pagar un ticket perdedor.
    |
    */

    'settlement' => [
        'winner_markets' => [
            'matchwinner',
            'moneyline',
            '1x2',
            'matchresult',
            'homeaway',
            'ganador',
            'resultado',
        ],
        'both_teams_score_markets' => [
            'bothteamscore',
            'bothteamtoscore',
            'ambosmarcan',
        ],
    ],

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
