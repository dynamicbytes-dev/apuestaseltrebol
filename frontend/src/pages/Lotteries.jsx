import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { defaultAnimalRows } from '../utils/animalitos';
import { todayISO, VENEZUELA_TIMEZONE } from '../utils/parley';

const emptyForm = () => ({ name: '', animals: defaultAnimalRows() });

function formatSorteoDate(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    return d.toLocaleString('es-VE', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: VENEZUELA_TIMEZONE,
    });
  } catch {
    return value;
  }
}

const HORARIOS_COMUNES = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
];

export default function Lotteries() {
  const [activeTab, setActiveTab] = useState('lotteries'); // 'lotteries' | 'results'
  const [lotteries, setLotteries] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estados para pestaña de Resultados Oficiales
  const [sorteos, setSorteos] = useState([]);
  const [pendingSorteos, setPendingSorteos] = useState([]);
  const [loadingSorteos, setLoadingSorteos] = useState(false);
  const [filterDate, setFilterDate] = useState(todayISO());
  const [filterLotteryId, setFilterLotteryId] = useState('');
  const [selectedLotteryAnimals, setSelectedLotteryAnimals] = useState([]);
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [savingResult, setSavingResult] = useState(false);

  // Formulario de resultado oficial
  const [resultForm, setResultForm] = useState({
    lottery_id: '',
    sorteo_date: todayISO(),
    sorteo_time: '10:00',
    lottery_animal_id: '',
  });

  const loadLotteries = async () => {
    try {
      const response = await api.get('/admin/lotteries');
      setLotteries(response.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadSorteos = useCallback(async () => {
    try {
      setLoadingSorteos(true);
      const res = await api.get('/admin/animalitos/sorteos', {
        params: {
          date: filterDate || undefined,
          lottery_id: filterLotteryId || undefined,
        },
      });
      setSorteos(res.data.data);
      setPendingSorteos(res.data.pending ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingSorteos(false);
    }
  }, [filterDate, filterLotteryId]);

  useEffect(() => {
    loadLotteries();
  }, []);

  useEffect(() => {
    if (activeTab === 'results') {
      loadSorteos();
    }
  }, [activeTab, loadSorteos]);

  // Al seleccionar lotería en el formulario de resultados, cargar sus animalitos
  const handleSelectLotteryForResult = async (lotteryId) => {
    setResultForm((prev) => ({ ...prev, lottery_id: lotteryId, lottery_animal_id: '' }));
    if (!lotteryId) {
      setSelectedLotteryAnimals([]);
      return;
    }
    try {
      setLoadingAnimals(true);
      const res = await api.get(`/admin/lotteries/${lotteryId}`);
      setSelectedLotteryAnimals(res.data.data?.animals || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingAnimals(false);
    }
  };

  const handleSaveResult = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!resultForm.lottery_id || !resultForm.lottery_animal_id) {
      setError('Por favor selecciona una lotería y el animalito ganador.');
      return;
    }

    setSavingResult(true);
    try {
      const res = await api.post('/admin/animalitos/sorteos', {
        lottery_id: resultForm.lottery_id,
        sorteo_date: resultForm.sorteo_date,
        sorteo_time: resultForm.sorteo_time,
        lottery_animal_id: resultForm.lottery_animal_id,
      });
      setSuccess(res.data.message || 'Resultado oficial registrado exitosamente.');
      setResultForm((prev) => ({ ...prev, lottery_animal_id: '' }));
      await loadSorteos();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingResult(false);
    }
  };

  const handleDeleteSorteo = async (sorteo) => {
    if (!window.confirm(`¿Eliminar el resultado N° ${sorteo.number} - ${sorteo.animal} de ${sorteo.lottery?.name}?`)) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/admin/animalitos/sorteos/${sorteo.id}`);
      setSuccess('Resultado de sorteo eliminado.');
      await loadSorteos();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const updateRow = (index, field, value) => {
    setForm((current) => ({
      ...current,
      animals: current.animals.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    }));
  };

  const addRow = () => {
    setForm((current) => {
      const used = current.animals.map((row) => parseInt(row.number, 10));
      const valid = used.filter((value) => Number.isInteger(value));
      const next = valid.length ? Math.max(...valid) + 1 : 1;

      return {
        ...current,
        animals: [...current.animals, { number: String(next), animal: '' }],
      };
    });
  };

  const removeRow = (index) => {
    setForm((current) => ({
      ...current,
      animals: current.animals.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const rows = form.animals.map((row) => ({
      number: String(row.number).trim(),
      animal: row.animal.trim(),
    }));

    if (rows.length === 0) {
      setError('Debe registrar al menos un número con su animalito.');
      return;
    }

    if (rows.some((row) => !/^\d{1,2}$/.test(row.number))) {
      setError('Cada número debe tener 1 o 2 dígitos (ej: 0, 00, 1, 36).');
      return;
    }

    if (rows.some((row) => row.animal === '')) {
      setError('Todos los números deben tener un animalito.');
      return;
    }

    if (new Set(rows.map((row) => row.number)).size !== rows.length) {
      setError('Hay números repetidos en la lista.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/admin/lotteries', { name: form.name, animals: rows });
      setSuccess(`Lotería registrada con ${rows.length} animalitos.`);
      setForm(emptyForm());
      await loadLotteries();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (lottery) => {
    setError(null);
    setSuccess(null);

    try {
      await api.put(`/admin/lotteries/${lottery.id}`, {
        name: lottery.name,
        is_active: !lottery.is_active,
      });
      setSuccess(
        `Lotería ${lottery.is_active ? 'desactivada' : 'activada'} correctamente.`,
      );
      await loadLotteries();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async (lottery) => {
    if (!window.confirm(`¿Eliminar la lotería "${lottery.name}" y todos sus animalitos?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/admin/lotteries/${lottery.id}`);
      setSuccess('Lotería eliminada correctamente.');
      await loadLotteries();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Módulo de Animalitos</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            Configuración de loterías y registro manual de resultados oficiales para validación de taquilla.
          </p>
        </div>
      </header>

      {/* Pestañas de Navegación */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'lotteries' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('lotteries');
            setError(null);
            setSuccess(null);
          }}
        >
          🐾 Loterías y Números
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'results' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('results');
            setError(null);
            setSuccess(null);
          }}
        >
          🏆 Resultados Oficiales (Sorteos)
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* PESTAÑA 1: GESTIÓN DE LOTERÍAS */}
      {activeTab === 'lotteries' && (
        <>
          <section className="card">
            <h2 className="card-title">Registrar nueva lotería</h2>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="lottery-name">Nombre de la lotería</label>
                  <input
                    id="lottery-name"
                    className="input"
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Ej: Lotto Activo"
                    required
                  />
                </div>
              </div>

              <h3 className="card-title" style={{ marginTop: '1rem' }}>
                Números y animalitos ({form.animals.length})
              </h3>
              <p className="empty" style={{ textAlign: 'left', margin: '0.25rem 0 1rem' }}>
                Edita, agrega o elimina números según los animalitos de esta lotería.
              </p>

              <div className="animal-grid">
                {form.animals.map((row, index) => (
                  <div key={index} className="animal-card">
                    <div className="animal-number">
                      <input
                        className="input"
                        type="text"
                        inputMode="numeric"
                        maxLength={2}
                        pattern="\d{1,2}"
                        aria-label={`Número ${index + 1}`}
                        value={row.number}
                        onChange={(event) =>
                          updateRow(index, 'number', event.target.value.replace(/\D/g, ''))
                        }
                        style={{ width: '5rem' }}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeRow(index)}
                      >
                        Quitar
                      </button>
                    </div>
                    <input
                      className="input"
                      type="text"
                      aria-label={`Animalito ${index + 1}`}
                      value={row.animal}
                      onChange={(event) => updateRow(index, 'animal', event.target.value)}
                      placeholder="Animalito"
                      required
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={addRow}>
                  + Agregar número
                </button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Guardando...' : 'Registrar Lotería'}
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2 className="card-title">Loterías registradas</h2>

            {loading ? (
              <p className="empty">Cargando loterías...</p>
            ) : lotteries.length === 0 ? (
              <p className="empty">Aún no hay loterías registradas.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Animalitos habilitados</th>
                      <th>Multiplicador</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotteries.map((lottery) => (
                      <tr key={lottery.id}>
                        <td><strong>{lottery.name}</strong></td>
                        <td>
                          {lottery.enabled_animals_count ?? lottery.animals_count} / {lottery.animals_count}
                        </td>
                        <td>
                          <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                            x{Number(lottery.payout_multiplier || 30).toFixed(2)}
                          </strong>
                        </td>
                        <td>
                          <span className={lottery.is_active ? 'status-active' : 'status-inactive'}>
                            {lottery.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                            <Link className="btn btn-primary btn-sm" to={`/lotteries/${lottery.id}`}>
                              Animalitos
                            </Link>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(lottery)}>
                              {lottery.is_active ? 'Desactivar' : 'Activar'}
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(lottery)}>
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
          </section>
        </>
      )}

      {/* PESTAÑA 2: RESULTADOS OFICIALES MANUALES */}
      {activeTab === 'results' && (
        <>
          <section className="card">
            <h2 className="card-title">Asentar Resultado Oficial de Sorteo</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Registra el animalito ganador oficial de cada horario. Las taquillas validarán automáticamente los tickets contra estos resultados.
            </p>

            <form onSubmit={handleSaveResult}>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="res-lottery">Lotería</label>
                  <select
                    id="res-lottery"
                    className="input"
                    value={resultForm.lottery_id}
                    onChange={(e) => handleSelectLotteryForResult(e.target.value)}
                    required
                  >
                    <option value="">-- Selecciona una lotería --</option>
                    {lotteries.filter((l) => l.is_active).map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="res-date">Fecha del Sorteo</label>
                  <input
                    id="res-date"
                    type="date"
                    className="input"
                    value={resultForm.sorteo_date}
                    onChange={(e) => setResultForm({ ...resultForm, sorteo_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="res-time">Horario del Sorteo</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      id="res-time"
                      type="time"
                      className="input"
                      value={resultForm.sorteo_time}
                      onChange={(e) => setResultForm({ ...resultForm, sorteo_time: e.target.value })}
                      required
                    />
                    <select
                      className="input"
                      style={{ width: 'auto' }}
                      value={HORARIOS_COMUNES.includes(resultForm.sorteo_time) ? resultForm.sorteo_time : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setResultForm({ ...resultForm, sorteo_time: e.target.value });
                        }
                      }}
                    >
                      <option value="">Horas comunes...</option>
                      {HORARIOS_COMUNES.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="res-animal">Animalito Ganador</label>
                  <select
                    id="res-animal"
                    className="input"
                    value={resultForm.lottery_animal_id}
                    onChange={(e) => setResultForm({ ...resultForm, lottery_animal_id: e.target.value })}
                    disabled={!resultForm.lottery_id || loadingAnimals}
                    required
                  >
                    <option value="">
                      {!resultForm.lottery_id
                        ? 'Primero elige una lotería'
                        : loadingAnimals
                        ? 'Cargando animalitos...'
                        : '-- Selecciona el animalito ganador --'}
                    </option>
                    {selectedLotteryAnimals
                      .filter((a) => a.is_enabled)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          N° {a.number} - {a.animal}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingResult || !resultForm.lottery_id || !resultForm.lottery_animal_id}
                >
                  {savingResult ? 'Guardando Resultado...' : '✓ Registrar Ganador Oficial'}
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 className="card-title" style={{ margin: 0 }}>Historial de Resultados Oficiales</h2>

              {/* Filtros */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="date"
                  className="input"
                  style={{ width: 'auto' }}
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
                <select
                  className="input"
                  style={{ width: 'auto' }}
                  value={filterLotteryId}
                  onChange={(e) => setFilterLotteryId(e.target.value)}
                >
                  <option value="">Todas las Loterías</option>
                  {lotteries.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={loadSorteos}
                >
                  Actualizar
                </button>
              </div>
            </div>

            {pendingSorteos.length > 0 && (
              <div className="alert alert-info" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                <strong>Pendientes de registrar:</strong>{' '}
                {pendingSorteos.map((l) => l.name).join(', ')}. Sin un resultado oficial
                no se pueden cobrar los tickets de esas loterías.
                {!pendingSorteos.some((l) => l.has_source) && (
                  <span style={{ display: 'block', marginTop: '0.35rem' }}>
                    Ninguna tiene fuente de consulta configurada: regístralas manualmente.
                  </span>
                )}
              </div>
            )}

            {loadingSorteos ? (
              <p className="empty">Cargando resultados de sorteos...</p>
            ) : sorteos.length === 0 ? (
              <p className="empty">No hay resultados oficiales registrados para los filtros seleccionados.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Lotería</th>
                      <th>Fecha y Hora</th>
                      <th>Número Ganador</th>
                      <th>Animalito</th>
                      <th>Registro</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorteos.map((s) => (
                      <tr key={s.id}>
                        <td><strong>{s.lottery?.name ?? 'Lotería'}</strong></td>
                        <td>{formatSorteoDate(s.sorteo_at)}</td>
                        <td>
                          <span
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 800,
                            }}
                          >
                            N° {s.number}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#ffffff' }}>{s.animal}</strong>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                            {s.es_manual ? 'Manual (Admin)' : 'Automático'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteSorteo(s)}
                            title="Eliminar este resultado"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
