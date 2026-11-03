import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { showConfirm, showPrompt } from '../utils/swal';

const emptyHorseForm = { number: '', name: '', jockey: '', dividend: '' };

function formatRaceDate(value) {
  if (!value) return '—';

  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-');

  return `${day}/${month}/${year}${time ? ` ${time}` : ''}`;
}

export default function RaceDetail() {
  const { raceId } = useParams();
  const [race, setRace] = useState(null);
  const [raceForm, setRaceForm] = useState({
    name: '',
    meeting: '',
    track: '',
    race_date: '',
    is_valida: false,
    valida_number: '',
    ganador_price: '100.00',
  });
  const [horseForm, setHorseForm] = useState(emptyHorseForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyHorseForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [horseSaving, setHorseSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const applyRace = (data) => {
    setRace(data);
    setRaceForm({
      name: data.name,
      meeting: data.meeting ?? '',
      track: data.track ?? '',
      race_date: data.race_date ?? '',
      is_valida: Boolean(data.is_valida),
      valida_number: data.valida_number !== null && data.valida_number !== undefined ? String(data.valida_number) : '',
      ganador_price: data.ganador_price !== null && data.ganador_price !== undefined ? String(data.ganador_price) : '100.00',
    });
  };

  const loadRace = async () => {
    try {
      const response = await api.get(`/admin/races/${raceId}`);
      applyRace(response.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRace();
  }, [raceId]);

  const handleSaveRace = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.put(`/admin/races/${raceId}`, {
        name: raceForm.name,
        meeting: raceForm.meeting || null,
        track: raceForm.track || null,
        race_date: raceForm.race_date || null,
        ganador_price: raceForm.ganador_price ? Number(raceForm.ganador_price) : 100.00,
        is_valida: Boolean(raceForm.is_valida),
        valida_number: raceForm.is_valida && raceForm.valida_number ? Number(raceForm.valida_number) : null,
      });

      applyRace(response.data.data);
      setSuccess('Datos de la carrera actualizados.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddHorse = async (event) => {
    event.preventDefault();
    setHorseSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/admin/races/${raceId}/horses`, {
        number: Number(horseForm.number),
        name: horseForm.name,
        jockey: horseForm.jockey && horseForm.jockey.trim() ? horseForm.jockey.trim() : null,
        dividend: horseForm.dividend && !isNaN(Number(horseForm.dividend)) ? Number(horseForm.dividend) : 0,
      });

      setHorseForm(emptyHorseForm);
      setSuccess('Caballo agregado correctamente.');
      await loadRace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setHorseSaving(false);
    }
  };

  const startEdit = (horse) => {
    setEditingId(horse.id);
    setEditForm({
      number: String(horse.number),
      name: horse.name,
      jockey: horse.jockey || '',
      dividend: horse.dividend,
    });
    setError(null);
    setSuccess(null);
  };

  const handleUpdateHorse = async (horseId) => {
    setHorseSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.put(`/admin/races/${raceId}/horses/${horseId}`, {
        number: Number(editForm.number),
        name: editForm.name,
        jockey: editForm.jockey && editForm.jockey.trim() ? editForm.jockey.trim() : null,
        dividend: Number(editForm.dividend),
      });

      setEditingId(null);
      setSuccess('Caballo actualizado correctamente.');
      await loadRace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setHorseSaving(false);
    }
  };

  const handleDeleteHorse = async (horse) => {
    const isConfirmed = await showConfirm({
      title: '¿Eliminar caballo?',
      text: `¿Eliminar el caballo "${horse.name}"?`,
      confirmButtonText: 'Sí, eliminar',
      isDestructive: true,
    });

    if (!isConfirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/admin/races/${raceId}/horses/${horse.id}`);
      setSuccess('Caballo eliminado correctamente.');
      await loadRace();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleToggleRetire = async (horse) => {
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/admin/races/${raceId}/horses/${horse.id}/retire`, {
        is_retired: !horse.is_retired,
      });

      setSuccess(
        !horse.is_retired
          ? `Ejemplar N° ${horse.number} (${horse.name}) MARCADO COMO RETIRADO.`
          : `Ejemplar N° ${horse.number} (${horse.name}) habilitado nuevamente.`
      );
      await loadRace();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleSetWinner = async (horse) => {
    if (horse.is_retired) {
      setError('Un caballo retirado no puede ser marcado como ganador.');
      return;
    }

    const dividendInput = await showPrompt({
      title: 'Dividendo Oficial',
      text: `Ingresa el Dividendo Oficial que paga a ganador el ejemplar N° ${horse.number} (${horse.name}):`,
      inputValue: horse.dividend && Number(horse.dividend) > 0 ? String(horse.dividend) : '2.50',
      inputPlaceholder: 'Ej: 2.50',
      confirmButtonText: 'Establecer Ganador',
      cancelButtonText: 'Cancelar',
    });

    if (dividendInput === null) return;
    const parsedDiv = parseFloat(dividendInput.replace(',', '.'));
    if (isNaN(parsedDiv) || parsedDiv < 0) {
      setError('Debes ingresar un número válido y positivo para el dividendo oficial.');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.put(`/admin/races/${raceId}/result`, {
        winner_horse_id: horse.id,
        winner_dividend: parsedDiv,
      });
      setSuccess(`Ganador registrado: N° ${horse.number} - ${horse.name} (Dividendo: Bs. ${parsedDiv.toFixed(2)}).`);
      await loadRace();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleClearResult = async () => {
    setError(null);
    setSuccess(null);

    try {
      await api.put(`/admin/races/${raceId}/result`, { winner_horse_id: null });
      setSuccess('Resultado eliminado. La carrera vuelve a estar programada.');
      await loadRace();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) {
    return <p className="empty">Cargando carrera...</p>;
  }

  if (!race) {
    return (
      <div>
        <div className="alert alert-error">{error ?? 'Carrera no encontrada.'}</div>
        <Link className="btn btn-secondary" to="/races">
          Volver a Hipismo
        </Link>
      </div>
    );
  }

  const isFinished = race.status === 'finished';
  const nextNumber = race.horses.length + 1;

  return (
    <div>
      <header className="page-header">
        <div>
          <Link
            to="/races"
            style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}
          >
            ← Volver a Programación de Hipismo
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
            <h1 className="page-title">{race.name}</h1>
            {race.is_valida && (
              <span style={{ background: 'rgba(245, 158, 11, 0.18)', color: '#d97706', border: '1px solid #d97706', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700 }}>
                ⭐ {race.valida_number ? `${race.valida_number}ª Válida (5 y 6)` : 'Válida 5 y 6'}
              </span>
            )}
            {race.meeting && (
              <span style={{ background: 'var(--bg-canvas-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                📍 {race.meeting}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
            {race.track || 'Sin hipódromo'} · {formatRaceDate(race.race_date)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className={isFinished ? 'status-finished' : 'status-pending'}>
            {isFinished ? 'Finalizada' : 'Programada'}
          </span>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {race.winner && (
        <div
          className="alert alert-success"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong>Ganador Oficial:</strong> N° {race.winner.number} - {race.winner.name} (dividendo{' '}
            {Number(race.winner.dividend).toFixed(2)})
            {race.second && <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>| 🥈 2° N° {race.second.number} - {race.second.name}</span>}
            {race.third && <span style={{ marginLeft: '1rem', color: '#d97706' }}>| 🥉 3° N° {race.third.number} - {race.third.name}</span>}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleClearResult}>
            Quitar resultado
          </button>
        </div>
      )}

      <section className="card">
        <h2 className="card-title">Datos de la carrera</h2>

        <form className="form-row" onSubmit={handleSaveRace}>
          <div className="form-field">
            <label htmlFor="detail-race-name">Nombre</label>
            <input
              id="detail-race-name"
              className="input"
              type="text"
              value={raceForm.name}
              onChange={(event) => setRaceForm({ ...raceForm, name: event.target.value })}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="detail-race-meeting">N° Reunión / Jornada</label>
            <input
              id="detail-race-meeting"
              className="input"
              type="text"
              value={raceForm.meeting}
              onChange={(event) => setRaceForm({ ...raceForm, meeting: event.target.value })}
              placeholder="Ej: Reunión 42"
            />
          </div>

          <div className="form-field">
            <label htmlFor="detail-race-track">Hipódromo</label>
            <input
              id="detail-race-track"
              className="input"
              type="text"
              value={raceForm.track}
              onChange={(event) => setRaceForm({ ...raceForm, track: event.target.value })}
              placeholder="Ej: La Rinconada"
            />
          </div>

          <div className="form-field">
            <label htmlFor="detail-race-date">Fecha y hora</label>
            <input
              id="detail-race-date"
              className="input"
              type="datetime-local"
              value={raceForm.race_date}
              onChange={(event) =>
                setRaceForm({ ...raceForm, race_date: event.target.value })
              }
            />
          </div>

          <div className="form-field" style={{ maxWidth: '170px' }}>
            <label htmlFor="detail-race-ganador-price">Valor 1 Ganador (VES)</label>
            <input
              id="detail-race-ganador-price"
              className="input"
              type="number"
              step="0.01"
              min="0.01"
              value={raceForm.ganador_price}
              onChange={(event) =>
                setRaceForm({ ...raceForm, ganador_price: event.target.value })
              }
              placeholder="100.00"
            />
          </div>

          <div className="form-field" style={{ minWidth: '180px' }}>
            <label htmlFor="detail-race-is-valida" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontWeight: 600, color: raceForm.is_valida ? '#f59e0b' : 'inherit' }}>
              <input
                id="detail-race-is-valida"
                type="checkbox"
                checked={raceForm.is_valida}
                onChange={(e) => setRaceForm({ ...raceForm, is_valida: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: '#f59e0b' }}
              />
              <span>⭐ Válida del 5 y 6</span>
            </label>
            {raceForm.is_valida && (
              <select
                id="detail-race-valida-number"
                className="input input-sm"
                style={{ marginTop: '0.4rem', borderColor: '#f59e0b' }}
                value={raceForm.valida_number}
                onChange={(e) => setRaceForm({ ...raceForm, valida_number: e.target.value })}
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

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar datos'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="card-title">Caballos Inscritos</h2>

        <form
          className="form-row"
          onSubmit={handleAddHorse}
          style={{ marginBottom: '1.25rem' }}
        >
          <div className="form-field" style={{ maxWidth: '110px' }}>
            <label htmlFor="horse-number">N°</label>
            <input
              id="horse-number"
              className="input"
              type="number"
              min="1"
              value={horseForm.number}
              onChange={(event) =>
                setHorseForm({ ...horseForm, number: event.target.value })
              }
              placeholder={String(nextNumber)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="horse-name">Caballo</label>
            <input
              id="horse-name"
              className="input"
              type="text"
              value={horseForm.name}
              onChange={(event) => setHorseForm({ ...horseForm, name: event.target.value })}
              placeholder="Nombre del caballo"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="horse-jockey">Jinete / Jockey</label>
            <input
              id="horse-jockey"
              className="input"
              type="text"
              value={horseForm.jockey}
              onChange={(event) => setHorseForm({ ...horseForm, jockey: event.target.value })}
              placeholder="Ej: R. Capriles"
            />
          </div>

          <div className="form-field" style={{ maxWidth: '160px' }}>
            <label htmlFor="horse-dividend">Dividendo fijo</label>
            <input
              id="horse-dividend"
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={horseForm.dividend}
              onChange={(event) =>
                setHorseForm({ ...horseForm, dividend: event.target.value })
              }
              placeholder="0.00"
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={horseSaving}>
            {horseSaving ? 'Guardando...' : 'Agregar caballo'}
          </button>
        </form>

        {race.horses.length === 0 ? (
          <p className="empty">Aún no hay caballos en esta carrera.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Caballo</th>
                <th>Jinete</th>
                <th>Dividendo fijo</th>
                <th>Retirado</th>
                <th>Resultado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {race.horses.map((horse) => {
                const isEditing = editingId === horse.id;
                const isWinner = race.winner_horse_id === horse.id;

                return (
                  <tr key={horse.id} className={horse.is_retired ? 'horse-retired-row' : ''}>
                    <td>
                      {isEditing ? (
                        <input
                          className="input input-sm"
                          type="number"
                          min="1"
                          value={editForm.number}
                          onChange={(event) =>
                            setEditForm({ ...editForm, number: event.target.value })
                          }
                          style={{ width: '75px' }}
                        />
                      ) : (
                        <span className="badge-number">{horse.number}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="input input-sm"
                          type="text"
                          value={editForm.name}
                          onChange={(event) =>
                            setEditForm({ ...editForm, name: event.target.value })
                          }
                        />
                      ) : (
                        <strong>{horse.name}</strong>
                      )}
                      {horse.is_retired && (
                        <span className="badge-retired" style={{ marginLeft: '0.5rem' }}>
                          RETIRADO
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="input input-sm"
                          type="text"
                          value={editForm.jockey}
                          onChange={(event) =>
                            setEditForm({ ...editForm, jockey: event.target.value })
                          }
                          placeholder="Jinete"
                        />
                      ) : horse.jockey ? (
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{horse.jockey}</span>
                      ) : (
                        <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: '0.8rem' }}>Sin jinete</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="input input-sm"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.dividend}
                          onChange={(event) =>
                            setEditForm({ ...editForm, dividend: event.target.value })
                          }
                          style={{ width: '110px' }}
                        />
                      ) : (
                        Number(horse.dividend).toFixed(2)
                      )}
                    </td>
                    <td>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input
                          type="checkbox"
                          checked={horse.is_retired}
                          onChange={() => handleToggleRetire(horse)}
                        />
                        <span>{horse.is_retired ? 'Retirado' : 'Activo'}</span>
                      </label>
                    </td>
                    <td>
                      {isWinner ? (
                        <span className="status-finished">Ganador</span>
                      ) : horse.is_retired ? (
                        <span style={{ color: 'var(--text-disabled)', fontSize: '0.8rem' }}>No disponible</span>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSetWinner(horse)}
                        >
                          Marcar ganador
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        {isEditing ? (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleUpdateHorse(horse.id)}
                              disabled={horseSaving}
                            >
                              Guardar
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setEditingId(null)}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => startEdit(horse)}
                            >
                              Editar
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteHorse(horse)}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
