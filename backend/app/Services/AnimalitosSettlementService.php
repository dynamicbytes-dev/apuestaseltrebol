<?php

namespace App\Services;

use App\Models\AnimalitoSorteo;
use App\Models\Lottery;
use App\Models\Ticket;
use App\Models\TicketSelection;

/**
 * Liquida un ticket de animalitos contra el sorteo que la propia apuesta
 * declara.
 *
 * El ticket guarda en `sorteo_at` el horario del sorteo al que apuesta, así
 * que la validación busca exactamente ese sorteo y no "el último del día".
 * Cada pierna se liquida por separado: solo pagan las que resultaron
 * ganadoras.
 */
class AnimalitosSettlementService
{
    /**
     * @return array{
     *     status: string,
     *     payable: float,
     *     legs: array<int, array<string, mixed>>,
     *     note: string
     * }
     */
    public function settle(Ticket $ticket): array
    {
        $ticket->loadMissing('selections');

        $selection = $ticket->selections->first();

        if (! $selection || ! $selection->lottery_id || ! $ticket->sorteo_at) {
            return $this->result(
                Ticket::SETTLEMENT_REVIEW,
                0.0,
                [],
                'El ticket no declara el sorteo al que pertenece la apuesta.'
            );
        }

        $lottery = Lottery::find($selection->lottery_id);
        $sorteo = AnimalitoSorteo::where('lottery_id', $selection->lottery_id)
            ->where('is_resolved', true)
            ->where('sorteo_at', $ticket->sorteo_at)
            ->first();

        if (! $sorteo) {
            return $this->result(
                Ticket::SETTLEMENT_PENDING,
                0.0,
                [],
                'El sorteo de las '.$ticket->sorteo_at->format('H:i').' del '
                    .$ticket->sorteo_at->format('d/m/Y').' aún no tiene resultado oficial registrado.'
            );
        }

        $multiplier = (float) ($lottery?->payout_multiplier ?? 1);
        $legs = [];
        $payable = 0.0;

        foreach ($ticket->selections as $leg) {
            $selectedNumber = (string) ($leg->metadata['number'] ?? $leg->lotteryAnimal?->number ?? '');
            $won = ((string) $sorteo->number === $selectedNumber);
            $payout = $won ? round((float) $leg->amount * $multiplier, 2) : 0.0;

            $payable += $payout;

            $legs[] = [
                'selection_id' => $leg->id,
                'label' => $leg->selection_label,
                'amount' => (float) $leg->amount,
                'status' => $won ? TicketSelection::SETTLEMENT_WON : TicketSelection::SETTLEMENT_LOST,
                'payout' => $payout,
            ];
        }

        $payable = round($payable, 2);

        if ($payable <= 0) {
            return $this->result(
                Ticket::SETTLEMENT_LOST,
                0.0,
                $legs,
                'El ticket no es ganador. En el sorteo de '.($lottery?->name ?? 'la lotería')
                    .' resultó ganador el N° '.$sorteo->number.' - '.$sorteo->animal.'.'
            );
        }

        return $this->result(
            Ticket::SETTLEMENT_WON,
            $payable,
            $legs,
            'Gana el N° '.$sorteo->number.' - '.$sorteo->animal.'.'
        );
    }

    /**
     * @param  array<int, array<string, mixed>>  $legs
     * @return array{status: string, payable: float, legs: array<int, array<string, mixed>>, note: string}
     */
    private function result(string $status, float $payable, array $legs, string $note): array
    {
        return [
            'status' => $status,
            'payable' => $payable,
            'legs' => $legs,
            'note' => $note,
        ];
    }
}
