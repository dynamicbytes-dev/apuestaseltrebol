import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  AlertCircle,
  Calendar,
  TrendingUp,
  TrendingDown,
  Ticket,
  Wallet,
  RefreshCw,
  Percent,
} from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { TICKET_TYPE_LABELS, TICKET_STATUS_LABELS, formatAmount } from '../utils/tickets';

function MetricCard({ icon: Icon, label, value, tone, hint }) {
  const color = tone === 'danger' ? '#ef4444' : tone === 'info' ? '#38bdf8' : '#34d399';

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1.1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
        <Icon size={15} style={{ color }} />
        <span>{label}</span>
      </div>
      <strong style={{ fontSize: '1.45rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </strong>
      {hint && <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{hint}</span>}
    </div>
  );
}

export default function Analiticas() {
  const user = JSON.parse(localStorage.getItem('user') ?? '{}');
  const isAdmin = user.role === 'administrador';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = isAdmin ? '/admin/analytics' : '/supervisor/analytics';
      const res = await api.get(endpoint, {
        params: {
          from: from || undefined,
          to: to || undefined,
        },
      });
      setData(res.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals ?? {};
  const maxDaily = Math.max(1, ...(data?.daily ?? []).map((d) => d.tickets));

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <span>Analíticas</span>
            <span className="page-title-badge">{isAdmin ? 'Global' : 'Mi Agencia'}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            {isAdmin
              ? 'Consolidado de todas las agencias y desglose por agencia.'
              : `Operación de ${data?.scope?.agency_name ?? 'tu agencia'}: apostado, pagado y resultado.`}
          </p>
        </div>
      </header>

      {error && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <section
        className="card"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '0.85rem',
          flexWrap: 'wrap',
          background: 'var(--bg-input)',
          marginBottom: '1.25rem',
        }}
      >
        <div className="form-field" style={{ margin: 0 }}>
          <label htmlFor="analytics-from">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={14} color="#38bdf8" />
              <strong>Desde</strong>
            </span>
          </label>
          <input
            id="analytics-from"
            className="input"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        <div className="form-field" style={{ margin: 0 }}>
          <label htmlFor="analytics-to">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={14} color="#38bdf8" />
              <strong>Hasta</strong>
            </span>
          </label>
          <input
            id="analytics-to"
            className="input"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCw size={14} />
          <span>Actualizar</span>
        </button>

        {data?.period && (
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            Periodo: {data.period.from} → {data.period.to}
          </span>
        )}
      </section>

      {loading ? (
        <p className="empty">Calculando analíticas...</p>
      ) : !data ? (
        <p className="empty">No hay datos para mostrar.</p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <MetricCard icon={Ticket} label="Tickets emitidos" value={totals.tickets ?? 0} hint={`${totals.pending ?? 0} pendientes · ${totals.cancelled ?? 0} anulados`} />
            <MetricCard icon={Wallet} label="Total apostado" value={formatAmount(totals.stake)} tone="info" />
            <MetricCard icon={TrendingUp} label="Total pagado" value={formatAmount(totals.paid)} hint={`${totals.paid_count ?? 0} tickets pagados`} />
            <MetricCard
              icon={(totals.net ?? 0) >= 0 ? TrendingUp : TrendingDown}
              label="Resultado"
              value={formatAmount(totals.net)}
              tone={(totals.net ?? 0) >= 0 ? undefined : 'danger'}
              hint="Apostado menos pagado"
            />
            <MetricCard icon={BarChart3} label="Exposición pendiente" value={formatAmount(totals.exposure)} tone="info" hint="Premio potencial por cobrar" />
          </div>

          {/* KPI: porciento del supervisor sobre las ventas de sus taquillas */}
          {!isAdmin && data.share && (
            <div
              className="card"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '1.5rem',
                marginBottom: '1.25rem',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(56, 189, 248, 0.08))',
                border: '1px solid rgba(16, 185, 129, 0.35)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  paddingRight: '1.5rem',
                  borderRight: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#34d399',
                    flexShrink: 0,
                  }}
                >
                  <Percent size={22} />
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Comisiones de tus taquillas ({Math.round(data.share.percentage)}% de cada una)
                  </span>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: '1.65rem',
                      color: '#34d399',
                      fontFamily: 'var(--font-mono)',
                      lineHeight: 1.2,
                    }}
                  >
                    {formatAmount(data.share.amount)}
                  </strong>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div>
                  Ventas totales de tus taquillas:{' '}
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {formatAmount(data.share.base)}
                  </strong>
                </div>
                <div style={{ marginTop: '0.2rem', color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>
                  El {Math.round(data.share.percentage)}% se calcula por taquilla. El detalle de cada
                  una está en Gestión de Taquillas.
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Serie diaria */}
            <section className="card">
              <h2 className="card-title">Actividad diaria</h2>
              {data.daily?.length === 0 ? (
                <p className="empty">Sin tickets en el periodo.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.daily.map((day) => (
                    <div key={day.date} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', width: '92px', fontFamily: 'var(--font-mono)' }}>
                        {day.date}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: '20px',
                          background: 'var(--bg-input)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round((day.tickets / maxDaily) * 100)}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #10b981, #38bdf8)',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', width: '52px', textAlign: 'right' }}>
                        {day.tickets}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#34d399', fontFamily: 'var(--font-mono)', width: '82px', textAlign: 'right' }}>
                        {formatAmount(day.stake)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Por tipo de juego */}
            <section className="card">
              <h2 className="card-title">Por tipo de juego</h2>
              {data.by_type?.length === 0 ? (
                <p className="empty">Sin datos por tipo de juego.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Juego</th>
                        <th>Tickets</th>
                        <th>Apostado</th>
                        <th>Pagado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_type.map((row) => (
                        <tr key={row.type}>
                          <td>{TICKET_TYPE_LABELS[row.type] ?? row.type}</td>
                          <td>{row.tickets}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{formatAmount(row.stake)}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: '#34d399' }}>{formatAmount(row.paid)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Por estado */}
            <section className="card">
              <h2 className="card-title">Por estado</h2>
              {data.by_status?.length === 0 ? (
                <p className="empty">Sin datos por estado.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>Tickets</th>
                        <th>Apostado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_status.map((row) => (
                        <tr key={row.status}>
                          <td>{TICKET_STATUS_LABELS[row.status] ?? row.status}</td>
                          <td>{row.tickets}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{formatAmount(row.stake)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Liquidación de parley */}
            <section className="card">
              <h2 className="card-title">Liquidación de parley</h2>
              {data.settlement?.length === 0 ? (
                <p className="empty">No hay tickets de parley en el periodo.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Resultado</th>
                        <th>Tickets</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.settlement.map((row) => (
                        <tr key={row.settlement_status}>
                          <td>{row.settlement_status}</td>
                          <td>{row.tickets}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Desglose por agencia (solo admin) */}
            {isAdmin && (
              <section className="card" style={{ gridColumn: '1 / -1' }}>
                <h2 className="card-title">Desglose por agencia</h2>
                {data.by_agency?.length === 0 ? (
                  <p className="empty">Sin actividad por agencia en el periodo.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Agencia</th>
                          <th>Tickets</th>
                          <th>Apostado</th>
                          <th>Pagado</th>
                          <th>Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.by_agency.map((row) => (
                          <tr key={row.agency_id}>
                            <td>{row.agency_name}</td>
                            <td>{row.tickets}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{formatAmount(row.stake)}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: '#34d399' }}>{formatAmount(row.paid)}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: row.net >= 0 ? '#34d399' : '#ef4444' }}>
                              {formatAmount(row.net)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
