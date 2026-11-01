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
import { MatrixBetIcon } from '../components/MatrixBetLogo';
import {
  TICKET_TYPE_LABELS,
  HORSE_BET_TYPE_LABELS,
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
  const [hipismoBetType, setHipismoBetType] = useState('ganador');
  const [hipismoMeeting, setHipismoMeeting] = useState('');
  const [cincoYSeisSelections, setCincoYSeisSelections] = useState({});
  const [raceId, setRaceId] = useState('');
  const [horseId, setHorseId] = useState('');
  const [selectedRace, setSelectedRace] = useState(null);
  const [selectedHorse, setSelectedHorse] = useState(null);
  const [hipismoSelectedHorses, setHipismoSelectedHorses] = useState({});
  const [quickHorseAmount, setQuickHorseAmount] = useState('10');

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
    setHipismoBetType('ganador');
    setHipismoMeeting('');
    setCincoYSeisSelections({});
    setHipismoSelectedHorses({});
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
    setHipismoSelectedHorses({});
  };

  const handleHorseChange = (id) => {
    setHorseId(id);
    const horse = selectedRace?.horses?.find((h) => String(h.id) === String(id));
    setSelectedHorse(horse || null);
  };

  const toggleHorseSelection = (hId, defaultAmount = '') => {
    setHipismoSelectedHorses((prev) => {
      const current = prev[hId];
      if (current?.selected) {
        const next = { ...prev };
        delete next[hId];
        return next;
      }
      return {
        ...prev,
        [hId]: {
          selected: true,
          amount: defaultAmount || quickHorseAmount || '10',
        },
      };
    });
  };

  const updateHorseAmount = (hId, amount) => {
    setHipismoSelectedHorses((prev) => ({
      ...prev,
      [hId]: {
        selected: true,
        amount,
      },
    }));
  };

  const applyQuickAmountToSelected = (amount) => {
    if (!amount || Number(amount) <= 0) return;
    setHipismoSelectedHorses((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((hid) => {
        if (next[hid]?.selected) {
          next[hid] = { ...next[hid], amount: String(amount) };
        }
      });
      return next;
    });
  };

  const selectAllHorsesInRace = (amount) => {
    if (!selectedRace?.horses) return;
    const initialAmount = amount || quickHorseAmount || '10';
    const next = {};
    selectedRace.horses.filter((h) => !h.is_retired).forEach((h) => {
      next[h.id] = { selected: true, amount: String(initialAmount) };
    });
    setHipismoSelectedHorses(next);
  };

  const clearAllHorsesInRace = () => {
    setHipismoSelectedHorses({});
  };

  const hipismoGanadorList = useMemo(() => {
    if (!selectedRace?.horses) return [];
    return selectedRace.horses
      .filter((h) => !h.is_retired && hipismoSelectedHorses[h.id]?.selected)
      .map((h) => ({
        ...h,
        amount: hipismoSelectedHorses[h.id]?.amount ?? '',
        numericAmount: Number(hipismoSelectedHorses[h.id]?.amount) || 0,
      }));
  }, [selectedRace?.horses, hipismoSelectedHorses]);

  const hipismoGanadorTotal = useMemo(() => {
    return hipismoGanadorList.reduce((acc, h) => acc + h.numericAmount, 0);
  }, [hipismoGanadorList]);

  const hipismoMaxPotentialPayout = useMemo(() => {
    if (hipismoGanadorList.length === 0) return 0;
    return hipismoGanadorList.reduce((max, h) => {
      const odd = Number(h.dividend) > 0 ? Number(h.dividend) : 1.0;
      const pot = h.numericAmount * odd;
      return pot > max ? pot : max;
    }, 0);
  }, [hipismoGanadorList]);

  // Reuniones disponibles en el catálogo de hipismo
  const hipismoMeetings = useMemo(() => {
    if (!catalog?.races) return [];
    return Array.from(new Set(catalog.races.map((r) => r.meeting).filter(Boolean)));
  }, [catalog?.races]);

  // Selección automática de la primera reunión si está vacía
  useEffect(() => {
    if (type === 'hipismo' && hipismoBetType === 'cinco_y_seis' && !hipismoMeeting && hipismoMeetings.length > 0) {
      setHipismoMeeting(hipismoMeetings[0]);
    }
  }, [type, hipismoBetType, hipismoMeeting, hipismoMeetings]);

  // Carreras válidas de la reunión seleccionada
  const meetingValidRaces = useMemo(() => {
    if (!catalog?.races || !hipismoMeeting) return [];
    const racesInMeeting = catalog.races.filter((r) => r.meeting === hipismoMeeting);
    const validas = racesInMeeting.filter((r) => r.is_valida || /v[áa]lida/i.test(r.name));
    if (validas.length > 0) {
      return validas.sort((a, b) => (a.valida_number || 0) - (b.valida_number || 0) || a.id - b.id);
    }
    return racesInMeeting.sort((a, b) => a.id - b.id);
  }, [catalog?.races, hipismoMeeting]);

  const toggleCincoYSeisHorse = (targetRaceId, targetHorseId) => {
    setCincoYSeisSelections((prev) => {
      const list = prev[targetRaceId] || [];
      const exists = list.includes(targetHorseId);
      const updated = exists ? list.filter((id) => id !== targetHorseId) : [...list, targetHorseId];
      return {
        ...prev,
        [targetRaceId]: updated,
      };
    });
  };

  const cincoYSeisCombinations = useMemo(() => {
    if (type !== 'hipismo' || hipismoBetType !== 'cinco_y_seis' || meetingValidRaces.length === 0) {
      return 0;
    }
    let total = 1;
    for (const r of meetingValidRaces) {
      const marks = cincoYSeisSelections[r.id] || [];
      if (marks.length === 0) return 0;
      total *= marks.length;
    }
    return total;
  }, [type, hipismoBetType, meetingValidRaces, cincoYSeisSelections]);

  const missingValidas = useMemo(() => {
    if (type !== 'hipismo' || hipismoBetType !== 'cinco_y_seis' || meetingValidRaces.length === 0) {
      return [];
    }
    return meetingValidRaces.filter((r) => !(cincoYSeisSelections[r.id]?.length > 0));
  }, [type, hipismoBetType, meetingValidRaces, cincoYSeisSelections]);

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

  const isHipismoMultiple = type === 'hipismo' && hipismoBetType !== 'cinco_y_seis';

  // Cálculo de cuota y ganancia
  const computeOdds = () => {
    if (type === 'animalitos') {
      return Number(selectedLottery?.payout_multiplier || 0);
    }
    if (type === 'hipismo') {
      if (hipismoBetType === 'cinco_y_seis') {
        return 1.0;
      }
      if (hipismoGanadorList.length > 0) {
        return Math.max(...hipismoGanadorList.map((h) => Number(h.dividend) || 1.0));
      }
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
  // En animalitos y en hipismo simple multiejemplar, el monto es la suma de los montos de cada selección.
  const stakeAmount = type === 'animalitos'
    ? animalitosTotal
    : (isHipismoMultiple ? hipismoGanadorTotal : amountNumber);
  const potentialPayout = isHipismoMultiple
    ? Number(hipismoMaxPotentialPayout.toFixed(2))
    : (stakeAmount > 0 && currentOdds > 0 ? Number((stakeAmount * currentOdds).toFixed(2)) : 0);

  const overMaxBet = maxBet !== null && stakeAmount > Number(maxBet);
  const overMaxPayout = maxPayout !== null && potentialPayout > Number(maxPayout);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (type !== 'animalitos' && !isHipismoMultiple && (!amountNumber || amountNumber <= 0)) {
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
      if (hipismoBetType === 'cinco_y_seis') {
        if (!hipismoMeeting) {
          setError('Debes seleccionar la reunión programada para el 5 y 6.');
          return;
        }
        if (meetingValidRaces.length === 0) {
          setError(`No hay carreras válidas programadas para la reunión "${hipismoMeeting}".`);
          return;
        }
        if (missingValidas.length > 0) {
          setError(
            `El Cuadro del 5 y 6 exige al menos una marca por cada válida programada. Faltan marcas en: ${missingValidas.map((r) => r.name).join(', ')}.`
          );
          return;
        }

        const formattedSelections = meetingValidRaces.map((r) => ({
          race_id: r.id,
          horse_ids: cincoYSeisSelections[r.id] || [],
        }));

        payload = {
          type,
          bet_type: 'cinco_y_seis',
          meeting: hipismoMeeting,
          stake: amountNumber,
          selections: formattedSelections,
        };
      } else {
        if (!raceId) {
          setError('Debes seleccionar la carrera a jugar.');
          return;
        }
        if (hipismoGanadorList.length === 0) {
          setError('Debes seleccionar al menos un ejemplar.');
          return;
        }
        if (hipismoGanadorList.some((h) => !(h.numericAmount > 0))) {
          setError('Cada ejemplar seleccionado debe tener un monto jugado mayor a 0.');
          return;
        }
        if (hipismoGanadorTotal <= 0) {
          setError('El monto total del ticket debe ser mayor a 0.');
          return;
        }

        payload = {
          type,
          bet_type: hipismoBetType,
          stake: hipismoGanadorTotal,
          race_id: Number(raceId),
          horses: hipismoGanadorList.map((h) => ({
            horse_id: Number(h.id),
            amount: h.numericAmount,
          })),
        };
      }
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
      setCincoYSeisSelections({});
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
            Tope por Apuesta: <strong style={{ color: 'var(--palette-cashout, #10B981)', fontFamily: 'var(--font-mono)' }}>{formatLimit(maxBet)}</strong>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Ganancia Máx. por Ticket: <strong style={{ color: 'var(--accent-sky, #38BDF8)', fontFamily: 'var(--font-mono)' }}>{formatLimit(maxPayout)}</strong>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Modalidad de Hipismo
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${hipismoBetType === 'ganador' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setHipismoBetType('ganador'); setHipismoSelectedHorses({}); }}
                  >
                    🏇 Ganador (Simple)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${hipismoBetType === 'cinco_y_seis' ? 'btn-primary' : 'btn-secondary'}`}
                    style={hipismoBetType === 'cinco_y_seis' ? { background: '#f59e0b', borderColor: '#d97706', color: '#000', fontWeight: 700 } : {}}
                    onClick={() => { setHipismoBetType('cinco_y_seis'); setHipismoSelectedHorses({}); }}
                  >
                    ⭐ Cuadro del 5 y 6
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${hipismoBetType === 'place' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setHipismoBetType('place'); setHipismoSelectedHorses({}); }}
                  >
                    Place
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${hipismoBetType === 'exacta' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setHipismoBetType('exacta'); setHipismoSelectedHorses({}); }}
                  >
                    Exacta
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${hipismoBetType === 'trifecta' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setHipismoBetType('trifecta'); setHipismoSelectedHorses({}); }}
                  >
                    Trifecta
                  </button>
                </div>
              </div>

              {/* JUGADA DEL 5 Y 6 (CUADRO) */}
              {hipismoBetType === 'cinco_y_seis' ? (
                <div>
                  <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
                    <div className="form-row" style={{ alignItems: 'center', marginBottom: 0 }}>
                      <div className="form-field" style={{ flex: 1 }}>
                        <label htmlFor="meeting-select" style={{ fontWeight: 600 }}>📍 Reunión / Jornada Oficial</label>
                        <select
                          id="meeting-select"
                          className="input"
                          value={hipismoMeeting}
                          onChange={(e) => {
                            setHipismoMeeting(e.target.value);
                            setCincoYSeisSelections({});
                          }}
                          required
                        >
                          <option value="">-- Selecciona una reunión --</option>
                          {hipismoMeetings.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      {hipismoMeeting && (
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', paddingTop: '1.25rem' }}>
                          <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                            🏇 {meetingValidRaces.length} Válidas Programadas
                          </span>
                          <span className="badge" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700 }}>
                            🎫 {cincoYSeisCombinations} Cuadro{cincoYSeisCombinations === 1 ? '' : 's'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Alerta de Validación de Válidas */}
                  {meetingValidRaces.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      {missingValidas.length > 0 ? (
                        <div className="alert alert-error" style={{ marginBottom: 0, fontSize: '0.88rem' }}>
                          ⚠️ <strong>Regla del 5 y 6:</strong> Debes marcar al menos un ejemplar en cada válida programada para poder emitir el ticket.
                          <div style={{ marginTop: '0.35rem', color: '#fca5a5' }}>
                            Faltan marcas en: <strong>{missingValidas.map((r) => r.valida_number ? `${r.valida_number}ª Válida (${r.name})` : r.name).join(', ')}</strong>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: 'rgba(52, 211, 153, 0.12)', border: '1px solid #34d399', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>✓ ¡Todas las válidas tienen al menos una marca! Cuadro listo para ser emitido.</span>
                          <strong>Total: {cincoYSeisCombinations} combinación{cincoYSeisCombinations === 1 ? '' : 'es'}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {meetingValidRaces.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--bg-input)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                      {hipismoMeeting
                        ? `No se encontraron carreras válidas programadas para "${hipismoMeeting}".`
                        : 'Por favor selecciona una reunión para cargar sus válidas.'}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                      {meetingValidRaces.map((race, idx) => {
                        const validaNum = race.valida_number || idx + 1;
                        const markedHorseIds = cincoYSeisSelections[race.id] || [];
                        const isCovered = markedHorseIds.length > 0;

                        return (
                          <div
                            key={race.id}
                            style={{
                              background: 'var(--bg-input)',
                              borderRadius: '8px',
                              border: isCovered ? '1px solid var(--border-medium)' : '1px dashed #ef4444',
                              padding: '1rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  {validaNum}ª Válida
                                </span>
                                <h4 style={{ margin: '0.1rem 0 0', fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                                  {race.name}
                                </h4>
                              </div>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  background: markedHorseIds.length === 0
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : markedHorseIds.length === 1
                                    ? 'rgba(52, 211, 153, 0.15)'
                                    : 'rgba(56, 189, 248, 0.15)',
                                  color: markedHorseIds.length === 0
                                    ? '#ef4444'
                                    : markedHorseIds.length === 1
                                    ? '#34d399'
                                    : '#38bdf8',
                                  border: `1px solid ${
                                    markedHorseIds.length === 0 ? '#ef4444' : markedHorseIds.length === 1 ? '#34d399' : '#38bdf8'
                                  }`,
                                }}
                              >
                                {markedHorseIds.length === 0
                                  ? 'Sin marca'
                                  : markedHorseIds.length === 1
                                  ? '1 Línea ⭐'
                                  : `${markedHorseIds.length} Marcas`}
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {race.horses?.map((horse) => {
                                const isSelected = markedHorseIds.includes(horse.id);

                                return (
                                  <button
                                    key={horse.id}
                                    type="button"
                                    onClick={() => toggleCincoYSeisHorse(race.id, horse.id)}
                                    disabled={horse.is_retired}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.5rem 0.75rem',
                                      borderRadius: '6px',
                                      border: isSelected ? '1.5px solid #34d399' : '1px solid var(--border-subtle)',
                                      background: isSelected ? 'rgba(52, 211, 153, 0.12)' : 'var(--bg-surface)',
                                      cursor: horse.is_retired ? 'not-allowed' : 'pointer',
                                      opacity: horse.is_retired ? 0.5 : 1,
                                      transition: 'all 0.15s ease',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span
                                        style={{
                                          width: '24px',
                                          height: '24px',
                                          borderRadius: '50%',
                                          background: isSelected ? '#34d399' : 'var(--bg-input)',
                                          color: isSelected ? '#000' : 'var(--text-primary)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 700,
                                          fontSize: '0.78rem',
                                        }}
                                      >
                                        {horse.number}
                                      </span>
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: isSelected ? 700 : 500, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                                          {horse.name}
                                          {horse.is_retired && <span style={{ color: '#ef4444', fontSize: '0.75rem', marginLeft: '0.4rem' }}>(Retirado)</span>}
                                        </span>
                                        {horse.jockey && (
                                          <span style={{ fontSize: '0.74rem', color: isSelected ? '#a7f3d0' : '#94a3b8' }}>
                                            Jinete: {horse.jockey}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <span style={{ fontSize: '0.8rem', color: isSelected ? '#34d399' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                                        x{horse.dividend}
                                      </span>
                                      {isSelected && <span style={{ color: '#34d399', fontWeight: 800, fontSize: '0.9rem' }}>✓</span>}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* JUGADAS INDIVIDUALES (GANADOR SIMPLE, PLACE, EXACTA, TRIFECTA) */
                <div>
                  <div className="form-row" style={{ marginBottom: selectedRace ? '1rem' : 0 }}>
                    <div className="form-field" style={{ flex: 1 }}>
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
                  </div>

                  {selectedRace && (
                    <div style={{ marginTop: '0.75rem' }}>
                      {/* Cabecera y detalles de la carrera */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          background: 'var(--bg-canvas-subtle)',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          marginBottom: '1rem',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                            {selectedRace.name}
                          </strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                            · {selectedRace.track || 'Hipódromo'} {selectedRace.meeting ? `(${selectedRace.meeting})` : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                            {selectedRace.horses?.filter((h) => !h.is_retired).length || 0} ejemplares disponibles
                          </span>
                        </div>
                      </div>

                      {/* Barra de herramientas para montos rápidos */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          background: 'rgba(56, 189, 248, 0.05)',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          marginBottom: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            Monto rápido:
                          </span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="input input-sm"
                            style={{ width: '85px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                            value={quickHorseAmount}
                            onChange={(e) => setQuickHorseAmount(e.target.value)}
                            placeholder="10.00"
                          />
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {['5', '10', '20', '50', '100'].map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setQuickHorseAmount(amt);
                                  applyQuickAmountToSelected(amt);
                                }}
                              >
                                {amt}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.78rem', borderColor: 'var(--accent-sky)', color: 'var(--accent-sky)' }}
                            onClick={() => applyQuickAmountToSelected(quickHorseAmount)}
                          >
                            Aplicar a marcados
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => selectAllHorsesInRace(quickHorseAmount)}
                          >
                            Seleccionar Todos
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem' }}
                            onClick={clearAllHorsesInRace}
                          >
                            Limpiar
                          </button>
                        </div>
                      </div>

                      {/* Lista de Caballos en tarjetas interactivas */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                        {selectedRace.horses
                          ?.filter((h) => !h.is_retired)
                          ?.map((h) => {
                            const isSelected = !!hipismoSelectedHorses[h.id]?.selected;
                            const currentAmount = hipismoSelectedHorses[h.id]?.amount ?? '';
                            const numAmount = Number(currentAmount) || 0;
                            const dividend = Number(h.dividend) > 0 ? Number(h.dividend) : 1.0;
                            const potWin = numAmount > 0 ? (numAmount * dividend).toFixed(2) : null;

                            return (
                              <div
                                key={h.id}
                                style={{
                                  background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '0.75rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  gap: '0.5rem',
                                  boxShadow: isSelected ? '0 0 12px rgba(225, 29, 72, 0.25)' : 'none',
                                  transition: 'all 0.15s ease-in-out',
                                }}
                              >
                                <div
                                  style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer' }}
                                  onClick={() => toggleHorseSelection(h.id)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    style={{ marginTop: '0.2rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                                  />
                                  <div
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      background: isSelected ? 'var(--primary)' : 'var(--bg-canvas-subtle)',
                                      color: isSelected ? '#fff' : 'var(--text-primary)',
                                      fontWeight: 800,
                                      fontSize: '0.85rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      border: '1px solid var(--border-medium)',
                                    }}
                                  >
                                    {h.number}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <strong
                                      style={{
                                        display: 'block',
                                        fontSize: '0.92rem',
                                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {h.name}
                                    </strong>
                                    {h.jockey && (
                                      <span style={{ fontSize: '0.75rem', color: '#38bdf8', display: 'block' }}>
                                        J: {h.jockey}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '4px',
                                        background: Number(h.dividend) > 0 ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-canvas-subtle)',
                                        color: Number(h.dividend) > 0 ? '#10b981' : 'var(--text-tertiary)',
                                        border: '1px solid var(--border-subtle)',
                                      }}
                                    >
                                      {Number(h.dividend) > 0 ? `x${Number(h.dividend).toFixed(2)}` : 'Div. oficial'}
                                    </span>
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    borderTop: '1px dashed var(--border-subtle)',
                                    paddingTop: '0.5rem',
                                    marginTop: '0.25rem',
                                  }}
                                >
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                                    Monto:
                                  </span>
                                  <div style={{ position: 'relative', flex: 1 }}>
                                    <span
                                      style={{
                                        position: 'absolute',
                                        left: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        fontSize: '0.78rem',
                                        color: 'var(--text-tertiary)',
                                        pointerEvents: 'none',
                                      }}
                                    >
                                      Bs.
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      placeholder="0.00"
                                      value={currentAmount}
                                      disabled={!isSelected}
                                      onChange={(e) => updateHorseAmount(h.id, e.target.value)}
                                      onFocus={() => {
                                        if (!isSelected) toggleHorseSelection(h.id);
                                      }}
                                      className="input input-sm"
                                      style={{
                                        paddingLeft: '28px',
                                        height: '32px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        background: isSelected ? 'var(--bg-input)' : 'transparent',
                                      }}
                                    />
                                  </div>
                                  {potWin && (
                                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, flexShrink: 0 }}>
                                      Paga: Bs. {potWin}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {/* Resumen interactivo al pie de la carrera */}
                      <div
                        style={{
                          marginTop: '1rem',
                          padding: '0.85rem 1rem',
                          background: 'var(--bg-canvas-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Ejemplares seleccionados:
                          </span>
                          <strong style={{ fontSize: '0.95rem', color: '#38bdf8' }}>
                            {hipismoGanadorList.length}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Monto Total del Ticket:
                          </span>
                          <strong style={{ fontSize: '1.2rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                            {formatAmount(hipismoGanadorTotal)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}
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
                              <span style={{ fontSize: '0.82rem', color: 'var(--accent-sky, #38BDF8)', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
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
                                      className={`btn btn-sm ${isSelected ? 'btn-primary odd-selected' : 'btn-secondary'}`}
                                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem' }}
                                      onClick={() => handleAddSelection(mkt, sel)}
                                    >
                                      <span>{label}</span>
                                      <strong style={{ color: isSelected ? '#ffffff' : 'var(--accent-sky, #38BDF8)', fontFamily: 'var(--font-mono)' }}>
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
              {type !== 'animalitos' && !isHipismoMultiple && (
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

              {isHipismoMultiple && (
                <div className="form-field">
                  <label htmlFor="stake-hipismo-readonly">Total a Apostar (Ticket)</label>
                  <input
                    id="stake-hipismo-readonly"
                    className="input"
                    type="text"
                    value={formatAmount(hipismoGanadorTotal)}
                    readOnly
                    disabled
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Suma de los montos de cada caballo jugado ({hipismoGanadorList.length} ejemplar{hipismoGanadorList.length === 1 ? '' : 'es'}).
                  </span>
                </div>
              )}

              {type === 'hipismo' && hipismoBetType === 'cinco_y_seis' ? (
                <div style={{ background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Total Cuadros (Combinaciones)</span>
                  <strong style={{ fontSize: '1.25rem', color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                    {cincoYSeisCombinations} cuadro{cincoYSeisCombinations === 1 ? '' : 's'}
                  </strong>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>
                    {isHipismoMultiple ? 'Ejemplares Jugados' : 'Cuota / Multiplicador'}
                  </span>
                  <strong style={{ fontSize: '1.25rem', color: isHipismoMultiple ? '#38bdf8' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {isHipismoMultiple
                      ? `${hipismoGanadorList.length} caballo${hipismoGanadorList.length === 1 ? '' : 's'}`
                      : currentOdds > 0 ? `x${currentOdds.toFixed(2)}` : '—'}
                  </strong>
                </div>
              )}

              <div style={{ background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>
                  {isHipismoMultiple ? 'Premio Potencial (Máx)' : 'Premio Potencial'}
                </span>
                <strong style={{ fontSize: '1.35rem', color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                  {type === 'hipismo' && hipismoBetType === 'cinco_y_seis'
                    ? 'Pozo / Dividendo 5 y 6'
                    : potentialPayout > 0 ? formatAmount(potentialPayout) : '—'}
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

            {type === 'hipismo' && hipismoBetType === 'cinco_y_seis' && (
              <div style={{ marginBottom: '1rem', fontSize: '0.88rem' }}>
                {missingValidas.length > 0 ? (
                  <div className="alert alert-error" style={{ margin: 0 }}>
                    ⚠️ No se puede emitir el ticket. Faltan marcas en: <strong>{missingValidas.map((r) => r.valida_number ? `${r.valida_number}ª Válida` : r.name).join(', ')}</strong>.
                  </div>
                ) : (
                  <div className="alert alert-info" style={{ margin: 0, color: '#34d399', borderColor: '#34d399' }}>
                    ℹ Cuadro del 5 y 6 completo con {cincoYSeisCombinations} combinaciones para <strong>{hipismoMeeting}</strong>.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Link className="btn btn-secondary" to="/taquilla">
                Cancelar
              </Link>
              <button
                type="submit"
                className="btn-print-ticket"
                disabled={
                  saving ||
                  overMaxBet ||
                  overMaxPayout ||
                  stakeAmount <= 0 ||
                  (type === 'animalitos' && (!drawTime || animalRows.length === 0)) ||
                  (type === 'hipismo' && hipismoBetType === 'cinco_y_seis' && (meetingValidRaces.length === 0 || missingValidas.length > 0)) ||
                  (isHipismoMultiple && (!raceId || hipismoGanadorList.length === 0 || hipismoGanadorTotal <= 0)) ||
                  (type === 'parley' && selections.length < 2)
                }
                style={{ minWidth: '200px' }}
              >
                {saving ? 'Registrando...' : '🎟️ Emitir e Imprimir'}
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
              <div data-print="hide" style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.45rem' }}>
                <MatrixBetIcon size={34} />
              </div>
              <strong style={{ fontSize: '1.2rem', display: 'block', color: 'var(--text-primary)', letterSpacing: '1px' }}>
                MATRIX BET
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
                  <strong>
                    {lastCreatedTicket.horse_racing_bet?.bet_type
                      ? `Hipismo (${HORSE_BET_TYPE_LABELS[lastCreatedTicket.horse_racing_bet.bet_type] || lastCreatedTicket.horse_racing_bet.bet_type})`
                      : (TICKET_TYPE_LABELS[lastCreatedTicket.type] ?? lastCreatedTicket.type)}
                  </strong>
                </div>
                {lastCreatedTicket.horse_racing_bet?.combinations_count > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Combinaciones:</span>
                    <strong style={{ color: '#f59e0b' }}>
                      {lastCreatedTicket.horse_racing_bet.combinations_count} cuadros
                    </strong>
                  </div>
                )}

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
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{sel.market || (isHipismo ? 'Ganador' : 'Apuesta')}</span>
                          {(sel.amount !== null && sel.amount !== undefined) && (
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              Monto: {formatAmount(sel.amount)}
                            </span>
                          )}
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
                className="btn-print-ticket"
                onClick={() => printTicket()}
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.88rem' }}
              >
                <Printer size={16} />
                <span>🖨️ Imprimir Ticket</span>
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