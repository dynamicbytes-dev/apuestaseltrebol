<?php

namespace App\Services;

use App\Models\Ticket;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Agregados de operación para el análisis por agencia.
 */
class AnalyticsService
{
    /** Periodo por defecto cuando no se indica rango: los últimos 30 días. */
    private const DEFAULT_DAYS = 30;

    /**
     * Resumen de una agencia.
     */
    public function agencySummary(?int $agencyId, ?string $from, ?string $to, ?int $supervisorId = null): array
    {
        [$from, $to] = $this->resolvePeriod($from, $to);

        $base = $this->baseQuery($agencyId, $from, $to, $supervisorId);

        return [
            'scope' => [
                'agency_id' => $agencyId,
                'supervisor_id' => $supervisorId,
            ],
            'period' => [
                'from' => $from,
                'to' => $to,
            ],
            'totals' => $this->totals(clone $base),
            'by_type' => $this->byType(clone $base),
            'by_status' => $this->byStatus(clone $base),
            'daily' => $this->daily(clone $base),
            'settlement' => $this->bySettlement(clone $base),
        ];
    }

    /**
     * Resumen global con el desglose por agencia.
     */
    public function globalSummary(?string $from, ?string $to): array
    {
        [$from, $to] = $this->resolvePeriod($from, $to);

        $base = $this->baseQuery(null, $from, $to);

        return [
            'scope' => [
                'agency_id' => null,
            ],
            'period' => [
                'from' => $from,
                'to' => $to,
            ],
            'totals' => $this->totals(clone $base),
            'by_type' => $this->byType(clone $base),
            'by_status' => $this->byStatus(clone $base),
            'daily' => $this->daily(clone $base),
            'settlement' => $this->bySettlement(clone $base),
            'by_agency' => $this->byAgency($from, $to),
        ];
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function resolvePeriod(?string $from, ?string $to): array
    {
        $to = $to ? Carbon::parse($to)->toDateString() : Carbon::now()->toDateString();
        $from = $from
            ? Carbon::parse($from)->toDateString()
            : Carbon::parse($to)->subDays(self::DEFAULT_DAYS)->toDateString();

        if ($from > $to) {
            [$from, $to] = [$to, $from];
        }

        return [$from, $to];
    }

    private function baseQuery(?int $agencyId, string $from, string $to, ?int $supervisorId = null): Builder
    {
        $query = Ticket::query();

        if ($agencyId !== null) {
            $query->where('agency_id', $agencyId);
        }

        // El alcance del supervisor son las taquillas que tiene a su cargo.
        if ($supervisorId !== null) {
            $query->where('supervisor_id', $supervisorId);
        }

        return $query->whereDate('created_at', '>=', $from)
            ->whereDate('created_at', '<=', $to);
    }

    private function totals($query): array
    {
        $row = (clone $query)
            ->selectRaw('COUNT(*) as tickets')
            ->selectRaw('COALESCE(SUM(stake), 0) as stake')
            ->selectRaw('COALESCE(SUM(paid_amount), 0) as paid')
            ->selectRaw('COALESCE(SUM(CASE WHEN status = ? THEN potential_payout ELSE 0 END), 0) as exposure', [Ticket::STATUS_PENDING])
            ->selectRaw('COUNT(CASE WHEN status = ? THEN 1 END) as pending', [Ticket::STATUS_PENDING])
            ->selectRaw('COUNT(CASE WHEN status = ? THEN 1 END) as cancelled', [Ticket::STATUS_CANCELLED])
            ->selectRaw('COUNT(CASE WHEN status = ? THEN 1 END) as paid_count', [Ticket::STATUS_PAID])
            ->first();

        $stake = round((float) $row->stake, 2);
        $paid = round((float) $row->paid, 2);

        return [
            'tickets' => (int) $row->tickets,
            'stake' => $stake,
            'paid' => $paid,
            'net' => round($stake - $paid, 2),
            'exposure' => round((float) $row->exposure, 2),
            'pending' => (int) $row->pending,
            'cancelled' => (int) $row->cancelled,
            'paid_count' => (int) $row->paid_count,
        ];
    }

    private function byType($query): array
    {
        return (clone $query)
            ->selectRaw('type')
            ->selectRaw('COUNT(*) as tickets')
            ->selectRaw('COALESCE(SUM(stake), 0) as stake')
            ->selectRaw('COALESCE(SUM(paid_amount), 0) as paid')
            ->selectRaw('COALESCE(SUM(potential_payout), 0) as potential_payout')
            ->groupBy('type')
            ->orderByDesc('tickets')
            ->get()
            ->map(fn ($row) => [
                'type' => $row->type,
                'tickets' => (int) $row->tickets,
                'stake' => round((float) $row->stake, 2),
                'paid' => round((float) $row->paid, 2),
                'potential_payout' => round((float) $row->potential_payout, 2),
            ])
            ->all();
    }

    private function byStatus($query): array
    {
        return (clone $query)
            ->selectRaw('status')
            ->selectRaw('COUNT(*) as tickets')
            ->selectRaw('COALESCE(SUM(stake), 0) as stake')
            ->groupBy('status')
            ->orderByDesc('tickets')
            ->get()
            ->map(fn ($row) => [
                'status' => $row->status,
                'tickets' => (int) $row->tickets,
                'stake' => round((float) $row->stake, 2),
            ])
            ->all();
    }

    private function daily($query): array
    {
        return (clone $query)
            ->selectRaw('DATE(created_at) as day')
            ->selectRaw('COUNT(*) as tickets')
            ->selectRaw('COALESCE(SUM(stake), 0) as stake')
            ->selectRaw('COALESCE(SUM(paid_amount), 0) as paid')
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->map(fn ($row) => [
                'date' => $row->day,
                'tickets' => (int) $row->tickets,
                'stake' => round((float) $row->stake, 2),
                'paid' => round((float) $row->paid, 2),
            ])
            ->all();
    }

    private function bySettlement($query): array
    {
        return (clone $query)
            ->where('type', Ticket::TYPE_PARLEY)
            ->selectRaw('settlement_status')
            ->selectRaw('COUNT(*) as tickets')
            ->groupBy('settlement_status')
            ->get()
            ->map(fn ($row) => [
                'settlement_status' => $row->settlement_status,
                'tickets' => (int) $row->tickets,
            ])
            ->all();
    }

    /**
     * Ventas y porciento de cada taquilla.
     *
     * El porciento es el propio de cada taquilla: lo fija el supervisor al
     * registrarla.
     *
     * @return array<int, array<string, mixed>>
     */
    public function taquillaSales(?string $from, ?string $to, ?int $supervisorId = null): array
    {
        [$from, $to] = $this->resolvePeriod($from, $to);

        $porDefecto = (float) config('business.supervisor_share', 0.13) * 100;

        $query = Ticket::query()
            ->join('users as taquillas', 'taquillas.id', '=', 'tickets.taquilla_id')
            ->whereDate('tickets.created_at', '>=', $from)
            ->whereDate('tickets.created_at', '<=', $to);

        if ($supervisorId !== null) {
            $query->where('tickets.supervisor_id', $supervisorId);
        }

        return $query
            ->selectRaw('tickets.taquilla_id as taquilla_id')
            ->selectRaw('COALESCE(taquillas.commission_percentage, ?) as percentage', [$porDefecto])
            ->selectRaw('COUNT(tickets.id) as tickets')
            ->selectRaw('COALESCE(SUM(tickets.stake), 0) as stake')
            ->selectRaw('COALESCE(SUM(tickets.paid_amount), 0) as paid')
            ->groupBy('tickets.taquilla_id', 'taquillas.commission_percentage')
            ->get()
            ->map(function ($row) use ($porDefecto) {
                $porcentaje = (float) $row->percentage ?: $porDefecto;

                return [
                    'taquilla_id' => (int) $row->taquilla_id,
                    'tickets' => (int) $row->tickets,
                    'stake' => round((float) $row->stake, 2),
                    'paid' => round((float) $row->paid, 2),
                    'net' => round((float) $row->stake - (float) $row->paid, 2),
                    'share_percentage' => $porcentaje,
                    'share_amount' => round((float) $row->stake * $porcentaje / 100, 2),
                ];
            })
            ->keyBy('taquilla_id')
            ->all();
    }

    /**
     * Ventas y porciento de cada agencia.
     *
     * Una agencia puede tener tantas taquillas como quiera: las ventas de
     * la agencia son la suma de las de todas ellas.
     *
     * @return array<int, array<string, mixed>>
     */
    public function agencySales(?string $from, ?string $to): array
    {
        [$from, $to] = $this->resolvePeriod($from, $to);

        $percentage = (float) config('business.agency_share', 0.015);

        return $this->byAgency($from, $to)
            ->map(fn (array $row) => [
                ...$row,
                'share_percentage' => $percentage * 100,
                'share_amount' => round($row['stake'] * $percentage, 2),
            ])
            ->all();
    }

    private function byAgency(string $from, string $to): Collection
    {
        $percentage = (float) config('business.agency_share', 0.015);

        return Ticket::query()
            ->join('agencies', 'agencies.id', '=', 'tickets.agency_id')
            ->whereDate('tickets.created_at', '>=', $from)
            ->whereDate('tickets.created_at', '<=', $to)
            ->selectRaw('agencies.id as agency_id')
            ->selectRaw('agencies.name as agency_name')
            ->selectRaw('COUNT(tickets.id) as tickets')
            ->selectRaw('COALESCE(SUM(tickets.stake), 0) as stake')
            ->selectRaw('COALESCE(SUM(tickets.paid_amount), 0) as paid')
            ->groupBy('agencies.id', 'agencies.name')
            ->orderByDesc('stake')
            ->get()
            ->map(fn ($row) => [
                'agency_id' => (int) $row->agency_id,
                'agency_name' => $row->agency_name,
                'tickets' => (int) $row->tickets,
                'stake' => round((float) $row->stake, 2),
                'paid' => round((float) $row->paid, 2),
                'net' => round((float) $row->stake - (float) $row->paid, 2),
                'share_percentage' => $percentage * 100,
                'share_amount' => round((float) $row->stake * $percentage, 2),
            ])
            ->values();
    }
}
