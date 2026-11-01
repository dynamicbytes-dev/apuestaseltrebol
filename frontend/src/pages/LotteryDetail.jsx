import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';

// Horario de juego de las loterías: de 8:00 a 19:00 en punto.
const HORARIOS_COMUNES = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
];

export default function LotteryDetail() {
  const { lotteryId } = useParams();
  const [lottery, setLottery] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [payoutMultiplier, setPayoutMultiplier] = useState(null);
  const [drawTimes, setDrawTimes] = useState([]);
  const [newDrawTime, setNewDrawTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadLottery = async () => {
    try {
      const response = await api.get(`/admin/lotteries/${lotteryId}`);
      setLottery(response.data.data);
      setAnimals(response.data.data.animals);
      setPayoutMultiplier(response.data.data.payout_multiplier);
      setDrawTimes(response.data.data.draw_times ?? []);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLottery();
  }, [lotteryId]);

  const updateAnimal = (id, field, value) => {
    setAnimals((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const addDrawTime = () => {
    const value = newDrawTime.trim();

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      setError('El horario debe tener el formato HH:MM (ej: 09:00, 19:30).');
      return;
    }

    if (drawTimes.includes(value)) {
      setError('Ese horario ya está en la lista.');
      return;
    }

    setDrawTimes((prev) => [...prev, value].sort());
    setNewDrawTime('');
    setError(null);
  };

  const removeDrawTime = (value) => {
    setDrawTimes((prev) => prev.filter((item) => item !== value));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.put(`/admin/lotteries/${lotteryId}/animals`, {
        animals: animals.map(({ id, animal, is_enabled }) => ({ id, animal, is_enabled })),
      });
      setSuccess('Animalitos actualizados correctamente.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLottery = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.put(`/admin/lotteries/${lotteryId}`, {
        name: lottery.name,
        is_active: lottery.is_active,
        payout_multiplier: Number(payoutMultiplier) ?? 30,
        draw_times: drawTimes,
      });
      setSuccess('Datos de la lotería actualizados correctamente.');
      await loadLottery();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="empty">Cargando lotería...</p>;
  }

  if (!lottery) {
    return (
      <div>
        <div className="alert alert-error">{error ?? 'Lotería no encontrada.'}</div>
        <Link className="btn btn-secondary" to="/lotteries">
          Volver a Loterías
        </Link>
      </div>
    );
  }

  const enabledCount = animals.filter((animal) => animal.is_enabled).length;

  return (
    <div>
      <header className="page-header">
        <div>
          <Link to="/lotteries" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
            ← Volver a Loterías
          </Link>
          <h1 className="page-title" style={{ marginTop: '0.35rem' }}>
            {lottery.name}
          </h1>
        </div>

        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="alert alert-info">
        Números habilitados: {enabledCount} de {animals.length}. Desmarca un número para
        inhabilitarlo.
      </div>

      <div className="alert alert-info">
        <label className="form-label">Multiplicador de pago</label>
        <input
          className="input"
          type="number"
          min="1"
          max="1000"
          value={payoutMultiplier !== null ? String(payoutMultiplier) : ''}
          onChange={(e) => setPayoutMultiplier(Number(e.target.value) || null)}
          placeholder="30 (por defecto)"
          style={{ width: '100%', marginBottom: '0.5rem' }}
        />

        <label className="form-label" style={{ marginTop: '0.75rem', display: 'block' }}>
          Horarios de sorteo
        </label>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
          Las horas del día en las que se juega esta lotería. Son las que la taquilla
          puede elegir al apostar: sin horarios, la lotería no admite apuestas.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
          {drawTimes.length === 0 ? (
            <span style={{ fontSize: '0.82rem', color: '#f59e0b' }}>
              Sin horarios configurados: esta lotería no admite apuestas.
            </span>
          ) : (
            drawTimes.map((hora) => (
              <span
                key={hora}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid var(--accent-sky)',
                  color: 'var(--accent-sky)',
                  padding: '0.2rem 0.35rem 0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                {hora}
                <button
                  type="button"
                  onClick={() => removeDrawTime(hora)}
                  title="Quitar horario"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: 0,
                  }}
                >
                  <X size={13} />
                </button>
              </span>
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input"
            type="time"
            value={newDrawTime}
            onChange={(e) => setNewDrawTime(e.target.value)}
            style={{ maxWidth: '160px' }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={addDrawTime}
          >
            <Plus size={14} />
            <span>Agregar horario</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.6rem' }}>
          {HORARIOS_COMUNES.filter((hora) => !drawTimes.includes(hora)).map((hora) => (
            <button
              key={hora}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setDrawTimes((prev) => [...prev, hora].sort());
                setError(null);
              }}
              style={{ fontFamily: 'var(--font-mono)', padding: '0.15rem 0.45rem' }}
              title="Agregar este horario"
            >
              + {hora}
            </button>
          ))}
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSaveLottery}
          disabled={saving}
          style={{ marginTop: '0.75rem' }}
        >
          {saving ? 'Guardando...' : 'Guardar datos'}
        </button>
      </div>

      <div className="animal-grid">
        {animals.map((animal) => (
          <div
            key={animal.id}
            className={`animal-card${animal.is_enabled ? '' : ' is-disabled'}`}
          >
            <div className="animal-number">
              <span>N° {animal.number}</span>
              <label className="animal-toggle">
                <input
                  type="checkbox"
                  checked={animal.is_enabled}
                  onChange={(event) =>
                    updateAnimal(animal.id, 'is_enabled', event.target.checked)
                  }
                />
                Habilitado
              </label>
            </div>

            <input
              className="input"
              type="text"
              value={animal.animal}
              onChange={(event) => updateAnimal(animal.id, 'animal', event.target.value)}
              required
            />
          </div>
        ))}
      </div>
    </div>
  );
}
