import { useEffect, useState, useCallback } from 'react';
import { Calendar, Percent } from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { formatAmount } from '../utils/tickets';
import { showConfirm } from '../utils/swal';

const emptyForm = { name: '', email: '', password: '', commission_percentage: '13' };

export default function Taquillas() {
  const [taquillas, setTaquillas] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const loadTaquillas = useCallback(async () => {
    try {
      const response = await api.get('/supervisor/taquillas', {
        params: {
          from: from || undefined,
          to: to || undefined,
        },
      });
      setTaquillas(response.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadTaquillas();
  }, [loadTaquillas]);

  // El porcentaje es propio de cada taquilla.

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: form.name,
      email: form.email,
    };

    if (form.commission_percentage !== '' && form.commission_percentage !== null) {
      payload.commission_percentage = Number(form.commission_percentage);
    }

    if (form.password) {
      payload.password = form.password;
    }

    try {
      if (editingId) {
        await api.put(`/supervisor/taquillas/${editingId}`, payload);
        setSuccess('Taquilla actualizada correctamente.');
      } else {
        await api.post('/supervisor/taquillas', payload);
        setSuccess('Taquilla registrada correctamente.');
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadTaquillas();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (taquilla) => {
    setEditingId(taquilla.id);
    setForm({
      name: taquilla.name,
      email: taquilla.email,
      password: '',
      commission_percentage: String(taquilla.commission_percentage ?? ''),
    });
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setSuccess(null);
  };

  const handleDelete = async (taquilla) => {
    const isConfirmed = await showConfirm({
      title: '¿Eliminar taquilla?',
      text: `¿Eliminar la taquilla "${taquilla.name}"?`,
      confirmButtonText: 'Sí, eliminar',
      isDestructive: true,
    });

    if (!isConfirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/supervisor/taquillas/${taquilla.id}`);
      setSuccess('Taquilla eliminada correctamente.');

      if (editingId === taquilla.id) {
        setEditingId(null);
        setForm(emptyForm);
      }

      await loadTaquillas();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Taquillas</h1>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <section className="card">
        <h2 className="card-title">
          {editingId ? 'Editar taquilla' : 'Registrar taquilla'}
        </h2>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="taquilla-name">Nombre</label>
            <input
              id="taquilla-name"
              className="input"
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Nombre de la taquilla"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="taquilla-email">Email</label>
            <input
              id="taquilla-email"
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="taquilla@ejemplo.com"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="taquilla-password">
              Contraseña {editingId ? '(opcional)' : ''}
            </label>
            <input
              id="taquilla-password"
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder={editingId ? 'Dejar vacío para mantener' : 'Mínimo 6 caracteres'}
              required={!editingId}
              minLength={6}
            />
          </div>

          <div className="form-field">
            <label htmlFor="taquilla-comision">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Percent size={14} color="#34d399" />
                <strong>Porcentaje de comisión</strong>
              </span>
            </label>
            <input
              id="taquilla-comision"
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.commission_percentage}
              onChange={(event) => setForm({ ...form, commission_percentage: event.target.value })}
              placeholder="13.00"
            />
            <span className="form-hint">
              Porcentaje que te corresponde sobre las ventas de esta taquilla.
            </span>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Registrar'}
            </button>

            {editingId && (
              <button className="btn btn-secondary" type="button" onClick={handleCancel}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        <p className="form-note">
          La taquilla queda asignada automáticamente a tu agencia y a tu usuario. El
          porcentaje de comisión es propio de cada taquilla y se aplica sobre sus ventas.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Taquillas registradas</h2>

        {loading ? (
          <p className="empty">Cargando taquillas...</p>
        ) : taquillas.length === 0 ? (
          <p className="empty">Aún no has registrado taquillas.</p>
        ) : (
          <>
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
                <label htmlFor="taq-from">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={14} color="#38bdf8" />
                    <strong>Ventas desde</strong>
                  </span>
                </label>
                <input
                  id="taq-from"
                  className="input"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>

              <div className="form-field" style={{ margin: 0 }}>
                <label htmlFor="taq-to">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={14} color="#38bdf8" />
                    <strong>Hasta</strong>
                  </span>
                </label>
                <input
                  id="taq-to"
                  className="input"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
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
                  Cada taquilla tiene su propio porcentaje de comisión, que se aplica
                  sobre sus ventas.
                </span>
              </div>
            </div>

            <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Registrada</th>
                <th>Ventas</th>
                <th>Comisión</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {taquillas.map((taquilla) => (
                <tr key={taquilla.id}>
                  <td>{taquilla.name}</td>
                  <td>{taquilla.email}</td>
                  <td>
                    {taquilla.created_at
                      ? new Date(taquilla.created_at).toLocaleDateString('es-VE')
                      : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatAmount(taquilla.sales?.stake)}
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginLeft: '0.35rem' }}>
                      ({taquilla.sales?.tickets ?? 0} {taquilla.sales?.tickets === 1 ? 'ticket' : 'tickets'})
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(taquilla.sales?.share_amount)}
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '0.35rem' }}>
                      ({Number(taquilla.sales?.share_percentage ?? 0).toFixed(2)}%)
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(taquilla)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(taquilla)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}
