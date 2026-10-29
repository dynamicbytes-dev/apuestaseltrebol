import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PlusCircle,
  Receipt,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Printer,
  Sparkles,
  Flame,
  Gamepad2,
  X,
  Search,
  Filter,
  Calendar,
} from 'lucide-react';
import api from '../api/client';
import { printTicket } from '../utils/print';
import { getErrorMessage } from '../utils/errors';
import {
  TICKET_TYPE_LABELS,
  formatAmount,
  formatTicketDate,
  formatDrawTime,
} from '../utils/tickets';
import {
  todayISO,
  shiftDateISO,
  formatTime,
  statusClass,
  statusLabel,
  eventScore,
  resolveBetTeam,
  isNotStarted,
} from '../utils/parley';
import { isDrawPast, isDrawClosed, formatDrawLabel } from '../utils/draws';

function formatLimit(value) {
  if (value === null || value === undefined || value === '') {
    return 'Sin límite';
  }
  return formatAmount(value);
}

export default function NuevaApuesta() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tipo') || 'animalitos';
  const user = JSON.parse(localStorage.getItem('user') ?? '{}');

  const [catalog, setCatalog] = useState(null);
  const [sports, setSports] = useState([]);
  const [type, setTypeState] = useState(currentTab);

  const setType = (newType) => {
    setTypeState(newType);
    setSearchParams({ tipo: newType }, { replace: true });
  };
  const [stake, setStake] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastCreatedTicket, setLastCreatedTicket] = useState(null);

  // Animalitos state
  const [lotteryId, setLotteryId] = useState('');
  const [selectedLottery, setSelectedLottery] = useState(null);
  // Sorteo al que se apuesta: la fecha y la hora las elige la taquilla.
  const [drawDate, setDrawDate] = useState(todayISO());
  const [drawTime, setDrawTime] = useState('');
  // Filas de la apuesta: un animalito con su monto.
  const [animalRows, setAnimalRows] = useState([]);

  // Hipismo state
  const [raceId, setRaceId] = useState('');
  const [horseId, setHorseId] = useState('');
  const [selectedRace, setSelectedRace] = useState(null);
  const [selectedHorse, setSelectedHorse] = useState(null);

  // Parley state
  const [parleySport, setParleySport] = useState('football');
  const [parleyDate, setParleyDate] = useState(todayISO());
  const [parleyLeague, setParleyLeague] = useState('');
  const [parleySearch, setParleySearch] = useState('');
  const [parleyEvents, setParleyEvents] = useState([]);
  const [parleyEventsLoading, setParleyEventsLoading] = useState(false);
  const [parleyEventsError, setParleyEventsError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [odds, setOdds] = useState(null);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [oddsError, setOddsError] = useState(null);
  const [selections, setSelections] = useState([]);
  const [selectionError, setSelectionError] = useState(null);

  // Ligas disponibles con contador de partidos
  const leaguesWithCounts = useMemo(() => {
    const map = new Map();
    parleyEvents.forEach((ev) => {
      const name = ev.league?.name;
      if (name) {
        map.set(name, (map.get(name) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [parleyEvents]);

  // Eventos filtrados por liga y texto
  const filteredParleyEvents = useMemo(() => {
    return parleyEvents.filter((ev) => {
      if (parleyLeague && ev.league?.name !== parleyLeague) {
        return false;
      }
      const query = parleySearch.trim().toLowerCase();
      if (!query) return true;
      return [ev.home?.name, ev.away?.name, ev.league?.name, ev.league?.country]
        .filter(Boolean)
        .some((val) => val.toLowerCase().includes(query));
    });
  }, [parleyEvents, parleyLeague, parleySearch]);

  // Catálogo y límites
  const agency = catalog?.agency;
  const maxBet = agency?.max_bet_amount;
  const maxPayout = agency?.max_ticket_payout;

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/taquilla/catalog').then((r) => { if (active) setCatalog(r.data.data); }),
      api.get('/parley/sports').then((r) => { if (active) setSports(r.data.data); }),
    ]).catch((err) => {
      if (active) setError(getErrorMessage(err));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setError(null);
    setSuccess(null);
    setStake('');
    setLotteryId('');
    setAnimalRows([]);
    setDrawTime('');
    setRaceId('');
    setHorseId('');
    setSelections([]);
    setSelectedEvent(null);
    setOdds(null);
    setSelectionError(null);
  }, [type]);

  const handleLotteryChange = (id) => {
    setLotteryId(id);
    setAnimalRows([]);
    const lot = catalog?.lotteries?.find((l) => String(l.id) === String(id));
    setSelectedLottery(lot || null);

    // Se propone el primer horario de la lotería que todavía no pasó.
    const disponible = (lot?.draw_times ?? []).find((hora) => !isDrawPast(drawDate, hora));
    setDrawTime(disponible ?? (lot?.draw_times ?? [])[0] ?? '');
  };

  // Filas de la apuesta de animalitos
  const addAnimalRow = () => {
    setAnimalRows((prev) => [...prev, { animal_id: '', amount: '' }]);
  };

  const updateAnimalRow = (index, patch) => {
    setAnimalRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeAnimalRow = (index) => {
    setAnimalRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Total de la apuesta de animalitos: la suma de los montos por animalito.
  const animalitosTotal = useMemo(
    () => animalRows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0),
    [animalRows]
  );

  const handleRaceChange = (id) => {
    setRaceId(id);
    setHorseId('');
    const race = catalog?.races?.find((r) => String(r.id) === String(id));
    setSelectedRace(race || null);
    setSelectedHorse(null);
  };

  const handleHorseChange = (id) => {
    setHorseId(id);
    const horse = selectedRace?.horses?.find((h) => String(h.id) === String(id));
    setSelectedHorse(horse || null);
  };

  // Limpiar filtros y selección al cambiar de deporte o fecha
  useEffect(() => {
    setParleyLeague('');
    setParleySearch('');
    setSelectedEvent(null);
    setOdds(null);
  }, [parleySport, parleyDate]);

  const handleSetQuickDate = (daysAhead) => {
    // La fecha se calcula en hora de Caracas, que es la de la operación:
    // "hoy" debe ser el hoy del operador, no el del reloj del navegador.
    setParleyDate(shiftDateISO(todayISO(), daysAhead));
  };

  // Carga de eventos parley
  useEffect(() => {
    if (type !== 'parley') return;
    let active = true;
    setParleyEventsLoading(true);
    setParleyEventsError(null);

    api.get('/parley/events', { params: { sport: parleySport, date: parleyDate } })
      .then((r) => {
        // Solo los partidos que no han empezado admiten apuesta: los que
        // ya estan en vivo o terminados no se listan para ver sus cuotas.
        if (active) setParleyEvents(r.data.data.filter(isNotStarted));
      })
      .catch((err) => {
        if (active) setParleyEventsError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setParleyEventsLoading(false);
      });

    return () => { active = false; };
  }, [type, parleySport, parleyDate]);

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setOdds(null);
    setOddsError(null);
    setSelectionError(null);
    setOddsLoading(true);

    api.get(`/parley/events/${parleySport}/${event.id}/odds`)
      .then((r) => setOdds(r.data.data))
      .catch((err) => setOddsError(getErrorMessage(err)))
      .finally(() => setOddsLoading(false));
  };

  const handleAddSelection = (market, selection) => {
    setSelectionError(null);
    if (!selectedEvent) return;

    const label = selection.label || selection.name || 'Opción';
    const oddNumber = Number(selection.odd ?? selection.price ?? 0);

    if (isNaN(oddNumber) || oddNumber <= 1.0) {
      setSelectionError(`La cuota de "${label}" (${selection.odd}) no es válida para apostar.`);
      return;
    }

    const eventIdStr = String(selectedEvent.id);
    const existingIndex = selections.findIndex((s) => String(s.event_id) === eventIdStr);

    if (existingIndex >= 0) {
      const existing = selections[existingIndex];
      // Si hace clic en la misma opción que ya tenía seleccionada, la desmarca
      if (existing.market === market.name && existing.selection === label) {
        setSelections((prev) => prev.filter((_, i) => i !== existingIndex));
        return;
      }

      // Si selecciona otra opción del mismo juego, actualiza la jugada
      const targetTeam = resolveBetTeam(label, selectedEvent.home?.name, selectedEvent.away?.name);
      setSelections((prev) => {
        const next = [...prev];
        next[existingIndex] = {
          sport: parleySport,
          event_id: eventIdStr,
          event_name: `${selectedEvent.home?.name ?? 'Local'} vs ${selectedEvent.away?.name ?? 'Visitante'}`,
          market: market.name,
          market_id: market.id ?? null,
          selection: label,
          team: targetTeam,
          odd: oddNumber,
          league: selectedEvent.league?.name,
          home: selectedEvent.home?.name,
          away: selectedEvent.away?.name,
          starts_at: selectedEvent.starts_at,
        };
        return next;
      });
      return;
    }

    if (selections.length >= 20) {
      setSelectionError('Un parley no puede tener más de 20 jugadas.');
      return;
    }

    const targetTeam = resolveBetTeam(label, selectedEvent.home?.name, selectedEvent.away?.name);
    setSelections((prev) => [
      ...prev,
      {
        sport: parleySport,
        event_id: eventIdStr,
        event_name: `${selectedEvent.home?.name ?? 'Local'} vs ${selectedEvent.away?.name ?? 'Visitante'}`,
        market: market.name,
        market_id: market.id ?? null,
        selection: label,
        team: targetTeam,
        odd: oddNumber,
        league: selectedEvent.league?.name,
        home: selectedEvent.home?.name,
        away: selectedEvent.away?.name,
        starts_at: selectedEvent.starts_at,
      },
    ]);
  };

  const removeSelection = (index) => {
    setSelections((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculo de cuota y ganancia
  const computeOdds = () => {
    if (type === 'animalitos') {
      return Number(selectedLottery?.payout_multiplier || 0);
    }
    if (type === 'hipismo') {
      return Number(selectedHorse?.dividend || 0);
    }
    if (type === 'parley') {
      if (selections.length === 0) return 0;
      return selections.reduce((acc, s) => acc * s.odd, 1);
    }
    return 0;
  };

  const currentOdds = computeOdds();
  const amountNumber = Number(stake) || 0;
  // En animalitos el monto es la suma de los montos de cada animalito.
  const stakeAmount = type === 'animalitos' ? animalitosTotal : amountNumber;
  const potentialPayout = stakeAmount > 0 && currentOdds > 0 ? Number((stakeAmount * currentOdds).toFixed(2)) : 0;

  const overMaxBet = maxBet !== null && stakeAmount > Number(maxBet);
  const overMaxPayout = maxPayout !== null && potentialPayout > Number(maxPayout);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (type !== 'animalitos' && (!amountNumber || amountNumber <= 0)) {
      setError('Ingresa un monto de apuesta válido.');
      return;
    }
    if (overMaxBet) {
      setError(`El monto de apuesta supera el límite de tu agencia (${formatAmount(maxBet)}).`);
      return;
    }
    if (overMaxPayout) {
      setError(`La ganancia potencial supera el tope máximo por ticket (${formatAmount(maxPayout)}).`);
      return;
    }

    let payload = null;

    if (type === 'animalitos') {
      if (!lotteryId || !drawDate || !drawTime) {
        setError('Debes seleccionar la lotería y el sorteo al que apuestas.');
        return;
      }
      if (animalRows.length === 0) {
        setError('Debes agregar al menos un animalito a la jugada.');
        return;
      }
      if (animalRows.some((row) => !row.animal_id)) {
        setError('Cada fila debe tener un animalito seleccionado.');
        return;
      }
      if (animalRows.some((row) => !(Number(row.amount) > 0))) {
        setError('Cada animalito debe tener un monto mayor que cero.');
        return;
      }
      if (new Set(animalRows.map((row) => row.animal_id)).size !== animalRows.length) {
        setError('No puedes repetir el mismo animalito en un ticket.');
        return;
      }
      if (animalitosTotal <= 0) {
        setError('Ingresa un monto de apuesta válido.');
        return;
      }
      payload = {
        type,
        lottery_id: Number(lotteryId),
        sorteo_date: drawDate,
        sorteo_time: drawTime,
        selections: animalRows.map((row) => ({
          lottery_animal_id: Number(row.animal_id),
          amount: Number(row.amount),
        })),
      };
    } else if (type === 'hipismo') {
      if (!raceId || !horseId) {
        setError('Debes seleccionar la carrera y el ejemplar a jugar.');
        return;
      }
      payload = {
        type,
        stake: amountNumber,
        race_id: Number(raceId),
        horse_id: Number(horseId),
      };
    } else {
      if (selections.length < 2) {
        setError('Un parley requiere un mínimo de 2 selecciones.');
        return;
      }
      payload = {
        type,
        stake: amountNumber,
        selections,
      };
    }

    setSaving(true);
    try {
      const res = await api.post('/taquilla/tickets', payload);
      const ticket = res.data.data;
      setLastCreatedTicket(ticket);
      setSuccess(`✅ ¡Ticket ${ticket.code} registrado con éxito! Premio potencial: ${formatAmount(ticket.potential_payout)}.`);
      setStake('');
      setLotteryId('');
        setAnimalRows([]);
      setRaceId('');
      setHorseId('');
      setSelections([]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <span>Nueva Apuesta</span>
            <span className="page-title-badge">Emisión</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            Registro y cobro de tickets para clientes en taquilla.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link className="btn btn-secondary" to="/taquilla/tickets">
            <Receipt size={18} />
            <span>Consultar Tickets</span>
          </Link>
          <Link className="btn btn-secondary" to="/taquilla">
            <ArrowLeft size={18} />
            <span>Volver</span>
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

      {/* Topes de Agencia */}
      {agency && (
        <div
          style={{
            display: 'flex',
            gap: '1.25rem',
            flexWrap: 'wrap',
            background: 'var(--bg-input)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            Agencia: <strong style={{ color: 'var(--text-primary)' }}>{agency.name}</strong>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Tope por Apuesta: <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>{formatLimit(maxBet)}</strong>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Ganancia Máx. por Ticket: <strong style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{formatLimit(maxPayout)}</strong>
          </span>
        </div>
      )}

      {/* Selector de Modalidad */}
      <div className="module-tabs">
        <button
          type="button"
          className={`module-tab-btn ${type === 'animalitos' ? 'active' : ''}`}
          onClick={() => setType('animalitos')}
        >
          <Sparkles size={18} />
          <span>Lotería / Animalitos</span>
        </button>

        <button
          type="button"
          className={`module-tab-btn ${type === 'hipismo' ? 'active' : ''}`}
          onClick={() => setType('hipismo')}
        >
          <Flame size={18} />
          <span>Hipismo</span>
        </button>

        <button
          type="button"
          className={`module-tab-btn ${type === 'parley' ? 'active' : ''}`}
          onClick={() => setType('parley')}
        >
          <Gamepad2 size={18} />
          <span>Parley Deportivo</span>
        </button>
      </div>

      {!catalog ? (
        <p className="empty">Cargando catálogo de taquilla...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* SECCIÓN 1: ANIMALITOS */}
          {type === 'animalitos' && (
            <section className="card">
              <h2 className="card-title">Lotería y Sorteo</h2>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="lottery-select">Lotería Activa</label>
                  <select
                    id="lottery-select"
                    className="input"
                    value={lotteryId}
                    onChange={(e) => handleLotteryChange(e.target.value)}
                    required
                  >
                    <option value="">-- Selecciona una lotería --</option>
                    {catalog.lotteries?.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.name} (Paga x{Number(lot.payout_multiplier).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="draw-time-select">Horario del Sorteo</label>
                  <select
                    id="draw-time-select"
                    className="input"
                    value={drawTime}
                    onChange={(e) => setDrawTime(e.target.value)}
                    disabled={!selectedLottery}
                    required
                  >
                    <option value="">
                      {selectedLottery ? '-- Selecciona un horario --' : 'Primero elige una lotería'}
                    </option>
                    {(selectedLottery?.draw_times ?? []).map((hora) => {
                      const pasado = isDrawPast(drawDate, hora);
                      const cerrado = isDrawClosed(catalog?.resolved_draws, lotteryId, drawDate, hora);

                      return (
                        <option key={hora} value={hora} disabled={pasado || cerrado}>
                          {hora}
                          {cerrado ? ' — sorteado' : pasado ? ' — ya pasó' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="draw-date-input">Fecha del Sorteo</label>
                  <input
                    id="draw-date-input"
                    className="input"
                    type="date"
                    value={drawDate}
                    onChange={(e) => setDrawDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {selectedLottery && (selectedLottery.draw_times ?? []).length === 0 && (
                <div className="alert alert-info" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                  Esta lotería no tiene horarios de sorteo configurados. Contacta al administrador.
                </div>
              )}

              {selectedLottery && drawTime && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.88rem', color: '#a7f3d0' }}>
                  Sorteo elegido: <strong>{formatDrawLabel(drawDate, drawTime)}</strong>
                  {' · '}Multiplicador garantizado:{' '}
                  <strong>x{Number(selectedLottery.payout_multiplier).toFixed(2)}</strong>
                </div>
              )}

              {/* ANIMALITOS Y MONTOS */}
              {selectedLottery && (
                <div style={{ marginTop: '1.25rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.6rem',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                      Animalitos y montos
                    </h3>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={addAnimalRow}
                      disabled={animalRows.length >= 20}
                    >
                      <PlusCircle size={14} />
                      <span>Agregar animalito</span>
                    </button>
                  </div>

                  {animalRows.length === 0 ? (
                    <p className="empty" style={{ margin: 0 }}>
                      Agrega al menos un animalito con su monto.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {animalRows.map((row, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 150px 40px',
                            gap: '0.6rem',
                            alignItems: 'center',
                          }}
                        >
                          <select
                            className="input"
                            value={row.animal_id}
                            onChange={(e) => updateAnimalRow(index, { animal_id: e.target.value })}
                            required
                          >
                            <option value="">-- Animalito --</option>
                            {selectedLottery?.animals?.map((a) => (
                              <option key={a.id} value={a.id}>
                                N° {a.number} - {a.animal}
                              </option>
                            ))}
                          </select>

                          <input
                            className="input"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={row.amount}
                            onChange={(e) => updateAnimalRow(index, { amount: e.target.value })}
                            placeholder="Monto"
                            required
                          />

                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeAnimalRow(index)}
                            title="Quitar animalito"
                            style={{ padding: '0.25rem 0.45rem' }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '0.85rem',
                      padding: '0.6rem 0.85rem',
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>Total de la apuesta</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: '#34d399', fontSize: '1.05rem' }}>
                      {formatAmount(animalitosTotal)}
                    </strong>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SECCIÓN 2: HIPISMO */}
          {type === 'hipismo' && (
            <section className="card">
              <h2 className="card-title">Selección de Carrera y Ejemplar</h2>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="race-select">Carrera Programada</label>
                  <select
                    id="race-select"
                    className="input"
                    value={raceId}
                    onChange={(e) => handleRaceChange(e.target.value)}
                    required
                  >
                    <option value="">-- Selecciona una carrera --</option>
                    {catalog.races?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.meeting ? `[${r.meeting}] ` : ''}{r.name} — {r.track || 'Hipódromo'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="horse-select">Ejemplar</label>
                  <select
                    id="horse-select"
                    className="input"
                    value={horseId}
                    onChange={(e) => handleHorseChange(e.target.value)}
                    disabled={!selectedRace}
                    required
                  >
                    <option value="">
                      {selectedRace ? '-- Selecciona un caballo --' : 'Primero elige una carrera'}
                    </option>
                    {selectedRace?.horses
                      ?.filter((h) => !h.is_retired)
                      ?.map((h) => (
                        <option key={h.id} value={h.id}>
                          N° {h.number} - {h.name} (Cuota {h.dividend})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {selectedHorse && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.88rem', color: '#a7f3d0' }}>
                  Cuota fija asignada: <strong>x{selectedHorse.dividend}</strong>
                </div>
              )}
            </section>
          )}

          {/* SECCIÓN 3: PARLEY */}
          {type === 'parley' && (
            <section className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Selección de Eventos Deportivos
                </h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Total partidos: <strong style={{ color: 'var(--text-primary)' }}>{parleyEvents.length}</strong>
                </span>
              </div>

              {/* Selector de Deporte (Pills visuales rápidos) */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                  Deporte
                </label>
                <div className="sport-tabs" style={{ marginBottom: 0 }}>
                  {sports.map((sp) => {
                    const label = sp.label || sp.name || sp.key;
                    const isSelected = parleySport === sp.key;
                    return (
                      <button
                        key={sp.key}
                        type="button"
                        className={`sport-tab ${isSelected ? 'active' : ''}`}
                        onClick={() => setParleySport(sp.key)}
                      >
                        {sp.key === 'football' && '⚽ '}
                        {sp.key === 'baseball' && '⚾ '}
                        {sp.key === 'basketball' && '🏀 '}
                        {sp.key === 'hockey' && '🏒 '}
                        {sp.key === 'nba' && '🏆 '}
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Barra de Filtros: Liga, Búsqueda y Fecha */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.85rem',
                  background: 'var(--bg-input)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '1rem',
                  alignItems: 'flex-end',
                }}
              >
                {/* 1. Selector de Liga */}
                <div className="form-field" style={{ margin: 0 }}>
                  <label htmlFor="parley-league" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Filter size={14} color="#38bdf8" />
                      <strong>Liga o Torneo</strong>
                    </span>
                    {parleyLeague && (
                      <button
                        type="button"
                        onClick={() => setParleyLeague('')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#93c5fd',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          padding: 0,
                        }}
                      >
                        Ver todas
                      </button>
                    )}
                  </label>
                  <select
                    id="parley-league"
                    className="input"
                    value={parleyLeague}
                    onChange={(e) => setParleyLeague(e.target.value)}
                    disabled={parleyEventsLoading || parleyEvents.length === 0}
                  >
                    <option value="">
                      Todas las ligas ({parleyEvents.length} partidos)
                    </option>
                    {leaguesWithCounts.map((lg) => (
                      <option key={lg.name} value={lg.name}>
                        {lg.name} ({lg.count} {lg.count === 1 ? 'partido' : 'partidos'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Buscador en tiempo real de Equipos */}
                <div className="form-field" style={{ margin: 0 }}>
                  <label htmlFor="parley-search" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Search size={14} color="#34d399" />
                    <strong>Buscar Equipo</strong>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="parley-search"
                      className="input"
                      type="search"
                      value={parleySearch}
                      onChange={(e) => setParleySearch(e.target.value)}
                      placeholder="Ej: Barcelona, Yankees, Lakers..."
                    />
                  </div>
                </div>

                {/* 3. Selector de Fecha con botones rápidos */}
                <div className="form-field" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label htmlFor="parley-date" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Calendar size={14} color="#f59e0b" />
                      <strong>Fecha</strong>
                    </label>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem' }}
                        onClick={() => handleSetQuickDate(0)}
                      >
                        Hoy
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem' }}
                        onClick={() => handleSetQuickDate(1)}
                      >
                        Mañana
                      </button>
                    </div>
                  </div>
                  <input
                    id="parley-date"
                    className="input"
                    type="date"
                    value={parleyDate}
                    onChange={(e) => setParleyDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Indicadores de Filtros Activos */}
              {(parleyLeague || parleySearch) && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Filtros activos:</span>
                  {parleyLeague && (
                    <span
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid #38bdf8',
                        color: '#7dd3fc',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>Liga: {parleyLeague}</span>
                      <button
                        type="button"
                        onClick={() => setParleyLeague('')}
                        style={{ background: 'none', border: 'none', color: '#7dd3fc', cursor: 'pointer', padding: 0 }}
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {parleySearch && (
                    <span
                      style={{
                        background: 'rgba(52, 211, 153, 0.15)',
                        border: '1px solid #34d399',
                        color: '#a7f3d0',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>Búsqueda: "{parleySearch}"</span>
                      <button
                        type="button"
                        onClick={() => setParleySearch('')}
                        style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer', padding: 0 }}
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => {
                      setParleyLeague('');
                      setParleySearch('');
                    }}
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}

              {/* Lista de partidos filtrados */}
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text-secondary)' }}>
                    Partidos Disponibles ({filteredParleyEvents.length} de {parleyEvents.length})
                  </h3>
                  {selectedEvent && (
                    <span style={{ fontSize: '0.8rem', color: '#34d399' }}>
                      ✓ Partido seleccionado para cuotas
                    </span>
                  )}
                </div>

                {parleyEventsLoading ? (
                  <p className="empty">Cargando eventos desde el proveedor deportivo...</p>
                ) : parleyEventsError ? (
                  <div className="alert alert-error" style={{ marginBottom: 0, fontSize: '0.88rem' }}>
                    {parleyEventsError}
                  </div>
                ) : parleyEvents.length === 0 ? (
                  <p className="empty">No hay partidos disponibles para la fecha y deporte seleccionados.</p>
                ) : filteredParleyEvents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg-input)', borderRadius: '8px' }}>
                    <p style={{ margin: '0 0 0.5rem', color: 'var(--text-secondary)' }}>
                      No se encontraron partidos que coincidan con los filtros de liga o búsqueda.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setParleyLeague('');
                        setParleySearch('');
                      }}
                    >
                      Mostrar todos los partidos de hoy
                    </button>
                  </div>
                ) : (
                  <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.5rem' }}>
                    {filteredParleyEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => handleSelectEvent(ev)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: selectedEvent?.id === ev.id ? 'var(--bg-surface-elevated)' : 'transparent',
                          border: selectedEvent?.id === ev.id ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                          marginBottom: '0.35rem',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                              {ev.home?.name ?? 'Local'} vs {ev.away?.name ?? 'Visitante'}
                            </span>
                            {ev.status && (
                              <span
                                className={statusClass(ev.status)}
                                style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem', borderRadius: '4px' }}
                              >
                                {statusLabel(ev.status)}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{ev.league?.name ?? 'Liga'}</span>
                            {ev.league?.country && <span>· {ev.league.country}</span>}
                            <span>· ⏰ {formatTime(ev.starts_at)}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {selections.some((s) => String(s.event_id) === String(ev.id)) && (
                            <span
                              style={{
                                background: 'rgba(52, 211, 153, 0.15)',
                                color: '#34d399',
                                border: '1px solid #34d399',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                              }}
                            >
                              ✓ En Parley
                            </span>
                          )}
                          <button
                            type="button"
                            className={`btn btn-sm ${selectedEvent?.id === ev.id ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ minWidth: '95px' }}
                          >
                            {selectedEvent?.id === ev.id ? '✓ Viendo' : 'Ver Cuotas'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mercados del evento seleccionado */}
              {selectedEvent && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    background: 'var(--bg-input)',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                        Cuotas: {selectedEvent.home?.name} vs {selectedEvent.away?.name}
                      </h4>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {selectedEvent.league?.name} · {formatTime(selectedEvent.starts_at)}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSelectedEvent(null);
                        setOdds(null);
                        setSelectionError(null);
                      }}
                    >
                      <X size={15} />
                      <span>Cerrar</span>
                    </button>
                  </div>

                  {selectionError && (
                    <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>
                      {selectionError}
                    </div>
                  )}

                  {oddsLoading && (
                    <p className="empty">Consultando cuotas oficiales del partido...</p>
                  )}

                  {oddsError && (
                    <div className="alert alert-error">{oddsError}</div>
                  )}

                  {!oddsLoading && odds && !odds.available && (
                    <div className="alert alert-info">
                      {odds.message || 'Sin cuotas disponibles para este evento.'}
                    </div>
                  )}

                  {!oddsLoading && odds?.available && (
                    <div>
                      {odds.bookmaker?.name && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem' }}>
                          Casa de apuestas: <strong style={{ color: 'var(--text-primary)' }}>{odds.bookmaker.name}</strong>
                        </p>
                      )}

                      {(!odds.markets || odds.markets.length === 0) ? (
                        <p className="empty">No hay mercados con cuotas disponibles para este evento.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          {odds.markets.map((mkt) => (
                            <div
                              key={mkt.id || mkt.name}
                              style={{
                                background: 'var(--bg-surface)',
                                padding: '0.75rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-subtle)',
                              }}
                            >
                              <span style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                                {mkt.name}
                              </span>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {mkt.selections?.map((sel) => {
                                  const label = sel.label || sel.name;
                                  const isSelected = selections.some(
                                    (s) => String(s.event_id) === String(selectedEvent.id) && s.market === mkt.name && s.selection === label
                                  );
                                  const oddNum = Number(sel.odd ?? sel.price ?? 0);
                                  return (
                                    <button
                                      key={`${mkt.name}-${label}`}
                                      type="button"
                                      className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem' }}
                                      onClick={() => handleAddSelection(mkt, sel)}
                                    >
                                      <span>{label}</span>
                                      <strong style={{ color: isSelected ? '#ffffff' : '#34d399', fontFamily: 'var(--font-mono)' }}>
                                        {oddNum > 0 ? oddNum.toFixed(2) : '—'}
                                      </strong>
                                      {isSelected && <span style={{ fontSize: '0.75rem' }}>✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Jugadas del Parley acumuladas */}
              {selections.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                    Jugadas en el Parley ({selections.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {selections.map((s, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          background: 'var(--bg-input)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>Apostado a:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{s.team || s.selection}</strong>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>({s.market})</span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                            {s.event_name}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <strong style={{ color: '#34d399' }}>x{s.odd}</strong>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '0.2rem 0.5rem' }}
                            onClick={() => removeSelection(idx)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SECCIÓN GENERAL: MONTO DE APUESTA Y EMISIÓN (Visible para todos los tipos) */}
          <section className="card" style={{ marginTop: '1.25rem' }}>
            <h2 className="card-title">Monto y Emisión del Ticket</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {type !== 'animalitos' && (
                <div className="form-field">
                  <label htmlFor="stake-input">Monto a Apostar</label>
                  <input
                    id="stake-input"
                    className="input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    placeholder="Ej: 10.00"
                    required
                  />
                </div>
              )}

              {type === 'animalitos' && (
                <div className="form-field">
                  <label htmlFor="stake-readonly">Total a Apostar</label>
                  <input
                    id="stake-readonly"
                    className="input"
                    type="text"
                    value={formatAmount(animalitosTotal)}
                    readOnly
                    disabled
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Suma de los montos de cada animalito.
                  </span>
                </div>
              )}

              <div style={{ background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Cuota / Multiplicador</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {currentOdds > 0 ? `x${currentOdds.toFixed(2)}` : '—'}
                </strong>
              </div>

              <div style={{ background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Premio Potencial</span>
                <strong style={{ fontSize: '1.35rem', color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                  {potentialPayout > 0 ? formatAmount(potentialPayout) : '—'}
                </strong>
              </div>
            </div>

            {/* Avisos de Límites */}
            {overMaxBet && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                ⚠ El monto supera el límite de tu agencia ({formatAmount(maxBet)}).
              </div>
            )}
            {overMaxPayout && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                ⚠ La ganancia potencial supera el tope máximo permitido por ticket ({formatAmount(maxPayout)}).
              </div>
            )}

            {type === 'parley' && selections.length < 2 && (
              <div className="alert alert-info" style={{ marginBottom: '1rem', fontSize: '0.88rem' }}>
                ℹ Un parley requiere seleccionar al menos 2 jugadas de partidos diferentes ({selections.length} de 2 seleccionadas).
              </div>
            )}

            {type === 'animalitos' && animalRows.length > 0 && (
              <div className="alert alert-info" style={{ marginBottom: '1rem', fontSize: '0.88rem' }}>
                ℹ Sorteo: <strong>{formatDrawLabel(drawDate, drawTime)}</strong> · {animalRows.length} animalito
                {animalRows.length === 1 ? '' : 's'} · Total {formatAmount(animalitosTotal)}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Link className="btn btn-secondary" to="/taquilla">
                Cancelar
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  saving ||
                  overMaxBet ||
                  overMaxPayout ||
                  stakeAmount <= 0 ||
                  (type === 'animalitos' && (!drawTime || animalRows.length === 0)) ||
                  (type === 'parley' && selections.length < 2)
                }
                style={{ minWidth: '180px' }}
              >
                {saving ? 'Registrando...' : '🎟️ Emitir Ticket'}
              </button>
            </div>
          </section>
        </form>
      )}

      {/* Modal Comprobante Ticket Emitido */}
      {lastCreatedTicket && (
        <div
          className="modal-overlay"
          style={{ zIndex: 100 }}
          onClick={() => setLastCreatedTicket(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '480px',
              width: '90%',
              margin: 'auto',
              position: 'relative',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399' }}>
                <CheckCircle2 size={22} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                  ¡Ticket Emitido Exitosamente!
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLastCreatedTicket(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div
              id="printable-ticket"
              style={{
                background: 'var(--bg-canvas)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border-medium)',
                fontFamily: 'var(--font-mono)',
                textAlign: 'center',
              }}
            >
              <strong style={{ fontSize: '1.2rem', display: 'block', color: 'var(--text-primary)', letterSpacing: '1px' }}>
                EL TRÉBOL
              </strong>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                Agencia: {lastCreatedTicket.agency?.name || agency?.name || user.agency?.name || 'Agencia Oficial'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Taquilla: {lastCreatedTicket.taquilla?.name || user.name || 'Taquilla 1'}
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', margin: '0.5rem 0', letterSpacing: '2px' }}>
                N° {lastCreatedTicket.code}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                {formatTicketDate(lastCreatedTicket.created_at)}
              </div>

              <div style={{ textAlign: 'left', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Modalidad:</span>
                  <strong>{TICKET_TYPE_LABELS[lastCreatedTicket.type] ?? lastCreatedTicket.type}</strong>
                </div>

                {/* Detalle de Jugadas con Liga y Hora */}
                <div style={{ margin: '0.75rem 0', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.4rem', fontWeight: 700 }}>
                    DETALLE DE JUGADAS:
                  </span>
                  {lastCreatedTicket.selections?.map((sel, idx) => {
                    const league = sel.metadata?.league || sel.league;
                    const gameTime = sel.metadata?.starts_at || sel.starts_at || sel.metadata?.race_date;
                    const betTeam = sel.metadata?.team || sel.team || resolveBetTeam(sel.selection_label, sel.metadata?.home, sel.metadata?.away);
                    const isParley = lastCreatedTicket.type === 'parley';
                    const isHipismo = lastCreatedTicket.type === 'hipismo';

                    return (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--bg-surface)',
                          padding: '0.55rem 0.7rem',
                          borderRadius: '4px',
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
                          {lastCreatedTicket.type === 'animalitos'
                            ? `Monto: ${formatAmount(sel.amount)}`
                            : `Mercado: ${sel.market || 'Ganador'}`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {lastCreatedTicket.type === 'animalitos' && lastCreatedTicket.sorteo_at && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Sorteo:</span>
                    <strong>{formatDrawTime(lastCreatedTicket.sorteo_at)}</strong>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Monto Apostado:</span>
                  <strong>{formatAmount(lastCreatedTicket.stake)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34d399', fontSize: '0.95rem' }}>
                  <span>Premio Potencial:</span>
                  <strong>{formatAmount(lastCreatedTicket.potential_payout)}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => printTicket()}
              >
                <Printer size={16} />
                <span>Imprimir Ticket</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setLastCreatedTicket(null)}
              >
                <span>Nueva Jugada</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}