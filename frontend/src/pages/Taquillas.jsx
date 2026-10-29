import { useEffect, useState } from 'react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';

const emptyForm = { name: '', email: '', password: '' };

export default function Taquillas() {
  const [taquillas, setTaquillas] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadTaquillas = async () => {
    try {
      const response = await api.get('/supervisor/taquillas');
      setTaquillas(response.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaquillas();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: form.name,
      email: form.email,
    };

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
    setForm({ name: taquilla.name, email: taquilla.email, password: '' });
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
    if (!window.confirm(`¿Eliminar la taquilla "${taquilla.name}"?`)) {
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

        <form className="form-row" onSubmit={handleSubmit}>
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

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Registrar'}
          </button>

          {editingId && (
            <button className="btn btn-secondary" type="button" onClick={handleCancel}>
              Cancelar
            </button>
          )}
        </form>

        <p className="empty" style={{ paddingTop: '0.75rem' }}>
          La taquilla queda asignada automáticamente a tu agencia y a tu usuario.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Taquillas registradas</h2>

        {loading ? (
          <p className="empty">Cargando taquillas...</p>
        ) : taquillas.length === 0 ? (
          <p className="empty">Aún no has registrado taquillas.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Registrada</th>
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
        )}
      </section>
    </div>
  );
}
