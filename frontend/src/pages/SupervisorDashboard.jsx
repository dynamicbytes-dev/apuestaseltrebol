import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  Building2,
  DollarSign,
  Trophy,
  ArrowRight,
  User,
  Mail,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';

function formatLimit(value) {
  if (value === null || value === undefined || value === '') {
    return 'Sin límite';
  }

  return `$${Number(value).toFixed(2)}`;
}

export default function SupervisorDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    api
      .get('/supervisor/dashboard')
      .then((response) => {
        if (active) setData(response.data);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <span>Panel de Supervisión</span>
            <span className="page-title-badge">Agencia</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            Control operativo de taquillas, topes asignados y estado de cuenta.
          </p>
        </div>
        <Link className="btn btn-primary" to="/supervisor/taquillas">
          <Store size={18} />
          <span>Gestionar taquillas</span>
        </Link>
      </header>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {data ? (
        <>
          {!data.agency && (
            <div className="alert alert-error">
              <AlertCircle size={18} />
              <span>Tu usuario no tiene una agencia asignada. Contacta al administrador central.</span>
            </div>
          )}

          <div className="stats-grid">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="stat-label">Taquillas Activas</p>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={20} />
                </div>
              </div>
              <p className="stat-value">{data.stats.taquillas}</p>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="stat-label">Agencia Asignada</p>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'rgba(167, 139, 250, 0.12)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={20} />
                </div>
              </div>
              <p className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                {data.agency?.name ?? 'Sin agencia'}
              </p>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="stat-label">Tope por Apuesta</p>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={20} />
                </div>
              </div>
              <p className="stat-value" style={{ fontSize: '1.65rem' }}>
                {formatLimit(data.agency?.max_bet_amount)}
              </p>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="stat-label">Ganancia Máx. Ticket</p>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'rgba(251, 146, 60, 0.12)', color: '#fb923c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trophy size={20} />
                </div>
              </div>
              <p className="stat-value" style={{ fontSize: '1.65rem' }}>
                {formatLimit(data.agency?.max_ticket_payout)}
              </p>
            </div>
          </div>

          <section className="card" style={{ marginTop: '1.75rem' }}>
            <h2 className="card-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} color="#34d399" />
                Detalles del Supervisor
              </span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <User size={20} color="var(--text-tertiary)" />
                <div>
                  <small style={{ color: 'var(--text-tertiary)', display: 'block' }}>Nombre del Supervisor</small>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{data.supervisor.name}</strong>
                </div>
              </div>

              <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Mail size={20} color="var(--text-tertiary)" />
                <div>
                  <small style={{ color: 'var(--text-tertiary)', display: 'block' }}>Correo Electrónico</small>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{data.supervisor.email}</strong>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Desde la sección <strong>Taquillas</strong> puedes registrar, editar, suspender y auditar cada terminal de venta asignado a tu agencia.
              </p>
              <Link className="btn btn-secondary btn-sm" to="/supervisor/taquillas">
                <span>Ir a taquillas</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        </>
      ) : (
        !error && (
          <div className="empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <span>Cargando datos de la agencia...</span>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )
      )}
    </div>
  );
}
