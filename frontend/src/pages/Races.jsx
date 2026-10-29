import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { todayISO } from '../utils/parley';

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
  dividend: '2.50',
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
    horses: defaultHorsesList(),
  });

  const loadRaces = async () => {
    try {
      const response = await api.get('/admin/races');
      const data = response.data.data;
      setRaces(data);

      // Sincronizar borrador de resultados con los ganadores existentes
      const draft = {};
      data.forEach((r) => {
        draft[r.id] = {
          winner_horse_id: r.winner_horse_id ? String(r.winner_horse_id) : '',
          second_horse_id: r.second_horse_id ? String(r.second_horse_id) : '',
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

    setForm({
      track: existingRace.track || 'La Rinconada',
      meeting: existingRace.meeting || 'Reunión 1',
      date: existingRace.race_date ? existingRace.race_date.slice(0, 10) : todayISO(),
      time: '14:00',
      name: `${nextRaceNumber}da Carrera`,
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
      dividend: Number(h.dividend),
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

    if (horsesToSubmit.some((h) => isNaN(h.dividend) || h.dividend < 0)) {
      setError('Todos los dividendos deben ser números positivos válidos.');
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
        horses: horsesToSubmit,
      });

      setSuccess(`✅ ${form.name} de "${form.meeting || 'Jornada'}" registrada con éxito (${horsesToSubmit.length} ejemplares inscritos).`);

      // Sugerir la siguiente carrera de la misma reunión
      const nextNum = parseInt(form.name.replace(/\D/g, ''), 10);
      const nextRaceStr = !isNaN(nextNum) ? `${nextNum + 1}da Carrera` : 'Siguiente Carrera';

      setForm((prev) => ({
        ...prev,
        name: nextRaceStr,
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
    if (!window.confirm(`¿Eliminar la carrera "${race.name}" y todos sus ejemplares inscritos?`)) {
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

  const handleSaveRaceResult = async (race) => {
    setError(null);
    setSuccess(null);
    setSavingResultId(race.id);

    const draft = resultsDraft[race.id] || {};
    const winnerId = draft.winner_horse_id ? Number(draft.winner_horse_id) : null;
    const secondId = draft.second_horse_id ? Number(draft.second_horse_id) : null;
    const thirdId = draft.third_horse_id ? Number(draft.third_horse_id) : null;

    if (!winnerId && (secondId || thirdId)) {
      setError('Debes seleccionar al menos el 1er Lugar (Ganador Oficial) para registrar el podio.');
      setSavingResultId(null);
      return;
    }

    try {
      const res = await api.put(`/admin/races/${race.id}/result`, {
        winner_horse_id: winnerId,
        second_horse_id: secondId,
        third_horse_id: thirdId,
      });

      const updated = res.data.data;
      setRaces((prev) => prev.map((r) => (r.id === race.id ? updated : r)));

      if (updated.winner) {
        setSuccess(
          `🏆 ¡Ganador oficial registrado para ${race.name} de "${race.meeting || 'Jornada'}"! Ejemplar: N° ${updated.winner.number} - ${updated.winner.name}. Taquilla ya puede pagar los tickets ganadores de esta carrera de forma automática.`
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

  // Filtros y listas computadas
  const meetingsList = Array.from(new Set(races.map((r) => r.meeting).filter(Boolean)));
  const pendingResultsCount = races.filter((r) => r.status !== 'finished').length;

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
          <p className="empty" style={{ padding: '0.25rem 0 0' }}>
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
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#93c5fd' }}>
              📍 1. Datos de la Jornada / Hipódromo
            </h3>
            <div className="form-row">
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
            </div>
          </div>

          {/* Bloque 2: Caballos Inscritos */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#e2e8f0' }}>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      Dividendo fijo:
                    </label>
                    <input
                      className="input input-sm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={horse.dividend}
                      onChange={(e) => updateHorse(index, 'dividend', e.target.value)}
                      style={{ width: '90px' }}
                      required
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

      {/* Lista de Carreras Registradas */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            Programación Actual ({races.length} carreras)
          </h2>
        </div>

        {loading ? (
          <p className="empty">Cargando carreras...</p>
        ) : races.length === 0 ? (
          <p className="empty">Aún no hay carreras registradas.</p>
        ) : (
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
              {races.map((race) => (
                <tr key={race.id}>
                  <td>
                    <strong>{race.meeting || '—'}</strong>
                  </td>
                  <td>{race.name}</td>
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
                        onClick={() => handleAddNextRaceToMeeting(race)}
                        title="Añadir siguiente carrera a esta reunión"
                      >
                        ➕ Añadir otra
                      </button>
                      <Link className="btn btn-primary btn-sm" to={`/races/${race.id}`}>
                        Gestionar / Resultados
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
          <label htmlFor="filter-meeting-select" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
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
          <label htmlFor="filter-status-select" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
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
                    <h3 style={{ margin: '0.2rem 0', fontSize: '1.15rem', color: '#f8fafc' }}>
                      {race.name}
                    </h3>
                    <p className="empty" style={{ padding: 0, fontSize: '0.85rem' }}>
                      {race.track || 'Sin hipódromo'} · Fecha: {formatRaceDate(race.race_date)} · {horses.length} inscritos
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={isFinished ? 'status-finished' : 'status-pending'}>
                      {isFinished ? '✓ Finalizada (Ganador Asignado)' : '⏳ Pendiente por Resultado'}
                    </span>
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
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid #10b981',
                      borderRadius: '8px',
                      padding: '0.65rem 1rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      color: '#a7f3d0',
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>🏆</span>
                    <div>
                      <strong>Ganador Oficial:</strong> N° {race.winner.number} - {race.winner.name} (Cuota: {race.winner.dividend})
                      {race.second && (
                        <span style={{ color: '#cbd5e1', marginLeft: '0.75rem' }}>
                          | <strong>2do:</strong> N° {race.second.number} - {race.second.name}
                        </span>
                      )}
                      {race.third && (
                        <span style={{ color: '#cbd5e1', marginLeft: '0.75rem' }}>
                          | <strong>3er:</strong> N° {race.third.number} - {race.third.name}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Formulario de Asignación de Ganador Oficial (Podio) */}
                <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🥇 Cómputo del Podio Oficial</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      (El 1er lugar habilita el pago automático en taquilla)
                    </span>
                  </h4>

                  <div className="podium-grid">
                    {/* 1er Lugar: Ganador Oficial */}
                    <div className="podium-item" style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <label className="podium-label podium-1">
                        🥇 1er Lugar (Ganador Oficial) *
                      </label>
                      <select
                        className="input"
                        style={{ borderColor: '#f59e0b', fontWeight: 'bold' }}
                        value={draft.winner_horse_id || ''}
                        onChange={(e) => handlePodiumChange(race.id, 'winner_horse_id', e.target.value)}
                      >
                        <option value="">-- Seleccionar Ganador Oficial --</option>
                        {activeHorses.map((h) => (
                          <option key={h.id} value={h.id}>
                            N° {h.number} - {h.name} (Cuota {h.dividend})
                          </option>
                        ))}
                      </select>
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
                              N° {h.number} - {h.name}
                            </option>
                          ))}
                      </select>
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
                              N° {h.number} - {h.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Lista rápida de ejemplares y control de retiros */}
                <details style={{ marginBottom: '1rem', background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#cbd5e1', fontSize: '0.85rem' }}>
                    📋 Ver Inscritos y Marcar Retiros ({horses.length} ejemplares inscritos)
                  </summary>
                  <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
                    <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>N°</th>
                          <th>Ejemplar</th>
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
                            <td>{horse.dividend}</td>
                            <td>
                              {horse.is_retired ? (
                                <span className="badge-retired">🚫 RETIRADO</span>
                              ) : (
                                <span style={{ color: '#86efac', fontWeight: 600 }}>
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
                      onClick={() => {
                        if (window.confirm(`¿Reabrir "${race.name}" y limpiar su resultado oficial?`)) {
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
</div>
);
}
