<?php

namespace App\Services;

use App\Exceptions\SportsApiException;
use Carbon\Carbon;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SportsApiService
{
    public function sports(): array
    {
        return collect(config('sports.sports'))
            ->map(fn (array $sport, string $key) => [
                'key' => $key,
                'label' => $sport['label'],
                'has_odds' => ! empty($sport['odds_path']),
            ])
            ->values()
            ->all();
    }

    public function status(): array
    {
        $payload = Cache::remember('sports-api:status', now()->addMinutes(5), function () {
            return $this->request(config('sports.status_host'), '/status');
        });

        $errors = $this->extractErrors($payload);

        if ($errors !== null) {
            throw new SportsApiException($errors);
        }

        $response = $payload['response'] ?? [];

        return [
            'plan' => data_get($response, 'subscription.plan'),
            'active' => (bool) data_get($response, 'subscription.active', false),
            'requests_current' => data_get($response, 'requests.current'),
            'requests_limit' => data_get($response, 'requests.limit_day'),
        ];
    }

    public function events(string $sport, string $date): array
    {
        $config = $this->sportConfig($sport);

        $timezone = config('sports.timezone', 'America/Caracas');

        // La API v2 de NBA no admite el parámetro timezone: se consultan la fecha
        // y el día UTC siguiente, y luego se filtra por la fecha local de Caracas.
        $isNba = $sport === 'nba';
        $dates = $isNba
            ? [$date, Carbon::parse($date, 'UTC')->addDay()->toDateString()]
            : [$date];

        $responses = [];

        foreach ($dates as $queryDate) {
            $query = ['date' => $queryDate];

            if (! $isNba) {
                $query['timezone'] = $timezone;
            }

            $payload = Cache::remember(
                "sports-api:{$sport}:events:{$timezone}:{$queryDate}",
                now()->addMinutes((int) config('sports.events_cache_minutes', 10)),
                fn () => $this->request($config['host'], $config['events_path'], $query)
            );

            $errors = $this->extractErrors($payload);

            if ($errors !== null) {
                throw new SportsApiException($errors);
            }

            $responses = array_merge($responses, $payload['response'] ?? []);
        }

        $events = collect($responses)
            ->map(fn (array $event) => $this->normalizeEvent($sport, $event));

        if ($isNba) {
            $events = $events
                ->filter(fn (array $event) => $event['starts_at']
                    && Carbon::parse($event['starts_at'])->setTimezone($timezone)->toDateString() === $date)
                ->unique('id');
        }

        return $events
            ->sortBy('starts_at')
            ->values()
            ->all();
    }

    public function odds(string $sport, string $eventId): array
    {
        $config = $this->sportConfig($sport);

        if (empty($config['odds_path']) || empty($config['odds_query'])) {
            return $this->unavailableOdds('La API no ofrece cuotas para este deporte.');
        }

        $payload = Cache::remember(
            "sports-api:{$sport}:odds:{$eventId}",
            now()->addMinutes((int) config('sports.odds_cache_minutes', 15)),
            fn () => $this->request(
                $config['host'],
                $config['odds_path'],
                [$config['odds_query'] => $eventId]
            )
        );

        $errors = $this->extractErrors($payload);

        if ($errors !== null) {
            throw new SportsApiException($errors);
        }

        $response = $payload['response'] ?? [];

        if (empty($response)) {
            return $this->unavailableOdds('Sin cuotas disponibles para este evento.');
        }

        $item = $response[0];
        $bookmakers = collect($item['bookmakers'] ?? []);

        if ($bookmakers->isEmpty()) {
            return $this->unavailableOdds('Las casas de apuestas aún no publican cuotas para este evento.');
        }

        $bookmaker = $bookmakers
            ->sortByDesc(fn (array $bookmaker) => count($bookmaker['bets'] ?? []))
            ->first();

        $markets = collect($bookmaker['bets'] ?? [])
            ->map(function (array $bet) {
                return [
                    'id' => $bet['id'] ?? null,
                    'name' => $bet['name'] ?? 'Mercado',
                    'selections' => collect($bet['values'] ?? [])
                        ->map(fn (array $value) => [
                            'label' => $value['value'] ?? '',
                            'odd' => $value['odd'] ?? null,
                        ])
                        ->filter(fn (array $value) => $value['label'] !== '' && $value['odd'] !== null)
                        ->values()
                        ->all(),
                ];
            })
            ->filter(fn (array $market) => ! empty($market['selections']))
            ->values()
            ->all();

        return [
            'available' => true,
            'message' => null,
            'bookmaker' => [
                'id' => $bookmaker['id'] ?? null,
                'name' => $bookmaker['name'] ?? 'Casa de apuestas',
            ],
            'updated_at' => $item['update'] ?? null,
            'markets' => $markets,
        ];
    }

    /**
     * Resultado oficial de un evento, usado para liquidar las jugadas.
     *
     * Devuelve un arreglo normalizado con el mismo shape para todos los
     * deportes: si el proveedor ya no tiene el evento (partidos antiguos),
     * `found` viene en false y el ticket debe pasar a revisión manual.
     */
    public function eventResult(string $sport, string $eventId): array
    {
        $config = $this->sportConfig($sport);

        $payload = Cache::remember(
            "sports-api:{$sport}:result:{$eventId}",
            now()->addMinutes((int) config('sports.result_cache_minutes', 60)),
            fn () => $this->request(
                $config['host'],
                $config['events_path'],
                [$config['result_query'] ?? 'id' => $eventId]
            )
        );

        $errors = $this->extractErrors($payload);

        if ($errors !== null) {
            throw new SportsApiException($errors);
        }

        $event = ($payload['response'] ?? [])[0] ?? null;

        if (! is_array($event)) {
            return $this->unknownResult();
        }

        return $this->normalizeResult($sport, $event);
    }

    private function sportConfig(string $sport): array
    {
        $sportConfig = config("sports.sports.{$sport}");

        if (! is_array($sportConfig)) {
            throw new SportsApiException('Deporte no válido.');
        }

        return $sportConfig;
    }

    private function request(string $host, string $path, array $query = []): array
    {
        $apiKey = config('sports.api_key');

        if (empty($apiKey)) {
            throw new SportsApiException('Falta configurar la clave de la API deportiva.');
        }

        try {
            $response = Http::withHeaders(['x-apisports-key' => $apiKey])
                ->acceptJson()
                ->timeout((int) config('sports.timeout', 20))
                ->get($host.$path, $query);
        } catch (ConnectionException $exception) {
            throw new SportsApiException(
                'No se pudo conectar con la API deportiva. Intenta nuevamente.',
                0,
                $exception
            );
        }

        if ($response->failed()) {
            throw new SportsApiException(
                'La API deportiva respondió con error HTTP '.$response->status().'.'
            );
        }

        $payload = $response->json();

        if (! is_array($payload)) {
            throw new SportsApiException('La API deportiva devolvió una respuesta inválida.');
        }

        return $payload;
    }

    private function extractErrors(array $payload): ?string
    {
        $errors = $payload['errors'] ?? [];

        if (is_object($errors)) {
            $errors = (array) $errors;
        }

        if (! is_array($errors) || $errors === []) {
            return null;
        }

        return collect($errors)
            ->map(function ($value, $key) {
                $message = is_array($value) ? implode(', ', $value) : (string) $value;

                return is_string($key) ? "{$key}: {$message}" : $message;
            })
            ->filter()
            ->implode(' ');
    }

    private function normalizeEvent(string $sport, array $event): array
    {
        return match ($sport) {
            'football' => $this->normalizeFootballEvent($event),
            'nba' => $this->normalizeNbaEvent($event),
            default => $this->normalizeGameEvent($event),
        };
    }

    private function normalizeFootballEvent(array $event): array
    {
        return [
            'id' => data_get($event, 'fixture.id'),
            'league' => [
                'id' => data_get($event, 'league.id'),
                'name' => data_get($event, 'league.name'),
                'country' => data_get($event, 'league.country'),
                'logo' => data_get($event, 'league.logo'),
            ],
            'home' => [
                'id' => data_get($event, 'teams.home.id'),
                'name' => data_get($event, 'teams.home.name'),
                'logo' => data_get($event, 'teams.home.logo'),
            ],
            'away' => [
                'id' => data_get($event, 'teams.away.id'),
                'name' => data_get($event, 'teams.away.name'),
                'logo' => data_get($event, 'teams.away.logo'),
            ],
            'starts_at' => data_get($event, 'fixture.date'),
            'status' => [
                'short' => data_get($event, 'fixture.status.short'),
                'long' => data_get($event, 'fixture.status.long'),
            ],
            'score' => [
                'home' => data_get($event, 'goals.home'),
                'away' => data_get($event, 'goals.away'),
            ],
            'venue' => data_get($event, 'fixture.venue.name'),
        ];
    }

    private function normalizeGameEvent(array $event): array
    {
        return [
            'id' => data_get($event, 'id'),
            'league' => [
                'id' => data_get($event, 'league.id'),
                'name' => data_get($event, 'league.name'),
                'country' => data_get($event, 'country.name'),
                'logo' => data_get($event, 'league.logo'),
            ],
            'home' => [
                'id' => data_get($event, 'teams.home.id'),
                'name' => data_get($event, 'teams.home.name'),
                'logo' => data_get($event, 'teams.home.logo'),
            ],
            'away' => [
                'id' => data_get($event, 'teams.away.id'),
                'name' => data_get($event, 'teams.away.name'),
                'logo' => data_get($event, 'teams.away.logo'),
            ],
            'starts_at' => data_get($event, 'date'),
            'status' => [
                'short' => data_get($event, 'status.short'),
                'long' => data_get($event, 'status.long'),
            ],
            'score' => [
                'home' => $this->scoreValue(data_get($event, 'scores.home')),
                'away' => $this->scoreValue(data_get($event, 'scores.away')),
            ],
            'venue' => data_get($event, 'venue'),
        ];
    }

    private function normalizeNbaEvent(array $event): array
    {
        return [
            'id' => data_get($event, 'id'),
            'league' => [
                'id' => null,
                'name' => 'NBA',
                'country' => 'USA',
                'logo' => null,
            ],
            'home' => [
                'id' => data_get($event, 'teams.home.id'),
                'name' => data_get($event, 'teams.home.name'),
                'logo' => data_get($event, 'teams.home.logo'),
            ],
            'away' => [
                'id' => data_get($event, 'teams.visitors.id'),
                'name' => data_get($event, 'teams.visitors.name'),
                'logo' => data_get($event, 'teams.visitors.logo'),
            ],
            'starts_at' => data_get($event, 'date.start'),
            'status' => [
                'short' => (string) data_get($event, 'status.short'),
                'long' => data_get($event, 'status.long'),
            ],
            'score' => [
                'home' => data_get($event, 'scores.home.points'),
                'away' => data_get($event, 'scores.visitors.points'),
            ],
            'venue' => data_get($event, 'arena.name'),
        ];
    }

    private function scoreValue(mixed $score): mixed
    {
        if (is_array($score)) {
            return $score['total'] ?? null;
        }

        return $score;
    }

    private function unavailableOdds(string $message): array
    {
        return [
            'available' => false,
            'message' => $message,
            'bookmaker' => null,
            'updated_at' => null,
            'markets' => [],
        ];
    }

    /**
     * Resultado de un evento que el proveedor ya no devuelve.
     */
    private function unknownResult(): array
    {
        return [
            'found' => false,
            'finished' => false,
            'status_short' => null,
            'status_long' => null,
            'home_name' => null,
            'away_name' => null,
            'home_score' => null,
            'away_score' => null,
            'starts_at' => null,
        ];
    }

    /**
     * Normaliza el resultado de un evento al mismo shape para todos los
     * deportes, para que el motor de liquidación no tenga que conocer la
     * estructura de cada API.
     */
    private function normalizeResult(string $sport, array $event): array
    {
        return match ($sport) {
            'football' => $this->normalizeFootballResult($event),
            'nba' => $this->normalizeNbaResult($event),
            default => $this->normalizeGameResult($event),
        };
    }

    private function normalizeFootballResult(array $event): array
    {
        $statusShort = (string) data_get($event, 'fixture.status.short', '');
        $statusLong = (string) data_get($event, 'fixture.status.long', '');

        return [
            'found' => true,
            'finished' => $this->isFinished($statusShort, $statusLong),
            'status_short' => $statusShort,
            'status_long' => $statusLong,
            'home_name' => data_get($event, 'teams.home.name'),
            'away_name' => data_get($event, 'teams.away.name'),
            'home_score' => data_get($event, 'goals.home'),
            'away_score' => data_get($event, 'goals.away'),
            'starts_at' => data_get($event, 'fixture.date'),
        ];
    }

    private function normalizeGameResult(array $event): array
    {
        $statusShort = (string) data_get($event, 'status.short', '');
        $statusLong = (string) data_get($event, 'status.long', '');

        return [
            'found' => true,
            'finished' => $this->isFinished($statusShort, $statusLong),
            'status_short' => $statusShort,
            'status_long' => $statusLong,
            'home_name' => data_get($event, 'teams.home.name'),
            'away_name' => data_get($event, 'teams.away.name'),
            'home_score' => $this->scoreValue(data_get($event, 'teams.home.score')),
            'away_score' => $this->scoreValue(data_get($event, 'teams.away.score')),
            'starts_at' => data_get($event, 'date'),
        ];
    }

    private function normalizeNbaResult(array $event): array
    {
        $statusShort = (string) data_get($event, 'status.short', '');
        $statusLong = (string) data_get($event, 'status.long', '');

        return [
            'found' => true,
            'finished' => $this->isFinished($statusShort, $statusLong),
            'status_short' => $statusShort,
            'status_long' => $statusLong,
            'home_name' => data_get($event, 'teams.home.name'),
            'away_name' => data_get($event, 'teams.visitors.name'),
            'home_score' => data_get($event, 'scores.home.points'),
            'away_score' => data_get($event, 'scores.visitors.points'),
            'starts_at' => data_get($event, 'date.start'),
        ];
    }

    /**
     * Determina si el evento ya tiene un resultado definitivo.
     *
     * Los estados de una postponed, cancelada o suspendida NO cuentan
     * como finalizados: esos casos se envían a revisión manual.
     */
    private function isFinished(string $short, string $long): bool
    {
        $short = strtoupper(trim($short));
        $lower = mb_strtolower(trim($long));

        $finished = ['FT', 'AET', 'PEN', 'AOT', 'AP', 'AWD', 'WO', 'FIN', 'FINAL', 'F', '3', 'OFF', 'ENDED'];

        if (in_array($short, $finished, true)) {
            return true;
        }

        return str_contains($lower, 'finished')
            || str_contains($lower, 'final')
            || str_contains($lower, 'ended')
            || str_contains($lower, 'completed');
    }
}
