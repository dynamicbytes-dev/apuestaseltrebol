import { useEffect, useState } from 'react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';

const emptyForm = { name: '' };

export default function Agencies() {
  const [agencies, setAgencies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadAgencies = async () => {
    try {
      const response = await api.get('/admin/agencies');
      setAgencies(response.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgencies();
  }, []);

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
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((agency) => (
                <tr key={agency.id}>
                  <td>{agency.name}</td>
                  <td>{agency.supervisors_count}</td>
                  <td>{agency.taquillas_count}</td>
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
