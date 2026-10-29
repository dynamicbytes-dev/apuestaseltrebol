import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';

const emptyHorseForm = { number: '', name: '', dividend: '' };

function formatRaceDate(value) {
  if (!value) return '—';

  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-');

  return `${day}/${month}/${year}${time ? ` ${time}` : ''}`;
}

export default function RaceDetail() {
  const { raceId } = useParams();
  const [race, setRace] = useState(null);
  const [raceForm, setRaceForm] = useState({ name: '', meeting: '', track: '', race_date: '' });
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
        dividend: Number(horseForm.dividend),
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
    if (!window.confirm(`¿Eliminar el caballo "${horse.name}"?`)) {
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

    setError(null);
    setSuccess(null);

    try {
      await api.put(`/admin/races/${raceId}/result`, { winner_horse_id: horse.id });
      setSuccess(`Ganador registrado: N° ${horse.number} - ${horse.name}.`);
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
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.85rem' }}
          >
            ← Volver a Programación de Hipismo
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem' }}>
            <h1 className="page-title">{race.name}</h1>
            {race.meeting && (
              <span style={{ background: '#1e3a5f', color: '#93c5fd', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                {race.meeting}
              </span>
            )}
          </div>
          <p className="empty" style={{ padding: '0.25rem 0 0' }}>
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
            {race.second && <span style={{ marginLeft: '1rem', color: '#cbd5e1' }}>| 🥈 2° N° {race.second.number} - {race.second.name}</span>}
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
                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No disponible</span>
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
