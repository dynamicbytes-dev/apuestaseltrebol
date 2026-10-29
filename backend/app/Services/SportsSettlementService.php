<?php

namespace App\Services;

use App\Exceptions\SportsApiException;
use App\Models\Ticket;
use App\Models\TicketSelection;
use Illuminate\Support\Str;

/**
 * Liquida las jugadas de un ticket de parley contra el resultado oficial del
 * evento, en el proveedor deportivo.
 *
 * Principio: solo se liquida automáticamente lo que se puede determinar con
 * certeza. Cualquier mercado no reconocido, evento sin resultado o
 * proveedor sin datos deja la jugada en "review" para que la revise el
 * supervisor. Es preferible escalar a revisión antes que pagar un ticket
 * perdedor.
 */
class SportsSettlementService
{
    public function __construct(private readonly SportsApiService $api) {}

    /**
     * Liquida cada pierna del ticket y devuelve el estado global.
     *
     * @return array{status: string, note: string|null, legs: array<int, array<string, mixed>>}
     */
    public function settle(Ticket $ticket): array
    {
        $legs = [];
        $status = null;

        foreach ($ticket->selections as $selection) {
            $outcome = $this->settleSelection($selection);

            $legs[] = $outcome;
            $status = $this->worstStatus($status, $outcome['status']);
        }

        // Un ticket sin piernas no se puede liquidar: pasa a revisión.
        $status ??= Ticket::SETTLEMENT_REVIEW;

        return [
            'status' => $status,
            'note' => $this->summaryNote($status, $legs),
            'legs' => $legs,
        ];
    }

    /**
     * Combina el estado de las piernas. Una pierna perdedora descarta el
     * ticket entero, aunque otra pierna necesite revisión.
     */
    private function worstStatus(?string $current, string $candidate): string
    {
        if ($current === null) {
            return $candidate;
        }

        $order = [
            Ticket::SETTLEMENT_WON => 0,
            Ticket::SETTLEMENT_PENDING => 1,
            Ticket::SETTLEMENT_REVIEW => 2,
            Ticket::SETTLEMENT_LOST => 3,
        ];

        return $order[$candidate] > $order[$current] ? $candidate : $current;
    }

    /**
     * @return array{selection: TicketSelection, status: string, note: string}
     */
    private function settleSelection(TicketSelection $selection): array
    {
        $sport = $selection->sport;
        $eventId = $selection->external_event_id;

        if (blank($sport) || blank($eventId)) {
            return $this->outcome(
                $selection,
                TicketSelection::SETTLEMENT_REVIEW,
                'La selección no guarda la referencia del evento deportivo.'
            );
        }

        try {
            $result = $this->api->eventResult($sport, $eventId);
        } catch (SportsApiException $exception) {
            return $this->outcome(
                $selection,
                TicketSelection::SETTLEMENT_REVIEW,
                'No se pudo consultar el resultado oficial: '.$exception->getMessage()
            );
        }

        if (! $result['found']) {
            return $this->outcome(
                $selection,
                TicketSelection::SETTLEMENT_REVIEW,
                'El evento ya no está disponible en el proveedor deportivo.'
            );
        }

        if (! $result['finished']) {
            return $this->outcome(
                $selection,
                TicketSelection::SETTLEMENT_PENDING,
                'El evento todavía no tiene resultado oficial ('.$this->statusLabel($result).').'
            );
        }

        $verdict = $this->evaluate($selection, $result);

        if ($verdict === null) {
            return $this->outcome(
                $selection,
                TicketSelection::SETTLEMENT_REVIEW,
                'El mercado "'.$selection->market.'" no se puede liquidar automáticamente.'
            );
        }

        return $this->outcome(
            $selection,
            $verdict ? TicketSelection::SETTLEMENT_WON : TicketSelection::SETTLEMENT_LOST,
            $verdict
                ? 'Gana: '.$this->scoreLabel($result)
                : 'No gana: '.$this->scoreLabel($result)
        );
    }

    /**
     * @return array{selection: TicketSelection, status: string, note: string}
     */
    private function outcome(TicketSelection $selection, string $status, string $note): array
    {
        return [
            'selection' => $selection,
            'status' => $status,
            'note' => $note,
        ];
    }

    /**
     * Determina si la selección ganó, perdió o no se puede determinar.
     *
     * @return bool|null true = ganó, false = perdió, null = no determinable
     */
    private function evaluate(TicketSelection $selection, array $result): ?bool
    {
        $raw = mb_strtolower(trim((string) $selection->selection_label));
        $label = $this->normalize($raw);
        $market = $this->normalize((string) $selection->market);

        $homeScore = $result['home_score'];
        $awayScore = $result['away_score'];

        if ($homeScore === null || $awayScore === null) {
            return null;
        }

        $homeScore = (float) $homeScore;
        $awayScore = (float) $awayScore;

        // Regla 1: doble oportunidad. Se evalúa antes que el ganador simple
        // porque "Home or Draw" también contiene "Home".
        if (in_array($label, ['homeordraw', 'homedraw', 'draworaway', 'drawaway', 'homeoraway'], true)) {
            $homeWins = $homeScore > $awayScore;
            $awayWins = $awayScore > $homeScore;
            $draw = $homeScore === $awayScore;

            return match ($label) {
                'homeordraw', 'homedraw' => $homeWins || $draw,
                'draworaway', 'drawaway' => $draw || $awayWins,
                'homeoraway' => true,
            };
        }

        // Regla 2: total de goles (Over/Under). Se usa la etiqueta sin
        // normalizar porque el decimal del umbral es significativo.
        if (preg_match('/^(over|under)\s*([0-9]+(?:[.,][0-9]+)?)/', $raw, $matches) === 1) {
            $threshold = (float) str_replace(',', '.', $matches[2]);
            $total = $homeScore + $awayScore;

            return $matches[1] === 'over' ? $total > $threshold : $total < $threshold;
        }

        // Regla 3: ambos equipos marcan.
        if ($this->isBothTeamsScoreMarket($market)) {
            $bothScored = $homeScore > 0 && $awayScore > 0;

            if (in_array($label, ['yes', 'si'], true)) {
                return $bothScored;
            }

            if ($label === 'no') {
                return ! $bothScored;
            }
        }

        // Reglas 4 y 5: ganador del partido, por signo o por nombre de equipo.
        if (! $this->isWinnerMarket($market)) {
            return null;
        }

        if (in_array($label, ['home', '1', 'local', 'h'], true)) {
            return $homeScore > $awayScore;
        }

        if (in_array($label, ['away', '2', 'visitante', 'a'], true)) {
            return $awayScore > $homeScore;
        }

        if (in_array($label, ['draw', 'x', 'empate'], true)) {
            return $homeScore === $awayScore;
        }

        $homeName = $this->normalize((string) ($result['home_name'] ?? ''));
        $awayName = $this->normalize((string) ($result['away_name'] ?? ''));

        if ($homeName !== '' && $homeName === $label) {
            return $homeScore > $awayScore;
        }

        if ($awayName !== '' && $awayName === $label) {
            return $awayScore > $homeScore;
        }

        return null;
    }

    private function isWinnerMarket(string $market): bool
    {
        foreach (config('sports.settlement.winner_markets', []) as $needle) {
            if (str_contains($market, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function isBothTeamsScoreMarket(string $market): bool
    {
        foreach (config('sports.settlement.both_teams_score_markets', []) as $needle) {
            if (str_contains($market, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Normaliza un texto para comparar: sin acentos, sin espacios y sin
     * signos. "Home or Draw" y "Home/Draw" terminan siendo equivalentes.
     */
    private function normalize(string $value): string
    {
        return (string) preg_replace('/[^a-z0-9]+/', '', Str::ascii(mb_strtolower(trim($value))));
    }

    private function scoreLabel(array $result): string
    {
        $home = $result['home_name'] ?? 'Local';
        $away = $result['away_name'] ?? 'Visitante';

        return trim("{$home} {$result['home_score']} - {$result['away_score']} {$away}");
    }

    private function statusLabel(array $result): string
    {
        return $result['status_long'] ?: ($result['status_short'] ?: 'en curso');
    }

    /**
     * Resumen legible del estado global, pensado para mostrarse al usuario.
     */
    private function summaryNote(string $status, array $legs): string
    {
        if ($status === Ticket::SETTLEMENT_WON) {
            return 'Todas las jugadas son ganadoras.';
        }

        if ($status === Ticket::SETTLEMENT_LOST) {
            foreach ($legs as $leg) {
                if ($leg['status'] === TicketSelection::SETTLEMENT_LOST) {
                    return $leg['note'];
                }
            }

            return 'El ticket no es ganador.';
        }

        if ($status === Ticket::SETTLEMENT_REVIEW) {
            foreach ($legs as $leg) {
                if ($leg['status'] === TicketSelection::SETTLEMENT_REVIEW) {
                    return $leg['note'];
                }
            }

            return 'El ticket requiere revisión manual.';
        }

        foreach ($legs as $leg) {
            if ($leg['status'] === TicketSelection::SETTLEMENT_PENDING) {
                return $leg['note'];
            }
        }

        return 'El resultado oficial todavía no está disponible.';
    }
}
