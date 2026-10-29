import { useEffect, useState } from 'react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';

export default function Limits() {
  const [agencies, setAgencies] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadAgencies = async () => {
    try {
      const response = await api.get('/admin/agencies');
      const data = response.data.data;

      setAgencies(data);
      setDrafts(
        Object.fromEntries(
          data.map((agency) => [
            agency.id,
            {
              max_bet_amount: agency.max_bet_amount ?? '',
              max_ticket_payout: agency.max_ticket_payout ?? '',
            },
          ]),
        ),
      );
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

  const updateDraft = (id, field, value) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  };

  const handleSave = async (agency) => {
    const draft = drafts[agency.id];

    setSavingId(agency.id);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/admin/agencies/${agency.id}/limits`, {
        max_bet_amount: draft.max_bet_amount === '' ? null : Number(draft.max_bet_amount),
        max_ticket_payout: draft.max_ticket_payout === '' ? null : Number(draft.max_ticket_payout),
      });

      setSuccess(`Topes de "${agency.name}" guardados correctamente.`);
      await loadAgencies();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Topes por agencia</h1>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="alert alert-info">
        Deja un campo vacío para que esa agencia no tenga límite.
      </div>

      <section className="card">
        {loading ? (
          <p className="empty">Cargando agencias...</p>
        ) : agencies.length === 0 ? (
          <p className="empty">
            Aún no hay agencias registradas. Crea una en la sección Agencias.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Agencia</th>
                <th>Monto máximo por apuesta</th>
                <th>Ganancia máxima por ticket</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((agency) => (
                <tr key={agency.id}>
                  <td>{agency.name}</td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Sin límite"
                      value={drafts[agency.id]?.max_bet_amount ?? ''}
                      onChange={(event) =>
                        updateDraft(agency.id, 'max_bet_amount', event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Sin límite"
                      value={drafts[agency.id]?.max_ticket_payout ?? ''}
                      onChange={(event) =>
                        updateDraft(agency.id, 'max_ticket_payout', event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSave(agency)}
                      disabled={savingId === agency.id}
                    >
                      {savingId === agency.id ? 'Guardando...' : 'Guardar'}
                    </button>
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
