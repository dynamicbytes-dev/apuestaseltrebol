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
            '3wayresult',
            'threewayresult',
        ],
        'both_teams_score_markets' => [
            'bothteamscore',
            'bothteamtoscore',
            'ambosmarcan',
        ],
    ],

    'status_host' => 'https://v3.football.api-sports.io',

    /*
    |--------------------------------------------------------------------------
    | Mercados tradicionales
    |--------------------------------------------------------------------------
    |
    | El proveedor devuelve decenas de mercados por partido (casi 50 en
    | fútbol). Para el jugador solo tienen sentido los tradicionales: el
    | resto (primer tiempo, Odd/Even, Team To Score, handicaps por
    | quartos...) se esconden.
    |
    | Los identificadores son los del proveedor (API-SPORTS) y varian por
    | deporte: el "Match Winner" es el 1 en fútbol, el 14 en béisbol y el
    | 1 en baloncesto e hockey.
    |
    */

    'traditional_markets' => [
        // 1 Match Winner · 2 Home/Away · 4 Asian Handicap
        // 5 Goals Over/Under · 8 Both Teams Score · 12 Double Chance
        'football' => [1, 2, 4, 5, 8, 12],

        // 1 Home/Away · 2 Asian Handicap · 5 Over/Under · 14 Match Winner
        'baseball' => [1, 2, 5, 14],

        // 1 3Way Result · 2 Home/Away · 3 Asian Handicap
        // 4 Over/Under · 7 Double Chance
        'basketball' => [1, 2, 3, 4, 7],

        // 1 3Way Result · 2 Home/Away · 5 Both Teams To Score
        // 9 Double Chance · 10 Total - Home · 11 Total - Away
        'hockey' => [1, 2, 5, 9, 10, 11],

        // La NBA no ofrece cuotas.
        'nba' => [],
    ],

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
