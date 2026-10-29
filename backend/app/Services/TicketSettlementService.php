<?php

namespace App\Services;

use App\Models\AnimalitoSorteo;
use App\Models\Race;
use App\Models\Ticket;
use App\Models\TicketSelection;
use Illuminate\Support\Collection;

/**
 * Liquida un ticket de cualquier modalidad contra su resultado oficial.
 *
 * Devuelve siempre la misma forma:
 *   status   pending | won | lost | review
 *   payable  monto máximo que se puede pagar por ese ticket
 *   legs     detalle por pierna (monto, estado y premio de cada una)
 *   note     explicación en lenguaje llano
 */
class TicketSettlementService
{
    public function __construct(
        private readonly AnimalitosSettlementService $animalitos,
        private readonly SportsSettlementService $sports,
    ) {}

    /**
     * Liquida en lote los tickets de modalidades locales.
     *
     * El parley no se toca aquí: su resultado oficial vive en el proveedor y
     * se consulta en el momento del cobro. Animalitos e hipismo se resuelven
     * contra la base de datos, así que la lista de tickets puede liquidarlos
     * con dos consultas en total y mostrar el estado real en la tabla.
     *
     * @param  Collection<int, Ticket>  $tickets
     * @return Collection<int, Ticket>
     */
    public function settleLocal(Collection $tickets): Collection
    {
        if ($tickets->isEmpty()) {
            return $tickets;
        }

        $animalitos = $tickets->filter(fn (Ticket $ticket) => $ticket->type === Ticket::TYPE_ANIMALITOS
            && $ticket->settlement_source !== 'manual');
        $hipismo = $tickets->filter(fn (Ticket $ticket) => $ticket->type === Ticket::TYPE_HIPISMO
            && $ticket->settlement_source !== 'manual');

        $sorteos = $this->resolvedSorteos($animalitos);
        $carreras = $this->finishedRaces($hipismo);

        foreach ($this->animalitos->settleMany($animalitos, $sorteos) as $i => $resultado) {
            $this->persist($animalitos->values()[$i], $resultado);
        }

        foreach ($hipismo as $ticket) {
            $this->persist($ticket, $this->settleHipismoWith($ticket, $carreras));
        }

        return $tickets;
    }

    /**
     * Sorteos resueltos de las loterías implicadas, en una sola consulta.
     *
     * @param  Collection<int, Ticket>  $tickets
     * @return array<int, AnimalitoSorteo>
     */
    private function resolvedSorteos(Collection $tickets): array
    {
        $pares = [];

        foreach ($tickets as $ticket) {
            if (! $ticket->sorteo_at) {
                continue;
            }

            foreach ($ticket->selections as $selection) {
                if ($selection->lottery_id) {
                    $pares[$selection->lottery_id.'|'.$ticket->sorteo_at->format('Y-m-d H:i:s')] = true;
                }
            }
        }

        if ($pares === []) {
            return [];
        }

        $loteriaIds = array_values(array_unique(array_map(
            fn (string $clave) => (int) explode('|', $clave)[0],
            array_keys($pares)
        )));

        $instantes = array_values(array_unique(array_map(
            fn (string $clave) => explode('|', $clave)[1],
            array_keys($pares)
        )));

        return AnimalitoSorteo::where('is_resolved', true)
            ->whereIn('lottery_id', $loteriaIds)
            ->whereIn('sorteo_at', $instantes)
            ->get()
            ->all();
    }

    /**
     * Carreras finalizadas con su ganador, en una sola consulta.
     *
     * @param  Collection<int, Ticket>  $tickets
     * @return Collection<int, Race>
     */
    private function finishedRaces(Collection $tickets): Collection
    {
        $ids = [];

        foreach ($tickets as $ticket) {
            foreach ($ticket->selections as $selection) {
                if ($selection->race_id) {
                    $ids[] = (int) $selection->race_id;
                }
            }
        }

        if ($ids === []) {
            return collect();
        }

        return Race::with('winner')->whereIn('id', array_unique($ids))->get()->keyBy('id');
    }

    /**
     * Guarda el resultado de la liquidación y el estado de cada pierna.
     *
     * @param  array{status: string, payable: float, legs: array<int, array<string, mixed>>, note: string}  $resultado
     */
    private function persist(Ticket $ticket, array $resultado): void
    {
        foreach ($resultado['legs'] as $leg) {
            TicketSelection::where('id', $leg['selection_id'])->update([
                'settlement_status' => $leg['status'],
                'settlement_note' => $resultado['note'],
                'settled_at' => now(),
            ]);
        }

        if ($ticket->settlement_source === 'manual') {
            // Una decisión del supervisor no se toca.
            return;
        }

        if ($ticket->settlement_status === $resultado['status'] && $ticket->settlement_source === 'auto') {
            return;
        }

        $ticket->update([
            'settlement_status' => $resultado['status'],
            'settlement_note' => $resultado['note'],
            'settlement_source' => 'auto',
        ]);
    }

    /**
     * @return array{status: string, payable: float, legs: array<int, array<string, mixed>>, note: string}
     */
    public function settle(Ticket $ticket): array
    {
        // Una decisión manual del supervisor tiene prioridad: el motor
        // automático no debe sobrescribir un caso ya revisado a mano.
        if ($ticket->settlement_source === 'manual') {
            return [
                'status' => $ticket->settlement_status,
                'payable' => $ticket->settlement_status === Ticket::SETTLEMENT_WON
                    ? (float) $ticket->potential_payout
                    : 0.0,
                'legs' => [],
                'note' => $ticket->settlement_note ?? '',
            ];
        }

        return match ($ticket->type) {
            Ticket::TYPE_ANIMALITOS => $this->settleAnimalitos($ticket),
            Ticket::TYPE_HIPISMO => $this->settleHipismo($ticket),
            Ticket::TYPE_PARLEY => $this->settleParley($ticket),
        };
    }

    /**
     * @return array{status: string, payable: float, legs: array<int, array<string, mixed>>, note: string}
     */
    private function settleAnimalitos(Ticket $ticket): array
    {
        $result = $this->animalitos->settle($ticket);

        // Se guarda el estado de cada pierna para la trazabilidad.
        foreach ($result['legs'] as $leg) {
            TicketSelection::where('id', $leg['selection_id'])->update([
                'settlement_status' => $leg['status'],
                'settlement_note' => $result['note'],
                'settled_at' => now(),
            ]);
        }

        $ticket->update([
            'settlement_status' => $result['status'],
            'settlement_note' => $result['note'],
            'settlement_source' => 'auto',
        ]);

        return $result;
    }

    /**
     * @return array{status: string, payable: float, legs: array<int, array<string, mixed>>, note: string}
     */
    private function settleHipismo(Ticket $ticket): array
    {
        $ticket->loadMissing('selections');

        $selection = $ticket->selections->first();

        if (! $selection || ! $selection->race_id) {
            return $this->result(
                Ticket::SETTLEMENT_REVIEW,
                0.0,
                [],
                'El ticket no referencia la carrera de la apuesta.'
            );
        }

        $race = Race::with('winner')->find($selection->race_id);

        return $this->settleHipismoWith($ticket, collect([$race->id => $race])->filter());
    }

    /**
     * Liquida un ticket de hipismo con las carreras ya cargadas.
     *
     * @param  Collection<int, Race>  $carreras
     * @return array{status: string, payable: float, legs: array<int, array<string, mixed>>, note: string}
     */
    private function settleHipismoWith(Ticket $ticket, Collection $carreras): array
    {
        $ticket->loadMissing('selections');

        $selection = $ticket->selections->first();

        if (! $selection || ! $selection->race_id) {
            return $this->result(
                Ticket::SETTLEMENT_REVIEW,
                0.0,
                [],
                'El ticket no referencia la carrera de la apuesta.'
            );
        }

        $race = $carreras->get($selection->race_id);

        if (! $race || $race->status !== Race::STATUS_FINISHED) {
            return $this->result(
                Ticket::SETTLEMENT_PENDING,
                0.0,
                [],
                'La carrera "'.($race?->name ?? 'Hipismo').'" aún no tiene resultados oficiales registrados.'
            );
        }

        $won = (int) $race->winner_horse_id === (int) $selection->horse_id;

        $legs = [[
            'selection_id' => $selection->id,
            'label' => $selection->selection_label,
            'amount' => (float) ($selection->amount ?? $ticket->stake),
            'status' => $won ? TicketSelection::SETTLEMENT_WON : TicketSelection::SETTLEMENT_LOST,
            'payout' => $won ? (float) $ticket->potential_payout : 0.0,
        ]];

        if (! $won) {
            $winnerName = $race->winner
                ? 'N° '.$race->winner->number.' - '.$race->winner->name
                : 'No asignado';

            return $this->result(
                Ticket::SETTLEMENT_LOST,
                0.0,
                $legs,
                'El ticket no es ganador. En la carrera "'.$race->name
                    .'", el ejemplar ganador oficial fue '.$winnerName.'.'
            );
        }

        return $this->result(
            Ticket::SETTLEMENT_WON,
            (float) $ticket->potential_payout,
            $legs,
            'El ejemplar apostado es el ganador oficial.'
        );
    }

    /**
     * @return array{status: string, payable: float, legs: array<int, array<string, mixed>>, note: string}
     */
    private function settleParley(Ticket $ticket): array
    {
        $ticket->loadMissing('selections');

        $settlement = $this->sports->settle($ticket);

        $legs = [];

        foreach ($settlement['legs'] as $leg) {
            $selection = $leg['selection'];

            $selection->update([
                'settlement_status' => $leg['status'],
                'settlement_note' => $leg['note'],
                'settled_at' => in_array($leg['status'], [
                    TicketSelection::SETTLEMENT_WON,
                    TicketSelection::SETTLEMENT_LOST,
                ], true) ? now() : null,
            ]);

            $legs[] = [
                'selection_id' => $selection->id,
                'label' => $selection->selection_label,
                'amount' => (float) ($selection->amount ?? $ticket->stake),
                'status' => $leg['status'],
                'payout' => $leg['status'] === TicketSelection::SETTLEMENT_WON
                    ? (float) $ticket->potential_payout
                    : 0.0,
            ];
        }

        $ticket->update([
            'settlement_status' => $settlement['status'],
            'settlement_note' => $settlement['note'],
            'settlement_source' => 'auto',
        ]);

        return [
            'status' => $settlement['status'],
            'payable' => $settlement['status'] === Ticket::SETTLEMENT_WON
                ? (float) $ticket->potential_payout
                : 0.0,
            'legs' => $legs,
            'note' => $settlement['note'],
        ];
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
