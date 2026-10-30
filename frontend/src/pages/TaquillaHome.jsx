import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ticket,
  DollarSign,
  Clock,
  CheckCircle2,
  PlusCircle,
  Receipt,
  Building2,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import {
  formatAmount,
  formatTicketDate,
  TICKET_TYPE_LABELS,
  ticketSingleStatus,
} from '../utils/tickets';

function formatLimit(value) {
  if (value === null || value === undefined || value === '') {
    return 'Sin límite';
  }

  return formatAmount(value);
}

export default function TaquillaHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    api
      .get('/taquilla/dashboard')
      .then((response) => {
        if (active) setData(response.data.data);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <span>Terminal Taquilla</span>
            <span className="page-title-badge">Punto de Venta</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            Emisión de tickets de lotería, hipismo y parley en tiempo real.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link className="btn btn-secondary" to="/taquilla/tickets">
            <Receipt size={18} />
            <span>Consultar / Pagar</span>
          </Link>
          <Link className="btn btn-primary" to="/taquilla/nueva">
            <PlusCircle size={18} />
            <span>Nueva apuesta</span>
          </Link>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {data ? (
        <>
          {!data.agency && (
            <div className="alert alert-error">
              <AlertCircle size={18} />
              <span>Tu usuario no tiene una agencia asignada. Contacta a tu supervisor.</span>
            </div>
          )}

          <div className="stats-grid">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="stat-label">Tickets Hoy</p>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ticket size={20} />
                </div>
              </div>
              <p className="stat-value">{data.stats.tickets_today}</p>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="stat-label">Ventas Hoy</p>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={20} />
                </div>
              </div>
              <p className="stat-value" style={{ fontSize: '1.65rem' }}>
                {formatAmount(data.stats.stake_today)}
              </p>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="stat-label">Tickets Pendientes</p>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={20} />
                </div>
              </div>
              <p className="stat-value">{data.stats.pending}</p>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="stat-label">Premios Pagados Hoy</p>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'rgba(167, 139, 250, 0.12)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <p className="stat-value" style={{ fontSize: '1.65rem' }}>
                {formatAmount(data.stats.paid_today)}
              </p>
            </div>
          </div>

          <section className="card" style={{ marginTop: '0.5rem' }}>
            <h2 className="card-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={18} color="#34d399" />
                Agencia & Topes Autorizados
              </span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <small style={{ color: 'var(--text-tertiary)', display: 'block' }}>Agencia Asignada</small>
                <strong style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>{data.agency?.name ?? 'Sin agencia'}</strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <small style={{ color: 'var(--text-tertiary)', display: 'block' }}>Tope Máximo por Apuesta</small>
                <strong style={{ color: '#34d399', fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}>
                  {formatLimit(data.agency?.max_bet_amount)}
                </strong>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <small style={{ color: 'var(--text-tertiary)', display: 'block' }}>Ganancia Máxima por Ticket</small>
                <strong style={{ color: '#38bdf8', fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}>
                  {formatLimit(data.agency?.max_ticket_payout)}
                </strong>
              </div>
            </div>
          </section>

          <section className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <h2 className="card-title" style={{ margin: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Receipt size={18} color="#34d399" />
                  Últimos Tickets Emitidos
                </span>
              </h2>
              <Link className="btn btn-secondary btn-sm" to="/taquilla/tickets">
                <span>Ver todos los tickets</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {data.recent.length === 0 ? (
              <p className="empty">Aún no has registrado tickets en la jornada de hoy.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Tipo de Juego</th>
                      <th>Monto Apostado</th>
                      <th>Premio Potencial</th>
                      <th>Estado</th>
                      <th>Fecha / Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {ticket.code}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>
                            {TICKET_TYPE_LABELS[ticket.type] ?? ticket.type}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontFamily: 'var(--font-mono)' }}>
                            {formatAmount(ticket.stake)}
                          </strong>
                        </td>
                        <td>
                          <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                            {formatAmount(ticket.potential_payout)}
                          </strong>
                        </td>
                        <td>
                          {(() => {
                            const single = ticketSingleStatus(ticket);
                            return (
                              <span className={single.className}>
                                {single.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          {formatTicketDate(ticket.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        !error && (
          <div className="empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <span>Cargando terminal de taquilla...</span>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )
      )}
    </div>
  );
}
