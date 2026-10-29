import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';

export default function LotteryDetail() {
  const { lotteryId } = useParams();
  const [lottery, setLottery] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [payoutMultiplier, setPayoutMultiplier] = useState(null);
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
          <Link to="/lotteries" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.85rem' }}>
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
        <button
          className="btn btn-primary"
          onClick={handleSaveLottery}
          disabled={saving}
          style={{ marginTop: '0.25rem' }}
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
