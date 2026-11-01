import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { todayISO } from '../utils/parley';
import { showConfirm } from '../utils/swal';

function formatRaceDate(value) {
  if (!value) return '—';
  const [date, time] = value.split('T');
  if (!date) return value;
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}${time ? ` ${time}` : ''}`;
}

const HIPODROMOS_COMUNES = [
  'La Rinconada',
  'Valencia',
  'Rancho Alegre',
  'Gulfstream Park',
  'Tampa Bay Downs',
  'Aqueduct',
  'Santa Anita',
];

const emptyHorseRow = (num = 1) => ({
  number: String(num),
  name: '',
  jockey: '',
  dividend: '',
});

const defaultHorsesList = () => [
  emptyHorseRow(1),
  emptyHorseRow(2),
  emptyHorseRow(3),
  emptyHorseRow(4),
  emptyHorseRow(5),
  emptyHorseRow(6),
];

export default function Races() {
  const [activeTab, setActiveTab] = useState('programming'); // 'programming' | 'results'
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estados para filtro, agrupación y edición en el listado de programación y reuniones
  const [groupByMeeting, setGroupByMeeting] = useState(true);
  const [collapsedMeetings, setCollapsedMeetings] = useState({});
  const [filterProgrammingMeeting, setFilterProgrammingMeeting] = useState('all');
  const [editingRace, setEditingRace] = useState(null);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);

  // Estados para la pestaña de Resultados y Ganadores
  const [resultsDraft, setResultsDraft] = useState({});
  const [savingResultId, setSavingResultId] = useState(null);
  const [retiringHorseId, setRetiringHorseId] = useState(null);
  const [filterMeeting, setFilterMeeting] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Formulario de Reunión + Carrera
  const [form, setForm] = useState({
    track: 'La Rinconada',
    meeting: 'Reunión 42',
    date: todayISO(),
    time: '13:30',
    name: '1ra Carrera',
    is_valida: false,
    valida_number: '',
    horses: defaultHorsesList(),
  });

  const loadRaces = async () => {
    try {
      const response = await api.get('/admin/races');
      const data = response.data.data;
      setRaces(data);

      // Sincronizar borrador de resultados con los ganadores existentes y sus dividendos oficiales
      const draft = {};
      data.forEach((r) => {
        draft[r.id] = {
          winner_horse_id: r.winner_horse_id ? String(r.winner_horse_id) : '',
          winner_dividend: r.winner?.dividend ? String(r.winner.dividend) : '',
          second_horse_id: r.second_horse_id ? String(r.second_horse_id) : '',
          second_dividend: r.second?.dividend ? String(r.second.dividend) : '',
          third_horse_id: r.third_horse_id ? String(r.third_horse_id) : '',
        };
      });
      setResultsDraft(draft);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRaces();
  }, []);

  const updateHorse = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      horses: prev.horses.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  };

  const addHorse = () => {
    setForm((prev) => {
      const numbers = prev.horses.map((h) => Number(h.number) || 0);
      const nextNum = numbers.length ? Math.max(...numbers) + 1 : 1;
      return {
        ...prev,
        horses: [...prev.horses, emptyHorseRow(nextNum)],
      };
    });
  };

  const removeHorse = (index) => {
    setForm((prev) => ({
      ...prev,
      horses: prev.horses.filter((_, i) => i !== index),
    }));
  };

  const populateQuickHorses = (count) => {
    const list = [];
    for (let i = 1; i <= count; i++) {
      list.push(emptyHorseRow(i));
    }
    setForm((prev) => ({ ...prev, horses: list }));
  };

  // Precargar formulario para la siguiente carrera de una reunión existente
  const handleAddNextRaceToMeeting = (existingRace) => {
    const sameMeetingRaces = races.filter(
      (r) => r.meeting === existingRace.meeting && r.track === existingRace.track
    );
    const nextRaceNumber = sameMeetingRaces.length + 1;
    const sameMeetingValidas = sameMeetingRaces.filter((r) => r.is_valida);
    const nextValidaNumber = sameMeetingValidas.length < 6 ? sameMeetingValidas.length + 1 : '';

    setForm({
      track: existingRace.track || 'La Rinconada',
      meeting: existingRace.meeting || 'Reunión 1',
      date: existingRace.race_date ? existingRace.race_date.slice(0, 10) : todayISO(),
      time: '14:00',
      name: `${nextRaceNumber}da Carrera${nextValidaNumber ? ` (${nextValidaNumber}ª Válida)` : ''}`,
      is_valida: Boolean(nextValidaNumber),
      valida_number: nextValidaNumber ? String(nextValidaNumber) : '',
      horses: defaultHorsesList(),
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSuccess(`Formulario precargado para añadir la ${nextRaceNumber}da Carrera a "${existingRace.meeting}".`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name.trim()) {
      setError('Debes indicar el nombre de la carrera (ej: 1ra Carrera).');
      return;
    }

    // Validar caballos
    const horsesToSubmit = form.horses.map((h) => ({
      number: Number(h.number),
      name: h.name.trim(),
      jockey: h.jockey && h.jockey.trim() ? h.jockey.trim() : null,
      dividend: h.dividend && !isNaN(Number(h.dividend)) && Number(h.dividend) >= 0 ? Number(h.dividend) : 0,
    }));

    if (horsesToSubmit.length === 0) {
      setError('Debes registrar al menos un caballo inscrito en la carrera.');
      return;
    }

    if (horsesToSubmit.some((h) => !Number.isInteger(h.number) || h.number < 1 || h.number > 99)) {
      setError('Todos los números de caballo deben ser enteros positivos entre 1 y 99.');
      return;
    }

    if (horsesToSubmit.some((h) => !h.name)) {
      setError('Todos los caballos deben tener un nombre.');
      return;
    }

    const numbersSet = new Set(horsesToSubmit.map((h) => h.number));
    if (numbersSet.size !== horsesToSubmit.length) {
      setError('No pueden existir números de caballos repetidos en la misma carrera.');
      return;
    }

    setSaving(true);

    try {
      const fullDateTime = form.date ? `${form.date}T${form.time || '12:00'}` : null;

      await api.post('/admin/races', {
        name: form.name.trim(),
        meeting: form.meeting.trim() || null,
        track: form.track.trim() || null,
        race_date: fullDateTime,
        is_valida: Boolean(form.is_valida),
        valida_number: form.is_valida && form.valida_number ? Number(form.valida_number) : null,
        horses: horsesToSubmit,
      });

      setSuccess(`✅ ${form.name} de "${form.meeting || 'Jornada'}" registrada con éxito (${horsesToSubmit.length} ejemplares inscritos).`);

      // Sugerir la siguiente carrera de la misma reunión
      const nextNum = parseInt(form.name.replace(/\D/g, ''), 10);
      const nextRaceStr = !isNaN(nextNum) ? `${nextNum + 1}da Carrera` : 'Siguiente Carrera';
      const nextValidaNum = form.is_valida && Number(form.valida_number) < 6 ? Number(form.valida_number) + 1 : '';

      setForm((prev) => ({
        ...prev,
        name: nextRaceStr,
        is_valida: Boolean(nextValidaNum),
        valida_number: nextValidaNum ? String(nextValidaNum) : '',
        horses: defaultHorsesList(),
      }));

      await loadRaces();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (race) => {
    const isConfirmed = await showConfirm({
      title: '¿Eliminar carrera?',
      text: `¿Eliminar la carrera "${race.name}" y todos sus ejemplares inscritos?`,
      confirmButtonText: 'Sí, eliminar',
      isDestructive: true,
    });

    if (!isConfirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/admin/races/${race.id}`);
      setSuccess('Carrera eliminada correctamente.');
      await loadRaces();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // Handlers para la pestaña de Ganadores y Validación de Taquilla
  const handlePodiumChange = (raceId, field, value) => {
    setResultsDraft((prev) => ({
      ...prev,
      [raceId]: {
        ...(prev[raceId] || {}),
        [field]: value,
      },
    }));
  };

  const handleWinnerSelect = (raceId, horseId, horses) => {
    const selectedHorse = horses.find((h) => String(h.id) === String(horseId));
    setResultsDraft((prev) => {
      const prevDraft = prev[raceId] || {};
      const currentDiv = prevDraft.winner_dividend;
      const autoDiv = selectedHorse?.dividend && Number(selectedHorse.dividend) > 0 ? String(selectedHorse.dividend) : '';
      return {
        ...prev,
        [raceId]: {
          ...prevDraft,
          winner_horse_id: horseId,
          winner_dividend: currentDiv || autoDiv,
        },
      };
    });
  };

  const handleSaveRaceResult = async (race) => {
    setError(null);
    setSuccess(null);
    setSavingResultId(race.id);

    const draft = resultsDraft[race.id] || {};
    const winnerId = draft.winner_horse_id ? Number(draft.winner_horse_id) : null;
    const winnerDividend = draft.winner_dividend && !isNaN(Number(draft.winner_dividend)) ? Number(draft.winner_dividend) : null;
    const secondId = draft.second_horse_id ? Number(draft.second_horse_id) : null;
    const secondDividend = draft.second_dividend && !isNaN(Number(draft.second_dividend)) ? Number(draft.second_dividend) : null;
    const thirdId = draft.third_horse_id ? Number(draft.third_horse_id) : null;

    if (!winnerId && (secondId || thirdId)) {
      setError('Debes seleccionar al menos el 1er Lugar (Ganador Oficial) para registrar el podio.');
      setSavingResultId(null);
      return;
    }

    try {
      const res = await api.put(`/admin/races/${race.id}/result`, {
        winner_horse_id: winnerId,
        winner_dividend: winnerDividend,
        second_horse_id: secondId,
        second_dividend: secondDividend,
        third_horse_id: thirdId,
      });

      const updated = res.data.data;
      setRaces((prev) => prev.map((r) => (r.id === race.id ? updated : r)));

      if (updated.winner) {
        setSuccess(
          `🏆 ¡Ganador oficial registrado para ${race.name} de "${race.meeting || 'Jornada'}"! Ejemplar: N° ${updated.winner.number} - ${updated.winner.name} (Dividendo: Bs. ${Number(updated.winner.dividend).toFixed(2)}). Taquilla ya puede pagar los tickets ganadores de esta carrera de forma automática.`
        );
      } else {
        setSuccess(`Resultados de "${race.name}" restablecidos.`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingResultId(null);
    }
  };

  const handleToggleHorseRetire = async (race, horse) => {
    setError(null);
    setSuccess(null);
    setRetiringHorseId(horse.id);

    try {
      await api.patch(`/admin/races/${race.id}/horses/${horse.id}/retire`, {
        is_retired: !horse.is_retired,
      });

      // Si el caballo estaba en el borrador del podio, removerlo
      if (!horse.is_retired) {
        setResultsDraft((prev) => {
          const raceDraft = { ...(prev[race.id] || {}) };
          if (String(raceDraft.winner_horse_id) === String(horse.id)) raceDraft.winner_horse_id = '';
          if (String(raceDraft.second_horse_id) === String(horse.id)) raceDraft.second_horse_id = '';
          if (String(raceDraft.third_horse_id) === String(horse.id)) raceDraft.third_horse_id = '';
          return { ...prev, [race.id]: raceDraft };
        });
      }

      await loadRaces();
      setSuccess(
        horse.is_retired
          ? `Ejemplar N° ${horse.number} (${horse.name}) habilitado nuevamente para apuestas y resultados.`
          : `Ejemplar N° ${horse.number} (${horse.name}) marcado como RETIRADO. No podrá recibir apuestas ni figurar en resultados.`
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRetiringHorseId(null);
    }
  };

  // Handlers para edición de registros de carrera y de reunión completa
  const openEditRace = (race) => {
    const dateStr = race.race_date ? race.race_date.slice(0, 10) : todayISO();
    const timeStr = race.race_date && race.race_date.includes('T')
      ? race.race_date.split('T')[1].slice(0, 5)
      : '13:30';

    setEditingRace({
      id: race.id,
      name: race.name,
      meeting: race.meeting || '',
      track: race.track || 'La Rinconada',
      date: dateStr,
      time: timeStr,
      is_valida: Boolean(race.is_valida),
      valida_number: race.valida_number !== null && race.valida_number !== undefined ? String(race.valida_number) : '',
    });
    setError(null);
    setSuccess(null);
  };

  const handleSaveEditRace = async (e) => {
    e.preventDefault();
    if (!editingRace || !editingRace.name.trim()) {
      setError('El nombre de la carrera es obligatorio.');
      return;
    }

    setModalSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const fullDateTime = editingRace.date
        ? `${editingRace.date}T${editingRace.time || '12:00'}`
        : null;

      await api.put(`/admin/races/${editingRace.id}`, {
        name: editingRace.name.trim(),
        meeting: editingRace.meeting ? editingRace.meeting.trim() : null,
        track: editingRace.track ? editingRace.track.trim() : null,
        race_date: fullDateTime,
        is_valida: Boolean(editingRace.is_valida),
        valida_number: editingRace.is_valida && editingRace.valida_number ? Number(editingRace.valida_number) : null,
      });

      setSuccess(`✅ Registro de "${editingRace.name}" actualizado correctamente.`);
      setEditingRace(null);
      await loadRaces();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setModalSaving(false);
    }
  };

  const openEditMeeting = (meetingName) => {
    const sample = races.find((r) => r.meeting === meetingName);
    setEditingMeeting({
      current_meeting: meetingName,
      new_meeting: meetingName,
      track: sample?.track || 'La Rinconada',
    });
    setError(null);
    setSuccess(null);
  };

  const handleSaveEditMeeting = async (e) => {
    e.preventDefault();
    if (!editingMeeting || !editingMeeting.new_meeting.trim()) {
      setError('Debes indicar el nuevo nombre para la reunión.');
      return;
    }

    setModalSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.put('/admin/meetings/update', {
        current_meeting: editingMeeting.current_meeting,
        new_meeting: editingMeeting.new_meeting.trim(),
        track: editingMeeting.track ? editingMeeting.track.trim() : null,
      });

      setSuccess(`✅ ${response.data.message}`);
      if (filterProgrammingMeeting === editingMeeting.current_meeting) {
        setFilterProgrammingMeeting(editingMeeting.new_meeting.trim());
      }
      setEditingMeeting(null);
      await loadRaces();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setModalSaving(false);
    }
  };

  // Filtros y listas computadas
  const meetingsList = Array.from(new Set(races.map((r) => r.meeting).filter(Boolean)));
  const pendingResultsCount = races.filter((r) => r.status !== 'finished').length;

  const filteredProgrammingRaces = races.filter((race) => {
    if (filterProgrammingMeeting !== 'all' && race.meeting !== filterProgrammingMeeting) return false;
    return true;
  });

  const toggleMeetingCollapse = (meetingName) => {
    setCollapsedMeetings((prev) => ({
      ...prev,
      [meetingName]: !prev[meetingName],
    }));
  };

  // Agrupación de carreras de una misma reunión
  const groupedRaces = useMemo(() => {
    const groups = {};
    filteredProgrammingRaces.forEach((race) => {
      const key = race.meeting && race.meeting.trim() ? race.meeting.trim() : 'Sin Reunión Asignada';
      if (!groups[key]) {
        groups[key] = {
          meeting: key,
          track: race.track || '—',
          date: race.race_date,
          races: [],
        };
      }
      groups[key].races.push(race);
    });
    return Object.values(groups);
  }, [filteredProgrammingRaces]);

  const filteredResultsRaces = races.filter((race) => {
    if (filterMeeting !== 'all' && race.meeting !== filterMeeting) return false;
    if (filterStatus === 'pending' && race.status === 'finished') return false;
    if (filterStatus === 'finished' && race.status !== 'finished') return false;
    return true;
  });

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Hipismo</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
            Crea la jornada (Reunión e Hipódromo), añade carrera por carrera con sus ejemplares inscritos y gestiona sus resultados.
          </p>
        </div>
      </header>

      {/* Selector de Pestañas del Módulo de Hipismo */}
      <div className="module-tabs">
        <button
          type="button"
          className={`module-tab-btn ${activeTab === 'programming' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('programming');
            setError(null);
            setSuccess(null);
          }}
        >
          <span>📅 Programación de Carreras</span>
          <span className="module-tab-badge">{races.length}</span>
        </button>

        <button
          type="button"
          className={`module-tab-btn ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('results');
            setError(null);
            setSuccess(null);
          }}
        >
          <span>🏆 Cargar Ganadores y Validar Pagos</span>
          {pendingResultsCount > 0 ? (
            <span
              className="module-tab-badge"
              style={{ background: '#f59e0b', color: '#0f172a' }}
            >
              {pendingResultsCount} pendientes
            </span>
          ) : (
            <span
              className="module-tab-badge"
              style={{ background: '#10b981', color: '#fff' }}
            >
              ✓ Al día
            </span>
          )}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* PESTAÑA 1: PROGRAMACIÓN DE CARRERAS */}
      {activeTab === 'programming' && (
        <>
          {/* Formulario de Registro de Reunión y Carrera */}
          <section className="card">
            <h2 className="card-title">Programar Nueva Carrera en Jornada / Reunión</h2>

        <form onSubmit={handleSubmit}>
          {/* Bloque 1: Datos de la Jornada / Reunión */}
          <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700 }}>
              📍 1. Datos de la Jornada / Hipódromo
            </h3>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="race-track">Hipódromo</label>
                <input
                  id="race-track"
                  className="input"
                  type="text"
                  list="hipodromos-list"
                  value={form.track}
                  onChange={(e) => setForm({ ...form, track: e.target.value })}
                  placeholder="Ej: La Rinconada"
                  required
                />
                <datalist id="hipodromos-list">
                  {HIPODROMOS_COMUNES.map((h) => (
                    <option key={h} value={h} />
                  ))}
                </datalist>
              </div>

              <div className="form-field">
                <label htmlFor="race-meeting">N° de Reunión / Jornada</label>
                <input
                  id="race-meeting"
                  className="input"
                  type="text"
                  value={form.meeting}
                  onChange={(e) => setForm({ ...form, meeting: e.target.value })}
                  placeholder="Ej: Reunión 42"
                  required
                />
              </div>

              <div className="form-field" style={{ maxWidth: '170px' }}>
                <label htmlFor="race-date">Fecha de la jornada</label>
                <input
                  id="race-date"
                  className="input"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>

              <div className="form-field" style={{ maxWidth: '130px' }}>
                <label htmlFor="race-time">Hora partida</label>
                <input
                  id="race-time"
                  className="input"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label htmlFor="race-name">Nombre / N° Carrera</label>
                <input
                  id="race-name"
                  className="input"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: 1ra Carrera"
                  required
                />
              </div>

              <div className="form-field" style={{ minWidth: '190px' }}>
                <label htmlFor="race-is-valida" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontWeight: 600, color: form.is_valida ? '#f59e0b' : 'inherit' }}>
                  <input
                    id="race-is-valida"
                    type="checkbox"
                    checked={form.is_valida}
                    onChange={(e) => setForm({ ...form, is_valida: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#f59e0b' }}
                  />
                  <span>⭐ Válida del 5 y 6</span>
                </label>
                {form.is_valida && (
                  <select
                    id="race-valida-number"
                    className="input input-sm"
                    style={{ marginTop: '0.4rem', borderColor: '#f59e0b' }}
                    value={form.valida_number}
                    onChange={(e) => setForm({ ...form, valida_number: e.target.value })}
                  >
                    <option value="">-- N° de Válida --</option>
                    <option value="1">1ª Válida (5 y 6)</option>
                    <option value="2">2ª Válida (5 y 6)</option>
                    <option value="3">3ª Válida (5 y 6)</option>
                    <option value="4">4ª Válida (5 y 6)</option>
                    <option value="5">5ª Válida (5 y 6)</option>
                    <option value="6">6ª Válida (5 y 6)</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Bloque 2: Caballos Inscritos */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                🐎 2. Ejemplares Inscritos ({form.horses.length} caballos)
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => populateQuickHorses(6)}
                >
                  6 Casillas
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => populateQuickHorses(8)}
                >
                  8 Casillas
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => populateQuickHorses(10)}
                >
                  10 Casillas
                </button>
              </div>
            </div>

            <div className="animal-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {form.horses.map((horse, index) => (
                <div key={index} className="animal-card" style={{ padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="badge-number">N°</span>
                      <input
                        className="input input-sm"
                        type="number"
                        min="1"
                        max="99"
                        value={horse.number}
                        onChange={(e) => updateHorse(index, 'number', e.target.value)}
                        style={{ width: '65px', textAlign: 'center', fontWeight: 700 }}
                        required
                      />
                    </div>

                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeHorse(index)}
                      title="Quitar este ejemplar"
                    >
                      Quitar
                    </button>
                  </div>

                  <input
                    className="input input-sm"
                    type="text"
                    placeholder="Nombre del Caballo (Ej: Gran Omero)"
                    value={horse.name}
                    onChange={(e) => updateHorse(index, 'name', e.target.value)}
                    required
                  />

                  <input
                    className="input input-sm"
                    type="text"
                    placeholder="Jinete / Jockey (Ej: R. Capriles)"
                    value={horse.jockey || ''}
                    onChange={(e) => updateHorse(index, 'jockey', e.target.value)}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      Dividendo (opcional):
                    </label>
                    <input
                      className="input input-sm"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Al ganar"
                      value={horse.dividend}
                      onChange={(e) => updateHorse(index, 'dividend', e.target.value)}
                      style={{ width: '95px' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addHorse}>
                + Agregar otro ejemplar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
            <button className="btn btn-primary" type="submit" disabled={saving} style={{ minWidth: '220px' }}>
              {saving ? 'Guardando carrera...' : '💾 Registrar Carrera e Inscritos'}
            </button>
          </div>
        </form>
      </section>

      {/* Lista de Carreras Registradas (con opción de agrupación por reunión) */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>Programación de Reuniones y Carreras</span>
              <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #0284c7', fontSize: '0.8rem', padding: '0.2rem 0.55rem' }}>
                {filteredProgrammingRaces.length} {filteredProgrammingRaces.length === 1 ? 'carrera' : 'carreras'}
              </span>
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Revisa, añade, corrige y gestiona las carreras organizadas por jornada y reunión.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Conmutador de vista: Agrupado por Reunión vs Lista Corrida */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-canvas-subtle)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                className={`meeting-toggle-btn ${groupByMeeting ? 'active' : ''}`}
                onClick={() => setGroupByMeeting(true)}
                title="Agrupar las carreras por cada reunión"
              >
                🗂️ Agrupado por Reunión
              </button>
              <button
                type="button"
                className={`meeting-toggle-btn ${!groupByMeeting ? 'active' : ''}`}
                onClick={() => setGroupByMeeting(false)}
                title="Ver todas las carreras en una sola tabla corrida"
              >
                📋 Lista corrida
              </button>
            </div>

            {/* Filtro selector de reunión */}
            {meetingsList.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <select
                  id="filter-prog-meeting"
                  className="input input-sm"
                  style={{ width: 'auto', minWidth: '170px' }}
                  value={filterProgrammingMeeting}
                  onChange={(e) => setFilterProgrammingMeeting(e.target.value)}
                >
                  <option value="all">Todas las reuniones</option>
                  {meetingsList.map((m) => {
                    const count = races.filter((r) => r.meeting === m).length;
                    return (
                      <option key={m} value={m}>
                        {m} ({count} carreras)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Botón rápido para colapsar / expandir todas las reuniones si está agrupado */}
            {groupByMeeting && groupedRaces.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const anyExpanded = groupedRaces.some((g) => !collapsedMeetings[g.meeting]);
                  const newState = {};
                  groupedRaces.forEach((g) => {
                    newState[g.meeting] = anyExpanded;
                  });
                  setCollapsedMeetings(newState);
                }}
                style={{ fontSize: '0.78rem' }}
              >
                {groupedRaces.some((g) => !collapsedMeetings[g.meeting]) ? '➖ Colapsar todas' : '➕ Expandir todas'}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="empty">Cargando carreras...</p>
        ) : filteredProgrammingRaces.length === 0 ? (
          <p className="empty">
            {filterProgrammingMeeting !== 'all'
              ? `No se encontraron carreras para la "${filterProgrammingMeeting}".`
              : 'Aún no hay carreras registradas.'}
          </p>
        ) : groupByMeeting ? (
          /* =============================================================== */
          /* MODO 1: AGRUPADO POR REUNIÓN (JORNADA HÍPICA)                    */
          /* =============================================================== */
          <div>
            {groupedRaces.map((group) => {
              const isCollapsed = Boolean(collapsedMeetings[group.meeting]);
              const validasCount = group.races.filter((r) => r.is_valida).length;
              const finishedCount = group.races.filter((r) => r.status === 'finished').length;
              const sampleRace = group.races[0] || {};

              return (
                <div key={group.meeting} className="meeting-group-card">
                  {/* Cabecera destacada de la Reunión */}
                  <div className="meeting-group-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="meeting-collapse-btn"
                        onClick={() => toggleMeetingCollapse(group.meeting)}
                        title={isCollapsed ? 'Expandir carreras de esta reunión' : 'Colapsar carreras de esta reunión'}
                      >
                        {isCollapsed ? '▶' : '▼'}
                      </button>

                      <div className="meeting-group-title">
                        <span>📍 {group.meeting}</span>
                        <span className="meeting-group-subtitle">
                          — {group.track}
                        </span>
                      </div>

                      <div className="meeting-group-badges">
                        <span className="meeting-group-badge-races">
                          {group.races.length} {group.races.length === 1 ? 'carrera' : 'carreras'}
                        </span>

                        {validasCount > 0 && (
                          <span className="meeting-group-badge-validas">
                            ⭐ {validasCount} Válidas (5 y 6)
                          </span>
                        )}

                        <span
                          className={`meeting-group-badge-status ${
                            finishedCount === group.races.length
                              ? 'is-finished'
                              : finishedCount > 0
                              ? 'is-partial'
                              : 'is-pending'
                          }`}
                        >
                          {finishedCount === group.races.length
                            ? '✓ Todas finalizadas'
                            : `${finishedCount}/${group.races.length} finalizadas`}
                        </span>

                        {group.date && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            📅 {formatRaceDate(group.date)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditMeeting(group.meeting)}
                        title={`Corregir nombre o hipódromo de toda la ${group.meeting}`}
                        style={{ fontSize: '0.8rem' }}
                      >
                        ✏️ Editar Reunión
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAddNextRaceToMeeting(group.races[group.races.length - 1] || sampleRace)}
                        title={`Añadir siguiente carrera a "${group.meeting}"`}
                        style={{ fontSize: '0.8rem' }}
                      >
                        ➕ Añadir carrera
                      </button>
                    </div>
                  </div>

                  {/* Subtabla de carreras de esta reunión */}
                  {!isCollapsed && (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ margin: 0, fontSize: '0.86rem' }}>
                        <thead>
                          <tr>
                            <th style={{ paddingLeft: '1.25rem' }}>Carrera</th>
                            <th>Hipódromo</th>
                            <th>Fecha y Hora</th>
                            <th>Inscritos</th>
                            <th>Estado</th>
                            <th>Ganador Oficial</th>
                            <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.races.map((race) => (
                            <tr key={race.id}>
                              <td style={{ paddingLeft: '1.25rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{race.name}</span>
                                {race.is_valida && (
                                  <span
                                    className="meeting-group-badge-validas"
                                    style={{ marginLeft: '0.45rem', display: 'inline-block' }}
                                  >
                                    ⭐ {race.valida_number ? `${race.valida_number}ª Válida` : '5 y 6'}
                                  </span>
                                )}
                              </td>
                              <td>{race.track || group.track || '—'}</td>
                              <td>{formatRaceDate(race.race_date)}</td>
                              <td>
                                <span className="badge-number">{race.horses_count}</span>
                              </td>
                              <td>
                                <span
                                  className={
                                    race.status === 'finished' ? 'status-finished' : 'status-pending'
                                  }
                                >
                                  {race.status === 'finished' ? 'Finalizada' : 'Programada'}
                                </span>
                              </td>
                              <td>
                                {race.winner ? (
                                  <strong style={{ color: 'var(--emerald-500)', fontWeight: 700 }}>
                                    N° {race.winner.number} - {race.winner.name}
                                    {race.winner.dividend && (
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '0.35rem' }}>
                                        (Bs. {Number(race.winner.dividend).toFixed(2)})
                                      </span>
                                    )}
                                  </strong>
                                ) : (
                                  <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                                <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => openEditRace(race)}
                                    title="Corregir datos de esta carrera y reunión"
                                    style={{ borderColor: '#f59e0b', color: '#f59e0b', fontWeight: 600 }}
                                  >
                                    ✏️ Editar
                                  </button>
                                  <Link className="btn btn-primary btn-sm" to={`/races/${race.id}`}>
                                    Gestionar
                                  </Link>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDelete(race)}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* =============================================================== */
          /* MODO 2: LISTA CORRIDA PLANA                                      */
          /* =============================================================== */
          <table className="table">
            <thead>
              <tr>
                <th>Reunión / Jornada</th>
                <th>Carrera</th>
                <th>Hipódromo</th>
                <th>Fecha y Hora</th>
                <th>Inscritos</th>
                <th>Estado</th>
                <th>Ganador Oficial</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProgrammingRaces.map((race) => (
                <tr key={race.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <strong>{race.meeting || '—'}</strong>
                      {race.meeting && (
                        <button
                          type="button"
                          onClick={() => openEditMeeting(race.meeting)}
                          title={`Editar todas las carreras de ${race.meeting}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            padding: '0 2px',
                            fontSize: '0.8rem',
                          }}
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <span>{race.name}</span>
                    {race.is_valida && (
                      <span
                        className="badge"
                        style={{
                          marginLeft: '0.45rem',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#f59e0b',
                          border: '1px solid #d97706',
                          fontSize: '0.72rem',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                          display: 'inline-block',
                        }}
                      >
                        ⭐ {race.valida_number ? `${race.valida_number}ª Válida` : '5 y 6'}
                      </span>
                    )}
                  </td>
                  <td>{race.track || '—'}</td>
                  <td>{formatRaceDate(race.race_date)}</td>
                  <td>
                    <span className="badge-number">{race.horses_count}</span>
                  </td>
                  <td>
                    <span
                      className={
                        race.status === 'finished' ? 'status-finished' : 'status-pending'
                      }
                    >
                      {race.status === 'finished' ? 'Finalizada' : 'Programada'}
                    </span>
                  </td>
                  <td>
                    {race.winner ? (
                      <strong style={{ color: '#86efac' }}>
                        N° {race.winner.number} - {race.winner.name}
                      </strong>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditRace(race)}
                        title="Corregir datos de esta carrera y reunión"
                        style={{ borderColor: '#f59e0b', color: '#f59e0b', fontWeight: 600 }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleAddNextRaceToMeeting(race)}
                        title="Añadir siguiente carrera a esta reunión"
                      >
                        ➕ Añadir otra
                      </button>
                      <Link className="btn btn-primary btn-sm" to={`/races/${race.id}`}>
                        Gestionar
                      </Link>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(race)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )}

  {/* ========================================================================= */}
  {/* PESTAÑA 2: CARGAR GANADORES Y VALIDACIÓN AUTOMÁTICA DE TAQUILLA          */}
  {/* ========================================================================= */}
  {activeTab === 'results' && (
    <section className="card">
      <div className="auto-payout-callout">
        <span style={{ fontSize: '1.4rem' }}>🛡️</span>
        <div>
          <strong>Validación Automática en Taquilla:</strong> En cuanto selecciones y guardes el{' '}
          <strong>1er Lugar (Ganador Oficial)</strong> de cada carrera, el sistema finaliza la carrera
          y las taquillas podrán validar y pagar automáticamente los tickets ganadores, bloqueando de
          forma segura cualquier intento de cobro de boletos perdedores o de carreras pendientes.
        </div>
      </div>

      {/* Filtros de la pestaña de ganadores */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--bg-input)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="filter-meeting-select" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Reunión / Jornada:
          </label>
          <select
            id="filter-meeting-select"
            className="input"
            style={{ width: 'auto', minWidth: '180px' }}
            value={filterMeeting}
            onChange={(e) => setFilterMeeting(e.target.value)}
          >
            <option value="all">Todas las reuniones</option>
            {meetingsList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="filter-status-select" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Estado:
          </label>
          <select
            id="filter-status-select"
            className="input"
            style={{ width: 'auto' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todas ({races.length})</option>
            <option value="pending">Solo pendientes por ganador ({pendingResultsCount})</option>
            <option value="finished">Finalizadas con ganador ({races.length - pendingResultsCount})</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="empty">Cargando carreras...</p>
      ) : filteredResultsRaces.length === 0 ? (
        <p className="empty">No hay carreras con los filtros seleccionados.</p>
      ) : (
        <div>
          {filteredResultsRaces.map((race) => {
            const draft = resultsDraft[race.id] || {};
            const horses = race.horses || [];
            const activeHorses = horses.filter((h) => !h.is_retired);
            const isFinished = race.status === 'finished';
            const isSaving = savingResultId === race.id;

            return (
              <div
                key={race.id}
                className={`race-result-card ${isFinished ? 'is-finished' : ''}`}
              >
                {/* Header de la carrera */}
                <div className="race-result-card-header">
                  <div>
                    {race.meeting && (
                      <span className="race-meeting-badge">
                        📍 {race.meeting}
                      </span>
                    )}
                    <h3 style={{ margin: '0.2rem 0', fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>{race.name}</span>
                      {race.is_valida && (
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid #d97706', fontSize: '0.72rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                          ⭐ {race.valida_number ? `${race.valida_number}ª Válida` : '5 y 6'}
                        </span>
                      )}
                    </h3>
                    <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {race.track || 'Sin hipódromo'} · Fecha: {formatRaceDate(race.race_date)} · {horses.length} inscritos
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span className={isFinished ? 'status-finished' : 'status-pending'}>
                      {isFinished ? '✓ Finalizada (Ganador Asignado)' : '⏳ Pendiente por Resultado'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditRace(race)}
                      title="Corregir datos de esta carrera y reunión"
                      style={{ color: '#f59e0b', borderColor: '#f59e0b', fontWeight: 600 }}
                    >
                      ✏️ Corregir
                    </button>
                    <Link
                      to={`/races/${race.id}`}
                      className="btn btn-secondary btn-sm"
                      title="Ver detalle completo de inscritos"
                    >
                      Ver Detalle
                    </Link>
                  </div>
                </div>

                {/* Banner si ya tiene ganador */}
                {race.winner && (
                  <div
                    className="alert alert-success"
                    style={{
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>🏆</span>
                    <div>
                      <strong>Ganador Oficial:</strong> N° {race.winner.number} - {race.winner.name} {race.winner.jockey ? `(Jinete: ${race.winner.jockey})` : ''} · <strong>Dividendo Oficial: Bs. {Number(race.winner.dividend).toFixed(2)}</strong>
                      {race.second && (
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>
                          | <strong>2do:</strong> N° {race.second.number} - {race.second.name} {race.second.jockey ? `(J: ${race.second.jockey})` : ''}
                        </span>
                      )}
                      {race.third && (
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>
                          | <strong>3er:</strong> N° {race.third.number} - {race.third.name} {race.third.jockey ? `(J: ${race.third.jockey})` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Formulario de Asignación de Ganador Oficial (Podio) */}
                <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🥇 Cómputo del Podio Oficial y Dividendos</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      (El dividendo oficial ingresado liquidará automáticamente los tickets ganadores)
                    </span>
                  </h4>

                  <div className="podium-grid">
                    {/* 1er Lugar: Ganador Oficial */}
                    <div className="podium-item" style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <label className="podium-label podium-1">
                        🥇 1er Lugar (Ganador Oficial) *
                      </label>
                      <select
                        className="input"
                        style={{ borderColor: '#f59e0b', fontWeight: 'bold' }}
                        value={draft.winner_horse_id || ''}
                        onChange={(e) => handleWinnerSelect(race.id, e.target.value, activeHorses)}
                      >
                        <option value="">-- Seleccionar Ganador Oficial --</option>
                        {activeHorses.map((h) => (
                          <option key={h.id} value={h.id}>
                            N° {h.number} - {h.name} {h.jockey ? `(J: ${h.jockey})` : ''}
                          </option>
                        ))}
                      </select>

                      {draft.winner_horse_id && (
                        <div style={{ marginTop: '0.65rem' }}>
                          <label style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>
                            💰 Dividendo Oficial Ganador (Bs / Factor) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input input-sm"
                            style={{ borderColor: '#f59e0b', background: 'var(--bg-canvas)', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}
                            placeholder="Ej: 32.50"
                            value={draft.winner_dividend ?? ''}
                            onChange={(e) => handlePodiumChange(race.id, 'winner_dividend', e.target.value)}
                            required
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                            Dividendo anunciado por el hipódromo para pagar a ganador.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 2do Lugar */}
                    <div className="podium-item">
                      <label className="podium-label podium-2">
                        🥈 2do Lugar (Opcional)
                      </label>
                      <select
                        className="input"
                        value={draft.second_horse_id || ''}
                        onChange={(e) => handlePodiumChange(race.id, 'second_horse_id', e.target.value)}
                      >
                        <option value="">-- Sin asignar --</option>
                        {activeHorses
                          .filter((h) => String(h.id) !== String(draft.winner_horse_id))
                          .map((h) => (
                            <option key={h.id} value={h.id}>
                              N° {h.number} - {h.name} {h.jockey ? `(J: ${h.jockey})` : ''}
                            </option>
                          ))}
                      </select>

                      {draft.second_horse_id && (
                        <div style={{ marginTop: '0.65rem' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                            Dividendo Place 2° (Opcional):
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input input-sm"
                            placeholder="Ej: 14.00"
                            value={draft.second_dividend ?? ''}
                            onChange={(e) => handlePodiumChange(race.id, 'second_dividend', e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* 3er Lugar */}
                    <div className="podium-item">
                      <label className="podium-label podium-3">
                        🥉 3er Lugar (Opcional)
                      </label>
                      <select
                        className="input"
                        value={draft.third_horse_id || ''}
                        onChange={(e) => handlePodiumChange(race.id, 'third_horse_id', e.target.value)}
                      >
                        <option value="">-- Sin asignar --</option>
                        {activeHorses
                          .filter(
                            (h) =>
                              String(h.id) !== String(draft.winner_horse_id) &&
                              String(h.id) !== String(draft.second_horse_id)
                          )
                          .map((h) => (
                            <option key={h.id} value={h.id}>
                              N° {h.number} - {h.name} {h.jockey ? `(J: ${h.jockey})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Lista rápida de ejemplares y control de retiros */}
                <details style={{ marginBottom: '1rem', background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                    📋 Ver Inscritos y Marcar Retiros ({horses.length} ejemplares inscritos)
                  </summary>
                  <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
                    <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>N°</th>
                          <th>Ejemplar</th>
                          <th>Jinete</th>
                          <th>Dividendo</th>
                          <th>Estado</th>
                          <th>Acción de Retiro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {horses.map((horse) => (
                          <tr
                            key={horse.id}
                            className={horse.is_retired ? 'horse-retired-row' : ''}
                          >
                            <td>
                              <span className="badge-number">{horse.number}</span>
                            </td>
                            <td>
                              <strong>{horse.name}</strong>
                            </td>
                            <td>
                              {horse.jockey ? (
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{horse.jockey}</span>
                              ) : (
                                <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: '0.8rem' }}>Sin jinete</span>
                              )}
                            </td>
                            <td>{horse.dividend}</td>
                            <td>
                              {horse.is_retired ? (
                                <span className="badge-retired">🚫 RETIRADO</span>
                              ) : (
                                <span style={{ color: 'var(--emerald-500)', fontWeight: 600 }}>
                                  ✓ Activo
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`btn btn-sm ${horse.is_retired ? 'btn-secondary' : 'btn-danger'}`}
                                onClick={() => handleToggleHorseRetire(race, horse)}
                                disabled={retiringHorseId === horse.id}
                              >
                                {retiringHorseId === horse.id
                                  ? 'Actualizando...'
                                  : horse.is_retired
                                  ? 'Rehabilitar'
                                  : 'Marcar Retirado'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                {/* Botón de guardado */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {isFinished && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        const isConfirmed = await showConfirm({
                          title: '¿Reabrir carrera?',
                          text: `¿Reabrir "${race.name}" y limpiar su resultado oficial?`,
                          confirmButtonText: 'Sí, Reabrir',
                          icon: 'warning',
                        });

                        if (isConfirmed) {
                          handlePodiumChange(race.id, 'winner_horse_id', '');
                          handlePodiumChange(race.id, 'second_horse_id', '');
                          handlePodiumChange(race.id, 'third_horse_id', '');
                          api.put(`/admin/races/${race.id}/result`, {
                            winner_horse_id: null,
                            second_horse_id: null,
                            third_horse_id: null,
                          }).then((res) => {
                            setRaces((prev) => prev.map((r) => (r.id === race.id ? res.data.data : r)));
                            setSuccess(`Carrera "${race.name}" reabierta y resultado limpiado.`);
                          }).catch((err) => setError(getErrorMessage(err)));
                        }
                      }}
                    >
                      🔄 Reabrir Carrera (Limpiar Ganador)
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSaveRaceResult(race)}
                    disabled={isSaving}
                  >
                    {isSaving
                      ? 'Guardando ganador...'
                      : isFinished
                      ? '💾 Actualizar Ganador Oficial'
                      : '💾 Guardar Ganador Oficial y Habilitar Pagos'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  )}

  {/* ========================================================================= */}
  {/* MODAL 1: EDITAR REGISTRO DE CARRERA / REUNIÓN                             */}
  {/* ========================================================================= */}
  {editingRace && (
    <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => setEditingRace(null)}>
      <div
        className="card"
        style={{
          maxWidth: '560px',
          width: '92%',
          margin: 'auto',
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <span>✏️</span> Corregir Carrera / Reunión
          </h3>
          <button
            type="button"
            onClick={() => setEditingRace(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.25rem', cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSaveEditRace}>
          <div className="form-field" style={{ marginBottom: '0.85rem' }}>
            <label htmlFor="edit-race-meeting">N° de Reunión / Jornada</label>
            <input
              id="edit-race-meeting"
              className="input"
              type="text"
              value={editingRace.meeting}
              onChange={(e) => setEditingRace({ ...editingRace, meeting: e.target.value })}
              placeholder="Ej: Reunión 42"
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'block' }}>
              Puedes corregir el número o nombre de la reunión para esta carrera.
            </span>
          </div>

          <div className="form-field" style={{ marginBottom: '0.85rem' }}>
            <label htmlFor="edit-race-name">Nombre de la Carrera *</label>
            <input
              id="edit-race-name"
              className="input"
              type="text"
              value={editingRace.name}
              onChange={(e) => setEditingRace({ ...editingRace, name: e.target.value })}
              placeholder="Ej: 1ra Carrera"
              required
            />
          </div>

          <div className="form-field" style={{ marginBottom: '0.85rem' }}>
            <label htmlFor="edit-race-track">Hipódromo</label>
            <input
              id="edit-race-track"
              className="input"
              type="text"
              list="edit-hipodromos-list"
              value={editingRace.track}
              onChange={(e) => setEditingRace({ ...editingRace, track: e.target.value })}
              placeholder="Ej: La Rinconada"
            />
            <datalist id="edit-hipodromos-list">
              {HIPODROMOS_COMUNES.map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div className="form-field">
              <label htmlFor="edit-race-date">Fecha</label>
              <input
                id="edit-race-date"
                className="input"
                type="date"
                value={editingRace.date}
                onChange={(e) => setEditingRace({ ...editingRace, date: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label htmlFor="edit-race-time">Hora</label>
              <input
                id="edit-race-time"
                className="input"
                type="time"
                value={editingRace.time}
                onChange={(e) => setEditingRace({ ...editingRace, time: e.target.value })}
              />
            </div>
          </div>

          <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
            <label htmlFor="edit-race-is-valida" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, color: editingRace.is_valida ? '#f59e0b' : 'inherit' }}>
              <input
                id="edit-race-is-valida"
                type="checkbox"
                checked={editingRace.is_valida}
                onChange={(e) => setEditingRace({ ...editingRace, is_valida: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: '#f59e0b' }}
              />
              <span>⭐ Válida del 5 y 6</span>
            </label>

            {editingRace.is_valida && (
              <div style={{ marginTop: '0.5rem' }}>
                <select
                  id="edit-race-valida-number"
                  className="input input-sm"
                  value={editingRace.valida_number}
                  onChange={(e) => setEditingRace({ ...editingRace, valida_number: e.target.value })}
                  style={{ borderColor: '#f59e0b' }}
                >
                  <option value="">-- Selecciona el N° de Válida --</option>
                  <option value="1">1ª Válida (5 y 6)</option>
                  <option value="2">2ª Válida (5 y 6)</option>
                  <option value="3">3ª Válida (5 y 6)</option>
                  <option value="4">4ª Válida (5 y 6)</option>
                  <option value="5">5ª Válida (5 y 6)</option>
                  <option value="6">6ª Válida (5 y 6)</option>
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingRace(null)}
              disabled={modalSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={modalSaving}
            >
              {modalSaving ? 'Guardando...' : '💾 Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* ========================================================================= */}
  {/* MODAL 2: CORREGIR REUNIÓN COMPLETA EN LOTE                               */}
  {/* ========================================================================= */}
  {editingMeeting && (
    <div className="modal-overlay" style={{ zIndex: 100 }} onClick={() => setEditingMeeting(null)}>
      <div
        className="card"
        style={{
          maxWidth: '520px',
          width: '92%',
          margin: 'auto',
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <span>🔄</span> Corregir Reunión Completa
          </h3>
          <button
            type="button"
            onClick={() => setEditingMeeting(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.25rem', cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Esta acción actualizará en lote todas las carreras asociadas a <strong>"{editingMeeting.current_meeting}"</strong>.
        </p>

        <form onSubmit={handleSaveEditMeeting}>
          <div className="form-field" style={{ marginBottom: '0.85rem' }}>
            <label htmlFor="edit-new-meeting">Nuevo Nombre de la Reunión *</label>
            <input
              id="edit-new-meeting"
              className="input"
              type="text"
              value={editingMeeting.new_meeting}
              onChange={(e) => setEditingMeeting({ ...editingMeeting, new_meeting: e.target.value })}
              placeholder="Ej: Reunión 42"
              required
            />
          </div>

          <div className="form-field" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="edit-meeting-track">Hipódromo para toda la reunión</label>
            <input
              id="edit-meeting-track"
              className="input"
              type="text"
              list="edit-hipodromos-list"
              value={editingMeeting.track}
              onChange={(e) => setEditingMeeting({ ...editingMeeting, track: e.target.value })}
              placeholder="Ej: La Rinconada"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditingMeeting(null)}
              disabled={modalSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={modalSaving}
            >
              {modalSaving ? 'Actualizando reunión...' : '🔄 Actualizar Reunión en Lote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}
</div>
);
}
