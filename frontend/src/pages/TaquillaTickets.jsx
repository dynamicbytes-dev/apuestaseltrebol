import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Receipt,
  Search,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Printer,
  Clock,
  DollarSign,
  X,
  Filter,
} from 'lucide-react';
import api from '../api/client';
import { printTicket } from '../utils/print';
import { getErrorMessage } from '../utils/errors';
import {
  TICKET_TYPE_LABELS,
  MOVEMENT_LABELS,
  ticketSingleStatus,
  settlementStatusLabel,
  settlementStatusClass,
  canPayTicket,
  formatAmount,
  formatTicketDate,
  formatDrawTime,
  canCancelTicket,
  getCancelMinutesRemaining,
} from '../utils/tickets';
import { formatTime, resolveBetTeam } from '../utils/parley';

export default function TaquillaTickets() {
  const user = JSON.parse(localStorage.getItem('user') ?? '{}');
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [settlement, setSettlement] = useState(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const loadMovements = useCallback(async (ticketId) => {
    setMovementsLoading(true);
    try {
      const res = await api.get(`/taquilla/tickets/${ticketId}/movements`);
      setMovements(res.data.data);
    } catch {
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  }, []);

  // Vista previa de la liquidación: dice si el ticket se puede pagar y por
  // cuánto, sin cobrar nada.
  const loadSettlement = useCallback(async (ticketId) => {
    setSettlementLoading(true);
    try {
      const res = await api.get(`/taquilla/tickets/${ticketId}/settlement`);
      const data = res.data.data;

      setSettlement(data);

      // La liquidación se calcula en el servidor: la fila de la tabla se
      // actualiza con el resultado real para que no diga "pendiente".
      setTickets((prev) => prev.map((t) => (
        t.id === ticketId
          ? { ...t, settlement_status: data.status, settlement_note: data.note }
          : t
      )));
    } catch {
      setSettlement(null);
    } finally {
      setSettlementLoading(false);
    }
  }, []);

  const openDetail = (ticket) => {
    setSelectedTicket(ticket);
    setMovements([]);
    setSettlement(null);
    loadMovements(ticket.id);
    loadSettlement(ticket.id);
  };

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/taquilla/tickets', {
        params: {
          status: statusFilter || undefined,
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
  }, [statusFilter, search]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handlePay = async (ticket) => {
    setError(null);
    setSuccess(null);

    if (ticket.status !== 'pending') {
      setError('Solo se pueden pagar tickets en estado pendiente.');
      return;
    }

    if (!canPayTicket(ticket)) {
      setError(
        ticket.settlement_status === 'lost'
          ? `El ticket ${ticket.code} no es ganador y no se puede pagar.`
          : `El ticket ${ticket.code} requiere validación del supervisor antes de pagarse.`
      );
      return;
    }

    const amount = Number(settlement?.payable ?? ticket.potential_payout);
    if (!window.confirm(`¿Confirmar pago del ticket ${ticket.code} por ${formatAmount(amount)}?`)) {
      return;
    }

    setProcessingId(ticket.id);
    try {
      const response = await api.post(`/taquilla/tickets/${ticket.id}/pay`, {
        paid_amount: amount,
        notes: 'Pago validado en taquilla',
      });
      const updated = response.data.data;
      setSuccess(`✅ ¡Ticket ${updated.code} pagado con éxito! Monto entregado: ${formatAmount(updated.paid_amount || amount)}.`);
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket(updated);
        loadSettlement(ticket.id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (ticket) => {
    setError(null);
    setSuccess(null);

    if (ticket.status !== 'pending') {
      setError('Solo se pueden anular tickets en estado pendiente.');
      return;
    }

    if (!canCancelTicket(ticket)) {
      setError(`No es posible anular el ticket ${ticket.code}. Han transcurrido más de 5 minutos desde su emisión.`);
      return;
    }

    if (!window.confirm(`¿Estás seguro de anular el ticket ${ticket.code}? Esta acción es irreversible.`)) {
      return;
    }

    setProcessingId(ticket.id);
    try {
      const response = await api.post(`/taquilla/tickets/${ticket.id}/cancel`);
      const updated = response.data.data;
      setSuccess(`Ticket ${updated.code} anulado correctamente.`);
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)));
      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket(updated);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <span>Control de Tickets</span>
            <span className="page-title-badge">Taquilla</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            Consulta de jugadas, validación automática de ganadores y pago de premios.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link className="btn btn-primary" to="/taquilla/nueva">
            <PlusCircle size={18} />
            <span>Nueva Apuesta</span>
          </Link>
        </div>
      </header>

      {error && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      )}

      <section className="card">
        {/* Barra de Filtros y Búsqueda */}
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
            <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '380px' }}>
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
                <option value="pending">Solo Pendientes</option>
                <option value="paid">Solo Pagados</option>
                <option value="cancelled">Solo Anulados</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(search || statusFilter) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
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

        {/* Tabla de Tickets */}
        {loading ? (
          <p className="empty">Cargando tickets de taquilla...</p>
        ) : tickets.length === 0 ? (
          <p className="empty">
            {search || statusFilter
              ? 'No se encontraron tickets con los filtros aplicados.'
              : 'Aún no hay tickets emitidos en esta taquilla.'}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Código de Ticket</th>
                  <th>Juego</th>
                  <th>Monto Apostado</th>
                  <th>Premio Potencial</th>
                  <th>Estado</th>
                  <th>Fecha y Hora</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const isProcessing = processingId === t.id;
                  return (
                    <tr key={t.id}>
                      <td>
                        <strong
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-primary)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {t.code}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>
                          {TICKET_TYPE_LABELS[t.type] ?? t.type}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatAmount(t.stake)}
                        </strong>
                      </td>
                      <td>
                        <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                          {formatAmount(t.potential_payout)}
                        </strong>
                      </td>
                      <td>
                        <span className={ticketSingleStatus(t).className}>
                          {ticketSingleStatus(t).label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {formatTicketDate(t.created_at)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openDetail(t)}
                            title="Ver detalle del ticket"
                          >
                            <Eye size={14} />
                            <span>Ver</span>
                          </button>

                          {t.status === 'pending' && (
                            <>
                              {canPayTicket(t) ? (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handlePay(t)}
                                  disabled={isProcessing}
                                  title="Pagar premio"
                                  style={{ background: '#059669', borderColor: '#059669' }}
                                >
                                  <DollarSign size={14} />
                                  <span>{isProcessing ? 'Validando...' : 'Pagar'}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled
                                  style={{ opacity: 0.45, cursor: 'not-allowed' }}
                                  title={
                                    t.settlement_status === 'lost'
                                      ? 'El ticket no es ganador: no se puede pagar'
                                      : 'El ticket requiere validación del supervisor'
                                  }
                                >
                                  <DollarSign size={14} />
                                  <span>No paga</span>
                                </button>
                              )}

                              {canCancelTicket(t) ? (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleCancel(t)}
                                  disabled={isProcessing}
                                  title={`Anular ticket (${getCancelMinutesRemaining(t)} min restantes)`}
                                >
                                  <XCircle size={14} />
                                  <span>Anular</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled
                                  style={{ opacity: 0.45, cursor: 'not-allowed' }}
                                  title="No se puede anular: han transcurrido más de 5 minutos desde su emisión"
                                >
                                  <XCircle size={14} />
                                  <span>+5m</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal de Detalle / Comprobante de Ticket */}
      {selectedTicket && (
        <div
          className="modal-overlay"
          style={{ zIndex: 100 }}
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '90%',
              margin: 'auto',
              position: 'relative',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
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
                <Receipt size={20} color="#34d399" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  Comprobante de Ticket
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedTicket(null)}
                style={{ padding: '0.2rem 0.5rem' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Ficha tipo ticket de taquilla */}
            <div
              id="printable-ticket"
              style={{
                background: 'var(--bg-canvas)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border-medium)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                <strong style={{ fontSize: '1.2rem', display: 'block', color: 'var(--text-primary)', letterSpacing: '1px' }}>
                  EL TRÉBOL
                </strong>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                  Agencia: {selectedTicket.agency?.name || user.agency?.name || 'Agencia Oficial'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Taquilla: {selectedTicket.taquilla?.name || user.name || 'Taquilla 1'}
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', margin: '0.5rem 0', letterSpacing: '2px' }}>
                  N° {selectedTicket.code}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                  {formatTicketDate(selectedTicket.created_at)}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Modalidad:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {TICKET_TYPE_LABELS[selectedTicket.type] ?? selectedTicket.type}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Estado:</span>
                <span className={ticketSingleStatus(selectedTicket).className}>
                  {ticketSingleStatus(selectedTicket).label}
                </span>
              </div>

              {selectedTicket.sorteo_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Sorteo:</span>
                  <strong>{formatDrawTime(selectedTicket.sorteo_at)}</strong>
                </div>
              )}

              {selectedTicket.settlement_status && selectedTicket.settlement_status !== 'pending' && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Resultado de la jugada:</span>
                  <span className={settlementStatusClass(selectedTicket.settlement_status)}>
                    {settlementStatusLabel(selectedTicket.settlement_status)}
                  </span>
                </div>
              )}

              {selectedTicket.settlement_note && (
                <div className="alert alert-info" style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                  {selectedTicket.settlement_note}
                </div>
              )}

              {/* Detalle de Selecciones / Jugadas */}
              <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.75rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.4rem', fontWeight: 700 }}>
                  JUGADAS REGISTRADAS:
                </span>
                {selectedTicket.selections?.map((sel, idx) => {
                  const league = sel.metadata?.league || sel.league;
                  const gameTime = sel.metadata?.starts_at || sel.starts_at || sel.metadata?.race_date;
                  const betTeam = sel.metadata?.team || sel.team || resolveBetTeam(sel.selection_label, sel.metadata?.home, sel.metadata?.away);
                  const isParley = selectedTicket.type === 'parley';
                  const isHipismo = selectedTicket.type === 'hipismo';

                  return (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-surface-hover)',
                        padding: '0.55rem 0.7rem',
                        borderRadius: 'var(--radius-xs)',
                        marginBottom: '0.45rem',
                        fontSize: '0.82rem',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginBottom: '0.15rem' }}>
                        <span>🏆 Liga: {league || (isHipismo ? (sel.metadata?.meeting || 'Hipismo') : (sel.metadata?.lottery || 'Lotería'))}</span>
                        {gameTime && <span>⏰ Hora: {formatTime(gameTime)}</span>}
                      </div>
                      {sel.event_name && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                          {sel.event_name}
                        </div>
                      )}
                      <div
                        style={{
                          margin: '0.25rem 0',
                          padding: '0.35rem 0.55rem',
                          background: 'rgba(56, 189, 248, 0.08)',
                          borderRadius: '4px',
                          borderLeft: '3px solid #38bdf8',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {isParley ? '⚽ Equipo Apostado:' : isHipismo ? '🏇 Ejemplar Apostado:' : '🐾 Jugada Apostada:'}
                          </span>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {betTeam || sel.selection_label}
                          </strong>
                        </div>
                        <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>
                          x{Number(sel.odd).toFixed(2)}
                        </strong>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        {sel.amount !== null && sel.amount !== undefined ? (
                          <>
                            Monto: <strong style={{ color: 'var(--text-primary)' }}>{formatAmount(sel.amount)}</strong>
                          </>
                        ) : (
                          <>Mercado: <strong style={{ color: 'var(--text-primary)' }}>{sel.market || 'Ganador'}</strong></>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resultado de la liquidación */}
              {settlementLoading ? (
                <p className="empty" style={{ margin: 0 }}>Validando resultado oficial...</p>
              ) : settlement ? (
                <div
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '0.6rem 0.7rem',
                    marginBottom: '0.75rem',
                    background: 'var(--bg-surface-hover)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Estado de la jugada:</span>
                    <span className={settlementStatusClass(settlement.status)}>
                      {settlementStatusLabel(settlement.status)}
                    </span>
                  </div>

                  {settlement.legs?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.45rem' }}>
                      {settlement.legs.map((leg) => (
                        <div
                          key={leg.selection_id}
                          style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}
                        >
                          <span style={{ color: leg.status === 'won' ? '#34d399' : 'var(--text-tertiary)' }}>
                            {leg.status === 'won' ? '✓' : '✕'} {leg.label}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {formatAmount(leg.amount)}
                            {leg.payout > 0 ? ` → ${formatAmount(leg.payout)}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '1px dashed var(--border-subtle)',
                      paddingTop: '0.4rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>Monto a pagar:</span>
                    <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                      {formatAmount(settlement.payable)}
                    </strong>
                  </div>

                  {settlement.note && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                      {settlement.note}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Totales */}
              <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Monto Apostado:</span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {formatAmount(selectedTicket.stake)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Premio a Pagar:</span>
                  <strong style={{ fontSize: '1.1rem', color: '#34d399' }}>
                    {formatAmount(selectedTicket.potential_payout)}
                  </strong>
                </div>
                {selectedTicket.paid_at && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#86efac', marginTop: '0.5rem' }}>
                    <span>Pagado en fecha:</span>
                    <span>{formatTicketDate(selectedTicket.paid_at)}</span>
                  </div>
                )}
              </div>

              {/* Historial de movimientos: solo en pantalla, no cabe en un
                  recibo de papel de la impresora termica. */}
              <div
                data-print="hide"
                style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.75rem', marginTop: '0.75rem' }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.4rem', fontWeight: 700 }}>
                  MOVIMIENTOS:
                </span>
                {movementsLoading ? (
                  <p className="empty" style={{ margin: 0 }}>Cargando movimientos...</p>
                ) : movements.length === 0 ? (
                  <p className="empty" style={{ margin: 0 }}>Sin movimientos registrados.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {movements.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          fontSize: '0.78rem',
                          padding: '0.35rem 0.5rem',
                          background: 'var(--bg-surface-hover)',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span style={{ color: 'var(--text-primary)' }}>
                          {MOVEMENT_LABELS[m.type] ?? m.type}
                        </span>
                        <span style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                          {formatTicketDate(m.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Acciones en Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => printTicket()}
              >
                <Printer size={16} />
                <span>Imprimir</span>
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selectedTicket.status === 'pending' && (
                  <>
                    {settlement?.status === 'won' || (!settlement && canPayTicket(selectedTicket)) ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handlePay(selectedTicket)}
                        style={{ background: '#059669', borderColor: '#059669' }}
                      >
                        <DollarSign size={16} />
                        <span>Validar y Pagar</span>
                      </button>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-tertiary)',
                          alignSelf: 'center',
                          padding: '0.25rem 0.6rem',
                          background: 'var(--bg-input)',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {settlement?.status === 'lost'
                          ? 'No se puede pagar: el ticket no es ganador'
                          : settlement?.status === 'review'
                            ? 'No se puede pagar: requiere validación del supervisor'
                            : 'No se puede pagar: aún no hay resultado oficial'}
                      </span>
                    )}
                    {canCancelTicket(selectedTicket) ? (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleCancel(selectedTicket)}
                        disabled={processingId === selectedTicket.id}
                      >
                        <XCircle size={15} />
                        <span>Anular ({getCancelMinutesRemaining(selectedTicket)}m restantes)</span>
                      </button>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-tertiary)',
                          alignSelf: 'center',
                          padding: '0.25rem 0.6rem',
                          background: 'var(--bg-input)',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        Anulación no disponible (&gt; 5 min)
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}