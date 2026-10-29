import { useEffect, useState, useCallback } from 'react';
import { Save, Building2, Store, Info } from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { formatAmount } from '../utils/tickets';

export default function Topes() {
  const [agency, setAgency] = useState(null);
  const [taquillas, setTaquillas] = useState([]);
  const [agencyDraft, setAgencyDraft] = useState({ max_bet_amount: '', max_ticket_payout: '' });
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/supervisor/limits');
      const data = response.data.data;

      setAgency(data.agency);
      setTaquillas(data.taquillas ?? []);

      setAgencyDraft({
        max_bet_amount: data.agency?.max_bet_amount ?? '',
        max_ticket_payout: data.agency?.max_ticket_payout ?? '',
      });

      setDrafts(
        Object.fromEntries(
          (data.taquillas ?? []).map((taquilla) => [
            taquilla.id,
            {
              max_bet_amount: taquilla.max_bet_amount ?? '',
              max_ticket_payout: taquilla.max_ticket_payout ?? '',
            },
          ])
        )
      );

      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateDraft = (id, field, value) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  };

  const handleSaveAgency = async () => {
    setSaving('agency');
    setError(null);
    setSuccess(null);

    try {
      await api.patch('/supervisor/limits', {
        max_bet_amount: agencyDraft.max_bet_amount === '' ? null : Number(agencyDraft.max_bet_amount),
        max_ticket_payout: agencyDraft.max_ticket_payout === '' ? null : Number(agencyDraft.max_ticket_payout),
      });

      setSuccess(`Topes de "${agency?.name}" guardados.`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const handleSaveTaquilla = async (taquilla) => {
    const draft = drafts[taquilla.id];

    setSaving(taquilla.id);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/supervisor/taquillas/${taquilla.id}/limits`, {
        max_bet_amount: draft.max_bet_amount === '' ? null : Number(draft.max_bet_amount),
        max_ticket_payout: draft.max_ticket_payout === '' ? null : Number(draft.max_ticket_payout),
      });

      setSuccess(`Topes de "${taquilla.name}" guardados.`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <span>Topes y Límites</span>
            <span className="page-title-badge">Mi Agencia</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            Define cuánto puede apostar cada taquilla y cuánto puede premio por ticket.
          </p>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="alert alert-info" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
        <span>
          Deja un campo vacío para que no haya límite. Los topes de la agencia son el valor
          por defecto: si una taquilla tiene topes propios, mandan los suyos.
        </span>
      </div>

      {/* TOPES DE LA AGENCIA */}
      <section className="card" style={{ marginBottom: '1.25rem' }}>
        <h2 className="card-title">
          <span className="card-title-label">
            <Building2 size={16} style={{ verticalAlign: '-2px', marginRight: '0.35rem' }} />
            Topes de la agencia {agency?.name ? `· ${agency.name}` : ''}
          </span>
        </h2>

        {loading ? (
          <p className="empty">Cargando topes...</p>
        ) : (
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="agency-max-bet">Monto máximo por apuesta</label>
              <input
                id="agency-max-bet"
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="Sin límite"
                value={agencyDraft.max_bet_amount}
                onChange={(e) =>
                  setAgencyDraft((current) => ({ ...current, max_bet_amount: e.target.value }))
                }
              />
              <span className="form-hint">Máximo que se puede apostar en un ticket.</span>
            </div>

            <div className="form-field">
              <label htmlFor="agency-max-payout">Ganancia máxima por ticket</label>
              <input
                id="agency-max-payout"
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="Sin límite"
                value={agencyDraft.max_ticket_payout}
                onChange={(e) =>
                  setAgencyDraft((current) => ({ ...current, max_ticket_payout: e.target.value }))
                }
              />
              <span className="form-hint">Máximo del premio potencial de un ticket.</span>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAgency}
                disabled={saving === 'agency'}
              >
                <Save size={15} />
                <span>{saving === 'agency' ? 'Guardando...' : 'Guardar topes de la agencia'}</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* TOPES POR TAQUILLA */}
      <section className="card">
        <h2 className="card-title">
          <span className="card-title-label">
            <Store size={16} style={{ verticalAlign: '-2px', marginRight: '0.35rem' }} />
            Topes por taquilla
          </span>
        </h2>

        {loading ? (
          <p className="empty">Cargando taquillas...</p>
        ) : taquillas.length === 0 ? (
          <p className="empty">Aún no tienes taquillas registradas.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Taquilla</th>
                  <th>Monto máximo por apuesta</th>
                  <th>Ganancia máxima por ticket</th>
                  <th>Vigente ahora</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {taquillas.map((taquilla) => (
                  <tr key={taquilla.id}>
                    <td>
                      <strong>{taquilla.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{taquilla.email}</div>
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Heredado"
                        value={drafts[taquilla.id]?.max_bet_amount ?? ''}
                        onChange={(e) => updateDraft(taquilla.id, 'max_bet_amount', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Heredado"
                        value={drafts[taquilla.id]?.max_ticket_payout ?? ''}
                        onChange={(e) => updateDraft(taquilla.id, 'max_ticket_payout', e.target.value)}
                      />
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {taquilla.effective?.max_bet_amount !== null &&
                      taquilla.effective?.max_bet_amount !== undefined ? (
                        <div>Apuesta: {formatAmount(taquilla.effective.max_bet_amount)}</div>
                      ) : (
                        <div>Apuesta: sin límite</div>
                      )}
                      {taquilla.effective?.max_ticket_payout !== null &&
                      taquilla.effective?.max_ticket_payout !== undefined ? (
                        <div>Premio: {formatAmount(taquilla.effective.max_ticket_payout)}</div>
                      ) : (
                        <div>Premio: sin límite</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveTaquilla(taquilla)}
                        disabled={saving === taquilla.id}
                      >
                        {saving === taquilla.id ? 'Guardando...' : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
