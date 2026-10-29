import { useEffect, useState, useCallback } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Eye,
  AlertCircle,
  CheckCircle2,
  History,
  Clock,
  RotateCcw,
} from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import {
  TICKET_TYPE_LABELS,
  TICKET_STATUS_LABELS,
  MOVEMENT_LABELS,
  ticketStatusClass,
  settlementStatusLabel,
  settlementStatusClass,
  formatAmount,
  formatTicketDate,
} from '../utils/tickets';

function MovementIcon({ type }) {
  if (type === 'created') return <Receipt size={14} />;
  if (type === 'paid') return <CheckCircle2 size={14} />;
  if (type === 'cancelled') return <RotateCcw size={14} />;
  if (type === 'review') return <AlertCircle size={14} />;
  return <History size={14} />;
}

export default function Historial() {
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [settlementFilter, setSettlementFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/supervisor/tickets', {
        params: {
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          settlement_status: settlementFilter || undefined,
          search: search.trim() || undefined,
        },
      });
      setTickets(res.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, settlementFilter, search]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const openDetail = async (ticket) => {
    setSelectedTicket(ticket);
    setMovements([]);
    setMovementsLoading(true);
    try {
      const res = await api.get(`/supervisor/tickets/${ticket.id}/movements`);
      setMovements(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setMovementsLoading(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <span>Historial de Tickets</span>
            <span className="page-title-badge">Supervisor</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            Tickets emitidos en tu agencia y trazabilidad de cada movimiento.
          </p>
        </div>
      </header>

      {error && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <section className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '1.25rem',
            background: 'var(--bg-input)',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '340px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                }}
              />
              <input
                className="input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Buscar por código de ticket..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="paid">Pagados</option>
                <option value="cancelled">Anulados</option>
              </select>

              <select
                className="input"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="">Todos los juegos</option>
                <option value="animalitos">Animalitos</option>
                <option value="hipismo">Hipismo</option>
                <option value="parley">Parley</option>
              </select>

              <select
                className="input"
                value={settlementFilter}
                onChange={(e) => setSettlementFilter(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="">Toda liquidación</option>
                <option value="pending">Pendiente</option>
                <option value="won">Ganador</option>
                <option value="lost">No ganador</option>
                <option value="review">En revisión</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(search || statusFilter || typeFilter || settlementFilter) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setTypeFilter('');
                  setSettlementFilter('');
                }}
              >
                Limpiar filtros
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadTickets}>
              Actualizar
            </button>
          </div>
        </div>

        {loading ? (
          <p className="empty">Cargando tickets de la agencia...</p>
        ) : tickets.length === 0 ? (
          <p className="empty">No se encontraron tickets con los filtros aplicados.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Juego</th>
                  <th>Taquilla</th>
                  <th>Monto</th>
                  <th>Premio Potencial</th>
                  <th>Estado</th>
                  <th>Emitido</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {t.code}
                      </strong>
                    </td>
                    <td>{TICKET_TYPE_LABELS[t.type] ?? t.type}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.taquilla?.name ?? '—'}</td>
                    <td>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatAmount(t.stake)}</strong>
                    </td>
                    <td>
                      <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                        {formatAmount(t.potential_payout)}
                      </strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                        <span className={ticketStatusClass(t.status)}>
                          {TICKET_STATUS_LABELS[t.status] ?? t.status}
                        </span>
                        {t.type === 'parley' && t.settlement_status && (
                          <span className={settlementStatusClass(t.settlement_status)}>
                            {settlementStatusLabel(t.settlement_status)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {formatTicketDate(t.created_at)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openDetail(t)}
                          title="Ver movimientos del ticket"
                        >
                          <Eye size={14} />
                          <span>Ver</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detalle con la línea de tiempo de movimientos */}
      {selectedTicket && (
        <div
          className="modal-overlay"
          style={{ zIndex: 100 }}
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '560px',
              width: '90%',
              margin: 'auto',
              position: 'relative',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  Movimientos del ticket {selectedTicket.code}
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedTicket(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Juego:</span>
              <strong>{TICKET_TYPE_LABELS[selectedTicket.type] ?? selectedTicket.type}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Monto apostado:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatAmount(selectedTicket.stake)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Premio potencial:</span>
              <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                {formatAmount(selectedTicket.potential_payout)}
              </strong>
            </div>

            {movementsLoading ? (
              <p className="empty">Cargando movimientos...</p>
            ) : movements.length === 0 ? (
              <p className="empty">Este ticket no tiene movimientos registrados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {movements.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      gap: '0.7rem',
                      alignItems: 'flex-start',
                      padding: '0.6rem 0.7rem',
                      background: 'var(--bg-surface-hover)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    <span style={{ color: '#38bdf8', marginTop: '0.15rem' }}>
                      <MovementIcon type={m.type} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                          {MOVEMENT_LABELS[m.type] ?? m.type}
                        </strong>
                        <span
                          style={{
                            color: 'var(--text-tertiary)',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Clock size={11} />
                          {formatTicketDate(m.created_at)}
                        </span>
                      </div>
                      {m.user?.name && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          Por {m.user.name}
                        </div>
                      )}
                      {m.notes && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          {m.notes}
                        </div>
                      )}
                      {m.amount !== null && m.amount !== undefined && (
                        <div style={{ fontSize: '0.8rem', color: '#34d399', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                          {formatAmount(m.amount)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
