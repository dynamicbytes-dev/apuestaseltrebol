import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CalendarDays,
  AlertCircle,
  Filter,
  Search,
  Trophy,
  Flame,
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { todayISO, VENEZUELA_TIMEZONE } from '../utils/parley';

const SPORTS = [
  { key: 'football', label: 'Fútbol', icon: '⚽' },
  { key: 'baseball', label: 'Béisbol', icon: '⚾' },
  { key: 'basketball', label: 'Baloncesto', icon: '🏀' },
  { key: 'hockey', label: 'Hockey', icon: '🏒' },
  { key: 'nba', label: 'NBA', icon: '🏆' },
];

const TIPOS = [
  { key: '', label: 'Todas' },
  { key: 'parley', label: 'Parley deportivo' },
  { key: 'hipismo', label: 'Hipismo' },
  { key: 'animalitos', label: 'Animalitos' },
];

// Los estados dependen de la modalidad: el proveedor usa codigos propios
// (NS, LIVE, FT), el hipismo y los animalitos los tienen propios.
const STATUS_POR_TIPO = {
  parley: [
    { value: '', label: 'Todos' },
    { value: 'NS', label: 'Programado' },
    { value: 'LIVE', label: 'En vivo' },
    { value: 'FT', label: 'Finalizado' },
  ],
  hipismo: [
    { value: '', label: 'Todos' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'finished', label: 'Finalizado' },
  ],
  animalitos: [
    { value: '', label: 'Todos' },
    { value: 'resolved', label: 'Con resultado' },
    { value: 'unresolved', label: 'Sin resultado' },
  ],
};

function formatFechaHora(value) {
  if (!value) return '—';

  const d = new Date(value);

  return `${d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    timeZone: VENEZUELA_TIMEZONE,
  })} ${d.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VENEZUELA_TIMEZONE,
  })}`;
}

export default function Cartelera() {
  const user = JSON.parse(localStorage.getItem('user') ?? '{}');
  const isAdmin = user.role === 'administrador';

  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [tipo, setTipo] = useState('');
  const [sport, setSport] = useState('');
  const [league, setLeague] = useState('');
  const [status, setStatus] = useState('');
  const [lotteryId, setLotteryId] = useState('');
  const [meeting, setMeeting] = useState('');
  const [search, setSearch] = useState('');

  const [data, setData] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [reuniones, setReuniones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Modalidad que se está mostrando. Un filtro que solo aplica a una
  // modalidad acota la cartelera a esa: elegir una loteria muestra sus
  // sorteos, no los partidos de parley.
  const effectiveType = useMemo(() => {
    if (tipo) return tipo;
    if (lotteryId) return 'animalitos';
    if (sport || league) return 'parley';
    if (meeting) return 'hipismo';

    const s = status.toLowerCase();
    if (['pending', 'finished'].includes(s)) return 'hipismo';
    if (['resolved', 'unresolved'].includes(s)) return 'animalitos';
    if (s !== '') return 'parley';

    return '';
  }, [tipo, lotteryId, sport, league, meeting, status]);

  // Cada modalidad muestra solo los filtros que le son propios: el deporte
  // y la liga son del parley, la reunion es del hipismo y la loteria es de
  // los animalitos.
  const showParley = tipo === '' || tipo === 'parley';
  const showHipismo = tipo === '' || tipo === 'hipismo';
  const showAnimalitos = tipo === '' || tipo === 'animalitos';

  const statusOptions = STATUS_POR_TIPO[effectiveType] ?? STATUS_POR_TIPO.parley;

  // Si el estado elegido ya no aplica a la modalidad, se limpia.
  useEffect(() => {
    if (status && !statusOptions.some((o) => o.value === status)) {
      setStatus('');
    }
  }, [statusOptions, status]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/results', {
        params: {
          from: from || undefined,
          to: to || undefined,
          type: tipo || undefined,
          sport: sport || undefined,
          league: league || undefined,
          status: status || undefined,
          lottery_id: lotteryId || undefined,
          meeting: meeting || undefined,
          search: search.trim() || undefined,
        },
      });
      setData(res.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [from, to, tipo, sport, league, status, lotteryId, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Las ligas dependen del deporte y de la fecha.
  useEffect(() => {
    if (!sport) {
      setLeagues([]);
      return;
    }

    let active = true;

    api
      .get('/results/leagues', { params: { sport, date: from } })
      .then((res) => {
        if (active) setLeagues(res.data.data);
      })
      .catch(() => {
        if (active) setLeagues([]);
      });

    return () => {
      active = false;
    };
  }, [sport, from]);

  useEffect(() => {
    api
      .get('/results/lotteries')
      .then((res) => setLotteries(res.data.data))
      .catch(() => setLotteries([]));
  }, []);

  useEffect(() => {
    api
      .get('/results/reuniones')
      .then((res) => setReuniones(res.data.data))
      .catch(() => setReuniones([]));
  }, []);

  const startEdit = (event) => {
    setEditing(event);
    setEditValue(event.starts_at ? new Date(event.starts_at).toISOString().slice(0, 16) : '');
  };

  const saveEdit = async () => {
    if (!editing) return;

    setSaving(true);

    try {
      await api.put(`/admin/parley/events/${editing.sport}/${editing.id}/schedule`, {
        starts_at: new Date(editValue).toISOString(),
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeEdit = async (event) => {
    try {
      await api.delete(`/admin/parley/events/${event.sport}/${event.id}/schedule`);
      setEditing(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const counts = data?.counts ?? {};

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <span>Cartelera de Resultados</span>
            <span className="page-title-badge">Resultados</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            Todos los resultados: parley, hipismo y animalitos.
          </p>
        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCw size={14} />
          <span>Actualizar</span>
        </button>
      </header>

      {error && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {(data?.warnings ?? []).length > 0 && (
        <div className="alert alert-info" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>
            El proveedor de resultados limita las peticiones por minuto, así que algunos
            deportes no se pudieron consultar en esta carga:
            <br />
            {data.warnings.map((w) => (
              <span key={w} style={{ display: 'block', fontSize: '0.8rem' }}>· {w}</span>
            ))}
          </span>
        </div>
      )}

      {/* FILTROS */}
      <section
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem',
          background: 'var(--bg-input)',
          marginBottom: '1.25rem',
        }}
      >
        {/* Primera fila: tipo de apuesta (siempre primero), fechas y busqueda */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.1rem',
            alignItems: 'end',
          }}
        >
          <div className="form-field" style={{ margin: 0 }}>
            <label htmlFor="cb-type">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Filter size={14} color="#34d399" />
                <strong>Tipo de apuesta</strong>
              </span>
            </label>
            <select
              id="cb-type"
              className="input"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                setSport('');
                setLeague('');
                setLotteryId('');
                setMeeting('');
              }}
            >
              {TIPOS.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label htmlFor="cb-from">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CalendarDays size={14} color="#38bdf8" />
                <strong>Desde</strong>
              </span>
            </label>
            <input id="cb-from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label htmlFor="cb-to">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CalendarDays size={14} color="#38bdf8" />
                <strong>Hasta</strong>
              </span>
            </label>
            <input id="cb-to" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label htmlFor="cb-search">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Search size={14} color="#94a3b8" />
                <strong>Buscar</strong>
              </span>
            </label>
            <input id="cb-search" className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Equipo, carrera o animalito" />
          </div>
        </div>

        {/* Segunda fila: los filtros que aplican a la modalidad elegida */}
        {(showParley || showHipismo || showAnimalitos) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.1rem',
              alignItems: 'end',
              paddingTop: '1rem',
              borderTop: '1px dashed var(--border-subtle)',
            }}
          >
            {showParley && (
              <>
                <div className="form-field" style={{ margin: 0 }}>
                  <label htmlFor="cb-sport">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Trophy size={14} color="#f59e0b" />
                      <strong>Deporte</strong>
                    </span>
                  </label>
                  <select id="cb-sport" className="input" value={sport} onChange={(e) => { setSport(e.target.value); setLeague(''); }}>
                    <option value="">Todos</option>
                    {SPORTS.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field" style={{ margin: 0 }}>
                  <label htmlFor="cb-league">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Trophy size={14} color="#f59e0b" />
                      <strong>Liga</strong>
                    </span>
                  </label>
                  <select id="cb-league" className="input" value={league} onChange={(e) => setLeague(e.target.value)} disabled={!sport}>
                    <option value="">{sport ? 'Todas' : 'Elige un deporte'}</option>
                    {leagues.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {showHipismo && (
              <div className="form-field" style={{ margin: 0 }}>
                <label htmlFor="cb-meeting">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Flame size={14} color="#38bdf8" />
                    <strong>Reunión</strong>
                  </span>
                </label>
                <select id="cb-meeting" className="input" value={meeting} onChange={(e) => setMeeting(e.target.value)}>
                  <option value="">Todas</option>
                  {reuniones.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}

            {showAnimalitos && (
              <div className="form-field" style={{ margin: 0 }}>
                <label htmlFor="cb-lottery">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Sparkles size={14} color="#a78bfa" />
                    <strong>Lotería</strong>
                  </span>
                </label>
                <select id="cb-lottery" className="input" value={lotteryId} onChange={(e) => setLotteryId(e.target.value)}>
                  <option value="">Todas</option>
                  {lotteries.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-field" style={{ margin: 0 }}>
              <label htmlFor="cb-status">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={14} color="#34d399" />
                  <strong>Estado</strong>
                </span>
              </label>
              <select id="cb-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      {loading ? (
        <p className="empty">Cargando cartelera...</p>
      ) : !data ? (
        <p className="empty">No hay datos para mostrar.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.85rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Periodo: <strong style={{ color: 'var(--text-primary)' }}>{data.period.from} → {data.period.to}</strong>
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Parley: <strong style={{ color: 'var(--palette-cashout)' }}>{counts.parley ?? 0}</strong>
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Hipismo: <strong style={{ color: 'var(--accent-sky)' }}>{counts.hipismo ?? 0}</strong>
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Animalitos: <strong style={{ color: 'var(--primary)' }}>{counts.animalitos ?? 0}</strong>
            </span>
            {effectiveType && (
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid var(--accent-sky)',
                  color: 'var(--accent-sky)',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                {TIPOS.find((t) => t.key === effectiveType)?.label ?? effectiveType}
              </span>
            )}
          </div>

          {/* PARLEY */}
          {(data.parley ?? []).length > 0 && (
            <section className="card" style={{ marginBottom: '1.25rem' }}>
              <h2 className="card-title">
                <span className="card-title-label">
                  <Trophy size={16} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
                  Parley Deportivo
                </span>
              </h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Deporte</th>
                      <th>Liga</th>
                      <th>Partido</th>
                      <th>Resultado</th>
                      <th>Estado</th>
                      {isAdmin && <th style={{ textAlign: 'right' }}>Acción</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.parley.map((ev) => (
                      <tr key={`${ev.sport}-${ev.id}`}>
                        <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                          {formatFechaHora(ev.starts_at)}
                          {ev.schedule_corrected && (
                            <div style={{ fontSize: '0.68rem', color: '#f59e0b', marginTop: '0.15rem' }}>
                              corregido (proveedor: {formatFechaHora(ev.original_starts_at)})
                            </div>
                          )}
                        </td>
                        <td>{SPORTS.find((s) => s.key === ev.sport)?.icon ?? ''} {SPORTS.find((s) => s.key === ev.sport)?.label ?? ev.sport}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{ev.league ?? '—'}</td>
                        <td><strong>{ev.home}</strong> vs <strong>{ev.away}</strong></td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {ev.score_home !== null && ev.score_home !== undefined
                            ? `${ev.score_home} - ${ev.score_away}`
                            : '—'}
                        </td>
                        <td>
                          <span className={ev.status === 'FT' || ev.status === 'finished' ? 'status-finished' : ev.status === 'LIVE' ? 'status-live' : 'status-pending'}>
                            {ev.status_text || ev.status || '—'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => startEdit(ev)}
                              title="Corregir la fecha del partido"
                            >
                              <Pencil size={13} />
                              <span>Fecha</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* HIPISMO */}
          {(data.hipismo ?? []).length > 0 && (
            <section className="card" style={{ marginBottom: '1.25rem' }}>
              <h2 className="card-title">
                <span className="card-title-label">
                  <Flame size={16} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
                  Hipismo
                </span>
              </h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha y Hora</th>
                      <th>Carrera</th>
                      <th>Reunión</th>
                      <th>Hipódromo</th>
                      <th>Ganador</th>
                      <th>Ejemplares</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hipismo.map((race) => (
                      <tr key={race.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatFechaHora(race.race_date)}</td>
                        <td><strong>{race.name}</strong></td>
                        <td style={{ color: 'var(--text-secondary)' }}>{race.meeting ?? '—'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{race.track ?? '—'}</td>
                        <td style={{ color: 'var(--emerald-500)', fontWeight: 600 }}>{race.winner ?? '—'}</td>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                          {race.horses.length} ejemplares
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ANIMALITOS */}
          {(data.animalitos ?? []).length > 0 && (
            <section className="card">
              <h2 className="card-title">
                <span className="card-title-label">
                  <Sparkles size={16} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
                  Animalitos
                </span>
              </h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha y Hora</th>
                      <th>Lotería</th>
                      <th>Número</th>
                      <th>Animalito</th>
                      <th>Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.animalitos.map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                          <Clock size={11} style={{ verticalAlign: '-1px', marginRight: '0.25rem' }} />
                          {formatFechaHora(s.sorteo_at)}
                        </td>
                        <td><strong>{s.lottery ?? '—'}</strong></td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>N° {s.number}</td>
                        <td>{s.animal ?? '—'}</td>
                        <td>
                          <span className={s.is_resolved ? 'status-finished' : 'status-pending'}>
                            {s.is_resolved ? (s.is_manual ? 'Manual' : 'Automático') : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {(data.parley ?? []).length === 0 &&
            (data.hipismo ?? []).length === 0 &&
            (data.animalitos ?? []).length === 0 && (
              <p className="empty">No hay juegos en el periodo y los filtros seleccionados.</p>
            )}
        </>
      )}

      {/* MODAL CORRECCION DE FECHA */}
      {editing && (
        <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => setEditing(null)}>
          <div
            className="card"
            style={{
              maxWidth: '460px',
              width: '90%',
              margin: 'auto',
              position: 'relative',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              Corregir fecha del partido
            </h3>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
              <strong>{editing.home}</strong> vs <strong>{editing.away}</strong>
              <br />
              Fecha del proveedor: {formatFechaHora(editing.starts_at)}
            </p>

            <div className="form-field">
              <label htmlFor="cb-edit-date">Fecha y hora correctas (hora de Caracas)</label>
              <input
                id="cb-edit-date"
                className="input"
                type="datetime-local"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '0.6rem 0 0' }}>
              La corrección se aplica en todas partes: cartelera, apuestas y liquidación.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
              {editing.schedule_corrected && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeEdit(editing)}
                  disabled={saving}
                >
                  Quitar corrección
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={saveEdit}
                disabled={saving || !editValue}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
