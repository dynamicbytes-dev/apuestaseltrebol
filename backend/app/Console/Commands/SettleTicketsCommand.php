<?php

namespace App\Console\Commands;

use App\Models\Ticket;
use App\Services\TicketSettlementService;
use Illuminate\Console\Command;

/**
 * Liquida los tickets de parley pendientes contra el resultado oficial.
 *
 * Se ejecuta de forma periodica para que el estado de las jugadas se
 * actualice solo, sin que nadie tenga que abrir el ticket para verlo.
 *
 * El proveedor de resultados limita las peticiones por minuto (10), asi que
 * la corrida tiene un presupuesto de consultas y va con calma entre una y
 * otra. Los resultados ya consultados se sirven de la caché.
 */
class SettleTicketsCommand extends Command
{
    protected $signature = 'tickets:settle';

    protected $description = 'Liquida los tickets de parley pendientes contra el resultado oficial';

    /** Consultas al proveedor como máximo por corrida. */
    private const BUDGET = 8;

    /** Espera entre consultas, en microsegundos. */
    private const DELAY_US = 7000000;

    public function handle(TicketSettlementService $settlements): int
    {
        $tickets = Ticket::where('status', Ticket::STATUS_PENDING)
            ->where('type', Ticket::TYPE_PARLEY)
            ->where('settlement_source', '!=', 'manual')
            ->with('selections')
            ->orderBy('id')
            ->limit(50)
            ->get();

        if ($tickets->isEmpty()) {
            $this->info('No hay tickets de parley pendientes de liquidar.');

            return Command::SUCCESS;
        }

        $presupuesto = self::BUDGET;
        $liquidados = 0;
        $sinResolver = 0;

        foreach ($tickets as $ticket) {
            if ($presupuesto <= 0) {
                break;
            }

            $presupuesto -= max(1, $ticket->selections->count());

            try {
                $resultado = $settlements->settle($ticket);

                if ($resultado['status'] === Ticket::SETTLEMENT_WON) {
                    $liquidados++;
                    $this->line("  <info>Ticket {$ticket->code}: ganador</info>");
                } elseif ($resultado['status'] === Ticket::SETTLEMENT_LOST) {
                    $liquidados++;
                    $this->line("  <comment>Ticket {$ticket->code}: no ganador</comment>");
                } else {
                    $sinResolver++;
                }
            } catch (\Throwable $exception) {
                // Un fallo puntual con el proveedor no debe parar la corrida.
                $this->warn("  Ticket {$ticket->code}: ".$exception->getMessage());
            }

            usleep(self::DELAY_US);
        }

        $this->info("Liquidados: {$liquidados}. Sin resolver todavia: {$sinResolver}.");

        return Command::SUCCESS;
    }
}
