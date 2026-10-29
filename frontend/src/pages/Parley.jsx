import { useEffect, useState } from 'react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { VENEZUELA_TIMEZONE } from '../utils/parley';

const STATUS_LABELS = {
  NS: 'Programado',
  TBD: 'Por definir',
  FT: 'Finalizado',
  AET: 'Finalizado',
  PEN: 'Finalizado',
  AOT: 'Finalizado',
  AP: 'Finalizado',
  PST: 'Pospuesto',
  CANC: 'Cancelado',
  ABD: 'Suspendido',
  SUSP: 'Suspendido',
  INT: 'Interrumpido',
  AWD: 'Adjudicado',
  WO: 'Walkover',
  LIVE: 'En vivo',
  1: 'Programado',
  2: 'En vivo',
  3: 'Finalizado',
};

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatTime(value) {
  if (!value) return '—';

  return new Date(value).toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VENEZUELA_TIMEZONE,
  });
}

function formatDateTime(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString('es-VE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: VENEZUELA_TIMEZONE,
  });
}

function statusLabel(status) {
  const short = String(status?.short ?? '').toUpperCase();

  return STATUS_LABELS[short] ?? status?.long ?? '—';
}

function statusClass(status) {
  const short = String(status?.short ?? '').toUpperCase();
  const long = String(status?.long ?? '').toLowerCase();

  if (
    ['FT', 'AET', 'PEN', 'AOT', 'AP', 'AWD', 'WO', '3'].includes(short) ||
    long.includes('finished') ||
    long.includes('final')
  ) {
    return 'status-finished';
  }

  if (
    ['NS', 'TBD', 'PST', 'CANC', 'ABD', 'SUSP', 'INT', '1'].includes(short) ||
    long.includes('not started') ||
    long.includes('scheduled') ||
    long.includes('postponed')
  ) {
    return 'status-pending';
  }

  return 'status-live';
}

function eventScore(event) {
  if (event.score?.home === null || event.score?.home === undefined) {
    return '—';
  }

  return `${event.score.home} - ${event.score.away ?? 0}`;
}

export default function Parley() {
  const [sports, setSports] = useState([]);
  const [sport, setSport] = useState('football');
  const [date, setDate] = useState(todayISO());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('');
  const [apiStatus, setApiStatus] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [odds, setOdds] = useState(null);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [oddsError, setOddsError] = useState(null);

  const currentSport = sports.find((item) => item.key === sport);

  const loadStatus = async () => {
    try {
      const response = await api.get('/admin/parley/status');
      setApiStatus(response.data.data);
    } catch {
      setApiStatus(null);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/admin/parley/events', {
        params: { sport, date },
      });

      setEvents(response.data.data);
    } catch (err) {
      setEvents([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api
      .get('/admin/parley/sports')
      .then((response) => setSports(response.data.data))
      .catch((err) => setError(getErrorMessage(err)));

    loadStatus();
  }, []);

  useEffect(() => {
    setSearch('');
    setLeagueFilter('');
  }, [sport, date]);

  useEffect(() => {
    if (sport && date) {
      loadEvents();
    }
  }, [sport, date]);

  const leagues = [...new Set(events.map((event) => event.league?.name).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );

  const filteredEvents = events.filter((event) => {
    if (leagueFilter && event.league?.name !== leagueFilter) {
      return false;
    }

    const query = search.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [event.home?.name, event.away?.name, event.league?.name, event.league?.country]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });

  const openOdds = async (event) => {
    setSelectedEvent(event);
    setOdds(null);
    setOddsError(null);
    setOddsLoading(true);

    try {
      const response = await api.get(
        `/admin/parley/events/${sport}/${event.id}/odds`,
      );

      setOdds(response.data.data);
    } catch (err) {
      setOddsError(getErrorMessage(err));
    } finally {
      setOddsLoading(false);
    }
  };

  const closeOdds = () => {
    setSelectedEvent(null);
    setOdds(null);
    setOddsError(null);
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Parley deportivo</h1>
          <p className="empty" style={{ padding: '0.25rem 0 0' }}>
            Eventos y cuotas desde la API deportiva. Horarios en tu hora local.
            {apiStatus && (
              <>
                {' '}
                Plan {apiStatus.plan ?? '—'} · consultas {apiStatus.requests_current ?? '?'}/
                {apiStatus.requests_limit ?? '?'}.
              </>
            )}
          </p>
        </div>

        <button className="btn btn-secondary" onClick={() => { loadEvents(); loadStatus(); }}>
          Actualizar
        </button>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="alert alert-info">
        Las consultas a la API se guardan en caché durante unos minutos para cuidar el
        límite diario del plan.
      </div>

      <section className="card">
        <div className="sport-tabs">
          {sports.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sport-tab${sport === item.key ? ' active' : ''}`}
              onClick={() => setSport(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="form-row" style={{ marginTop: '1rem' }}>
          <div className="form-field" style={{ maxWidth: '200px' }}>
            <label htmlFor="parley-date">Fecha</label>
            <input
              id="parley-date"
              className="input"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="parley-search">Buscar equipo o liga</label>
            <input
              id="parley-search"
              className="input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ej: Real Madrid, NBA..."
            />
          </div>

          <div className="form-field" style={{ maxWidth: '300px' }}>
            <label htmlFor="parley-league">Liga</label>
            <select
              id="parley-league"
              className="input"
              value={leagueFilter}
              onChange={(event) => setLeagueFilter(event.target.value)}
            >
              <option value="">Todas las ligas</option>
              {leagues.map((league) => (
                <option key={league} value={league}>
                  {league}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">
          {loading
            ? 'Consultando eventos...'
            : `${filteredEvents.length} eventos${
                filteredEvents.length !== events.length ? ` de ${events.length}` : ''
              }`}
        </h2>

        {loading ? (
          <p className="empty">Cargando eventos...</p>
        ) : events.length === 0 ? (
          <p className="empty">No hay eventos disponibles para esa fecha.</p>
        ) : filteredEvents.length === 0 ? (
          <p className="empty">No hay eventos que coincidan con la búsqueda.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Liga</th>
                  <th>Local</th>
                  <th>Visitante</th>
                  <th>Estado</th>
                  <th>Marcador</th>
                  <th>Cuotas</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={`${event.league?.id}-${event.id}`}>
                    <td>{formatTime(event.starts_at)}</td>
                    <td>
                      <div className="team-cell">
                        {event.league?.logo && (
                          <img
                            className="league-logo"
                            src={event.league.logo}
                            alt=""
                            loading="lazy"
                          />
                        )}
                        <span>
                          {event.league?.name ?? '—'}
                          {event.league?.country && <small> · {event.league.country}</small>}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="team-cell">
                        {event.home?.logo && (
                          <img
                            className="team-logo"
                            src={event.home.logo}
                            alt=""
                            loading="lazy"
                          />
                        )}
                        <span>{event.home?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="team-cell">
                        {event.away?.logo && (
                          <img
                            className="team-logo"
                            src={event.away.logo}
                            alt=""
                            loading="lazy"
                          />
                        )}
                        <span>{event.away?.name ?? '—'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={statusClass(event.status)}>
                        {statusLabel(event.status)}
                      </span>
                    </td>
                    <td>{eventScore(event)}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openOdds(event)}
                        disabled={!currentSport?.has_odds}
                      >
                        {currentSport?.has_odds ? 'Ver cuotas' : 'Sin cuotas'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedEvent && (
        <div className="modal-overlay" onClick={closeOdds}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {selectedEvent.home?.name} vs {selectedEvent.away?.name}
                </h2>
                <p className="empty" style={{ padding: '0.2rem 0 0' }}>
                  {selectedEvent.league?.name} · {formatDateTime(selectedEvent.starts_at)}
                </p>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={closeOdds}>
                Cerrar
              </button>
            </div>

            {oddsLoading && <p className="empty">Consultando cuotas...</p>}

            {oddsError && <div className="alert alert-error">{oddsError}</div>}

            {!oddsLoading && odds && !odds.available && (
              <div className="alert alert-info">{odds.message}</div>
            )}

            {!oddsLoading && odds?.available && (
              <>
                <p className="empty" style={{ padding: '0 0 0.75rem' }}>
                  Casa de apuestas: <strong>{odds.bookmaker?.name}</strong>
                  {odds.updated_at && ` · Actualizado: ${formatDateTime(odds.updated_at)}`}
                </p>

                <div className="market-list">
                  {odds.markets.map((market) => (
                    <div className="market" key={`${market.id}-${market.name}`}>
                      <p className="market-name">{market.name}</p>
                      <div className="market-selections">
                        {market.selections.map((selection) => (
                          <span
                            className="selection"
                            key={`${market.name}-${selection.label}-${selection.odd}`}
                          >
                            <span>{selection.label}</span>
                            <strong>{Number(selection.odd).toFixed(2)}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
