<?php

namespace App\Http\Controllers;

use App\Models\AnimalitoSorteo;
use App\Models\Horse;
use App\Models\Lottery;
use App\Models\Race;
use App\Services\SportsApiService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/**
 * Cartelera de juegos: el calendario unificado de todo lo que se puede
 * apostar, con sus resultados. Available para los tres roles.
 */
class GameBoardController extends Controller
{
    /** Días máximos que se pueden consultar de una vez. */
    private const MAX_DAYS = 4;

    public function __construct(private readonly SportsApiService $sports) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'type' => ['nullable', Rule::in(['parley', 'hipismo', 'animalitos'])],
            'sport' => ['nullable', 'string', 'max:30'],
            'league' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'string', 'max:30'],
            'lottery_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:100'],
        ], [
            'from.date_format' => 'La fecha inicial debe tener el formato AAAA-MM-DD.',
            'to.date_format' => 'La fecha final debe tener el formato AAAA-MM-DD.',
            'to.after_or_equal' => 'La fecha final no puede ser anterior a la inicial.',
            'type.in' => 'El tipo de juego no es válido.',
        ]);

        [$from, $to] = $this->resolvePeriod($data['from'] ?? null, $data['to'] ?? null);
        $type = $data['type'] ?? null;

        $result = [
            'period' => ['from' => $from, 'to' => $to],
            'parley' => [],
            'hipismo' => [],
            'animalitos' => [],
            'warnings' => [],
        ];

        if ($type === null || $type === 'parley') {
            $parley = $this->parleyBoard($from, $to, $data);
            $result['parley'] = $parley['events'];
            $result['warnings'] = array_merge($result['warnings'], $parley['warnings']);
        }

        if ($type === null || $type === 'hipismo') {
            $result['hipismo'] = $this->hipismoBoard($from, $to, $data);
        }

        if ($type === null || $type === 'animalitos') {
            $result['animalitos'] = $this->animalitosBoard($from, $to, $data);
        }

        $result['counts'] = [
            'parley' => count($result['parley']),
            'hipismo' => count($result['hipismo']),
            'animalitos' => count($result['animalitos']),
        ];

        return response()->json(['data' => $result]);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function resolvePeriod(?string $from, ?string $to): array
    {
        $to = $to ? Carbon::parse($to)->toDateString() : Carbon::now()->toDateString();
        $from = $from
            ? Carbon::parse($from)->toDateString()
            : Carbon::parse($to)->toDateString();

        if ($from > $to) {
            [$from, $to] = [$to, $from];
        }

        // El proveedor tiene un límite de peticiones por minuto: no se
        // consultan más días de los razonables.
        if (Carbon::parse($from)->diffInDays(Carbon::parse($to)) > self::MAX_DAYS) {
            $from = Carbon::parse($to)->subDays(self::MAX_DAYS)->toDateString();
        }

        return [$from, $to];
    }

    /**
     * Eventos deportivos del proveedor.
     *
     * @return array{events: array<int, array<string, mixed>>, warnings: array<int, string>}
     */
    private function parleyBoard(string $from, string $to, array $filters): array
    {
        $sports = ! empty($filters['sport'])
            ? [$filters['sport']]
            : array_keys(config('sports.sports'));

        $events = [];
        $warnings = [];

        foreach ($sports as $sport) {
            if (! array_key_exists($sport, config('sports.sports'))) {
                continue;
            }

            $period = Carbon::parse($from);
            $limit = Carbon::parse($to);

            while ($period->lessThanOrEqualTo($limit)) {
                try {
                    $delDia = $this->sports->events($sport, $period->toDateString());

                    // El deporte no viene en la respuesta del proveedor:
                    // se etiqueta aqui para poder filtrar por el.
                    foreach ($delDia as $clave => $evento) {
                        $delDia[$clave]['sport'] = $sport;
                    }

                    $events = array_merge($events, $delDia);
                } catch (\Throwable $exception) {
                    // El proveedor limita las peticiones por minuto. Se avisa
                    // en lugar de fallar toda la cartelera.
                    Log::warning('Cartelera: no se pudo obtener los eventos', [
                        'sport' => $sport,
                        'date' => $period->toDateString(),
                        'error' => $exception->getMessage(),
                    ]);

                    $warnings[] = $sport.': '.$exception->getMessage();
                }

                $period->addDay();
            }
        }

        return [
            'events' => collect($events)
                ->filter(function (array $event) use ($filters) {
                    if (! empty($filters['league']) && ($event['league']['name'] ?? '') !== $filters['league']) {
                        return false;
                    }

                    if (! empty($filters['status'])) {
                        $short = strtoupper((string) ($event['status']['short'] ?? ''));

                        if ($short !== strtoupper($filters['status'])) {
                            return false;
                        }
                    }

                    if (! empty($filters['search'])) {
                        $query = mb_strtolower($filters['search']);

                        $haystack = mb_strtolower(implode(' ', [
                            $event['home']['name'] ?? '',
                            $event['away']['name'] ?? '',
                            $event['league']['name'] ?? '',
                            $event['league']['country'] ?? '',
                        ]));

                        if (! str_contains($haystack, $query)) {
                            return false;
                        }
                    }

                    return true;
                })
                ->map(fn (array $event) => [
                    'id' => $event['id'],
                    'sport' => $event['sport'] ?? null,
                    'starts_at' => $event['starts_at'],
                    'original_starts_at' => $event['original_starts_at'] ?? null,
                    'schedule_corrected' => (bool) ($event['schedule_corrected'] ?? false),
                    'league' => $event['league']['name'] ?? null,
                    'country' => $event['league']['country'] ?? null,
                    'home' => $event['home']['name'] ?? null,
                    'away' => $event['away']['name'] ?? null,
                    'status' => $event['status']['short'] ?? null,
                    'status_text' => $event['status']['long'] ?? null,
                    'score_home' => $event['score']['home'] ?? null,
                    'score_away' => $event['score']['away'] ?? null,
                    'venue' => $event['venue'] ?? null,
                ])
                ->values()
                ->all(),
            'warnings' => $warnings,
        ];
    }

    /**
     * Carreras de hipismo con su podio.
     */
    private function hipismoBoard(string $from, string $to, array $filters): array
    {
        return Race::with(['horses' => fn ($query) => $query->orderBy('number'), 'winner', 'second', 'third'])
            ->whereDate('race_date', '>=', $from)
            ->whereDate('race_date', '<=', $to)
            ->when(! empty($filters['status']), fn ($query) => $query->where('status', $filters['status']))
            ->when(! empty($filters['search']), function ($query) use ($filters) {
                // LOWER + LIKE funciona igual en PostgreSQL y en SQLite,
                // a diferencia de ilike.
                $term = '%'.mb_strtolower($filters['search']).'%';

                $query->where(function ($query) use ($term) {
                    $query->whereRaw('LOWER(name) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(meeting) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(track) LIKE ?', [$term]);
                });
            })
            ->orderBy('race_date')
            ->get()
            ->map(fn (Race $race) => [
                'id' => $race->id,
                'name' => $race->name,
                'meeting' => $race->meeting,
                'track' => $race->track,
                'race_date' => $race->race_date?->format('Y-m-d H:i:s'),
                'status' => $race->status,
                'winner' => $race->winner ? 'N° '.$race->winner->number.' - '.$race->winner->name : null,
                'second' => $race->second ? 'N° '.$race->second->number.' - '.$race->second->name : null,
                'third' => $race->third ? 'N° '.$race->third->number.' - '.$race->third->name : null,
                'horses' => $race->horses->map(fn (Horse $horse) => [
                    'number' => $horse->number,
                    'name' => $horse->name,
                    'dividend' => (float) $horse->dividend,
                    'is_retired' => (bool) $horse->is_retired,
                ])->values(),
            ])
            ->all();
    }

    /**
     * Sorteos de animalitos con su resultado.
     */
    private function animalitosBoard(string $from, string $to, array $filters): array
    {
        return AnimalitoSorteo::with('lottery')
            ->whereDate('sorteo_at', '>=', $from)
            ->whereDate('sorteo_at', '<=', $to)
            ->when(! empty($filters['lottery_id']), fn ($query) => $query->where('lottery_id', $filters['lottery_id']))
            ->when(! empty($filters['search']), function ($query) use ($filters) {
                $term = '%'.mb_strtolower($filters['search']).'%';

                $query->where(function ($query) use ($term) {
                    $query->whereRaw('LOWER(animal) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(number) LIKE ?', [$term]);
                });
            })
            ->orderBy('sorteo_at')
            ->limit(300)
            ->get()
            ->map(fn (AnimalitoSorteo $sorteo) => [
                'id' => $sorteo->id,
                'lottery_id' => $sorteo->lottery_id,
                'lottery' => $sorteo->lottery?->name,
                'number' => $sorteo->number,
                'animal' => $sorteo->animal,
                'sorteo_at' => $sorteo->sorteo_at?->format('Y-m-d H:i:s'),
                'is_resolved' => (bool) $sorteo->is_resolved,
                'is_manual' => (bool) $sorteo->es_manual,
            ])
            ->all();
    }

    /**
     * Listado de ligas disponibles, para el filtro de la cartelera.
     */
    public function leagues(Request $request): JsonResponse
    {
        $sport = $request->query('sport');
        $date = $request->query('date') ?: Carbon::now()->toDateString();

        if (! $sport || ! array_key_exists($sport, config('sports.sports'))) {
            return response()->json(['data' => []]);
        }

        try {
            $events = $this->sports->events($sport, $date);
        } catch (\Throwable) {
            return response()->json(['data' => []]);
        }

        $leagues = collect($events)
            ->pluck('league.name')
            ->filter()
            ->unique()
            ->sort()
            ->values();

        return response()->json(['data' => $leagues]);
    }

    /**
     * Loterías con su horario, para el filtro de la cartelera.
     */
    public function lotteries(): JsonResponse
    {
        $lotteries = Lottery::orderBy('name')->get(['id', 'name', 'draw_times'])
            ->map(fn (Lottery $lottery) => [
                'id' => $lottery->id,
                'name' => $lottery->name,
                'draw_times' => $lottery->draw_times ?? [],
            ]);

        return response()->json(['data' => $lotteries]);
    }
}
