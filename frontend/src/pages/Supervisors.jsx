import { useEffect, useState } from 'react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';

const emptyForm = { name: '', email: '', password: '', agency_id: '' };

export default function Supervisors() {
  const [supervisors, setSupervisors] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadData = async () => {
    try {
      const [agenciesResponse, supervisorsResponse] = await Promise.all([
        api.get('/admin/agencies'),
        api.get('/admin/supervisors'),
      ]);

      setAgencies(agenciesResponse.data.data);
      setSupervisors(supervisorsResponse.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: form.name,
      email: form.email,
      agency_id: Number(form.agency_id),
    };

    if (form.password) {
      payload.password = form.password;
    }

    try {
      if (editingId) {
        await api.put(`/admin/supervisors/${editingId}`, payload);
        setSuccess('Supervisor actualizado correctamente.');
      } else {
        await api.post('/admin/supervisors', payload);
        setSuccess('Supervisor registrado correctamente.');
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (supervisor) => {
    setEditingId(supervisor.id);
    setForm({
      name: supervisor.name,
      email: supervisor.email,
      password: '',
      agency_id: String(supervisor.agency_id ?? ''),
    });
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  };

  const handleDelete = async (supervisor) => {
    if (!window.confirm(`¿Eliminar al supervisor "${supervisor.name}"?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/admin/supervisors/${supervisor.id}`);
      setSuccess('Supervisor eliminado correctamente.');
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Supervisores</h1>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {agencies.length === 0 && (
        <div className="alert alert-info">
          Primero debes registrar una agencia para poder crear supervisores.
        </div>
      )}

      <section className="card">
        <h2 className="card-title">{editingId ? 'Editar supervisor' : 'Registrar supervisor'}</h2>

        <form className="form-row" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="supervisor-name">Nombre</label>
            <input
              id="supervisor-name"
              className="input"
              type="text"
              value={form.name}
              onChange={updateField('name')}
              placeholder="Nombre completo"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="supervisor-email">Correo electrónico</label>
            <input
              id="supervisor-email"
              className="input"
              type="email"
              value={form.email}
              onChange={updateField('email')}
              placeholder="correo@ejemplo.com"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="supervisor-password">
              Contraseña {editingId && '(dejar en blanco para no cambiar)'}
            </label>
            <input
              id="supervisor-password"
              className="input"
              type="password"
              value={form.password}
              onChange={updateField('password')}
              placeholder="Mínimo 6 caracteres"
              required={!editingId}
            />
          </div>

          <div className="form-field">
            <label htmlFor="supervisor-agency">Agencia</label>
            <select
              id="supervisor-agency"
              className="input"
              value={form.agency_id}
              onChange={updateField('agency_id')}
              required
            >
              <option value="">Seleccionar agencia</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </select>
          </div>

          <button className="btn btn-primary" type="submit" disabled={saving || agencies.length === 0}>
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
        <h2 className="card-title">Supervisores registrados</h2>

        {loading ? (
          <p className="empty">Cargando supervisores...</p>
        ) : supervisors.length === 0 ? (
          <p className="empty">Aún no hay supervisores registrados.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Agencia</th>
                <th>Taquillas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {supervisors.map((supervisor) => (
                <tr key={supervisor.id}>
                  <td>{supervisor.name}</td>
                  <td>{supervisor.email}</td>
                  <td>{supervisor.agency?.name ?? 'Sin agencia'}</td>
                  <td>{supervisor.taquillas_count}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(supervisor)}>
                        Editar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(supervisor)}>
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
