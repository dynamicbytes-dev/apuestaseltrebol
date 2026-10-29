import { useEffect, useState, useCallback } from 'react';
import { Calendar, Percent } from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { formatAmount } from '../utils/tickets';

const emptyForm = { name: '' };

export default function Agencies() {
  const [agencies, setAgencies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const loadAgencies = useCallback(async () => {
    try {
      const response = await api.get('/admin/agencies', {
        params: {
          from: from || undefined,
          to: to || undefined,
        },
      });
      setAgencies(response.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadAgencies();
  }, [loadAgencies]);

  // El porcentaje de comisión es el mismo para todas las agencias.
  const sharePercentage = agencies[0]?.sales?.share_percentage ?? 1.5;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingId) {
        await api.put(`/admin/agencies/${editingId}`, form);
        setSuccess('Agencia actualizada correctamente.');
      } else {
        await api.post('/admin/agencies', form);
        setSuccess('Agencia registrada correctamente.');
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadAgencies();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (agency) => {
    setEditingId(agency.id);
    setForm({ name: agency.name });
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  };

  const handleDelete = async (agency) => {
    if (!window.confirm(`¿Eliminar la agencia "${agency.name}"?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/admin/agencies/${agency.id}`);
      setSuccess('Agencia eliminada correctamente.');
      await loadAgencies();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Agencias</h1>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <section className="card">
        <h2 className="card-title">{editingId ? 'Editar agencia' : 'Registrar agencia'}</h2>

        <form className="form-row" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="agency-name">Nombre de la agencia</label>
            <input
              id="agency-name"
              className="input"
              type="text"
              value={form.name}
              onChange={(event) => setForm({ name: event.target.value })}
              placeholder="Ej: Agencia Central"
              required
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Registrar'}
          </button>

          {editingId && (
            <button className="btn btn-secondary" type="button" onClick={handleCancel}>
              Cancelar
            </button>
          )}
        </form>
      </section>

      <section className="card">
        <h2 className="card-title">Agencias registradas</h2>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '0.85rem',
            flexWrap: 'wrap',
            marginBottom: '1rem',
            padding: '0.75rem 0.9rem',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="form-field" style={{ margin: 0 }}>
            <label htmlFor="agency-from">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} color="#38bdf8" />
                <strong>Ventas desde</strong>
              </span>
            </label>
            <input
              id="agency-from"
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div className="form-field" style={{ margin: 0 }}>
            <label htmlFor="agency-to">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} color="#38bdf8" />
                <strong>Hasta</strong>
              </span>
            </label>
            <input
              id="agency-to"
              className="input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', paddingBottom: '0.15rem' }}>
            {[
              { label: 'Hoy', days: 0 },
              { label: '7 días', days: 7 },
              { label: '30 días', days: 30 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const hasta = new Date();
                  const desde = new Date();
                  desde.setDate(hasta.getDate() - preset.days);

                  setFrom(desde.toISOString().slice(0, 10));
                  setTo(hasta.toISOString().slice(0, 10));
                }}
              >
                {preset.label}
              </button>
            ))}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              Todo
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginLeft: 'auto',
              fontSize: '0.78rem',
              color: 'var(--text-tertiary)',
            }}
          >
            <Percent size={14} color="#34d399" />
            <span>
              Comisión de cada agencia: <strong style={{ color: '#34d399' }}>{sharePercentage}%</strong> de sus ventas
            </span>
          </div>
        </div>

        {loading ? (
          <p className="empty">Cargando agencias...</p>
        ) : agencies.length === 0 ? (
          <p className="empty">Aún no hay agencias registradas.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Supervisores</th>
                <th>Taquillas</th>
                <th>Ventas</th>
                <th>Comisión ({sharePercentage}%)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((agency) => (
                <tr key={agency.id}>
                  <td>{agency.name}</td>
                  <td>{agency.supervisors_count}</td>
                  <td>{agency.taquillas_count}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatAmount(agency.sales?.stake)}
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginLeft: '0.35rem' }}>
                      ({agency.sales?.tickets ?? 0} tickets)
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(agency.sales?.share_amount)}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(agency)}>
                        Editar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(agency)}>
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
    </div>
  );
}
