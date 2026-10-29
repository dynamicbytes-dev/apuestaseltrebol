import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  ShieldCheck,
  Store,
  Ticket,
  Flame,
  ArrowRight,
  Sliders,
  Gamepad2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    api
      .get('/dashboard')
      .then((response) => {
        if (active) setStats(response.data.stats);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      });

    return () => {
      active = false;
    };
  }, []);

  const statCards = stats
    ? [
        {
          label: 'Agencias Activas',
          value: stats.agencies,
          icon: Building2,
          color: '#38bdf8',
          bg: 'rgba(56, 189, 248, 0.12)',
          to: '/agencies',
        },
        {
          label: 'Supervisores',
          value: stats.supervisors,
          icon: ShieldCheck,
          color: '#a78bfa',
          bg: 'rgba(167, 139, 250, 0.12)',
          to: '/supervisors',
        },
        {
          label: 'Taquillas Conectadas',
          value: stats.taquillas,
          icon: Store,
          color: '#34d399',
          bg: 'rgba(16, 185, 129, 0.12)',
          to: '/agencies',
        },
        {
          label: 'Loterías Configuradas',
          value: stats.lotteries,
          icon: Ticket,
          color: '#f472b6',
          bg: 'rgba(244, 114, 182, 0.12)',
          to: '/lotteries',
        },
        {
          label: 'Carreras Programadas',
          value: stats.races,
          icon: Flame,
          color: '#fb923c',
          bg: 'rgba(251, 146, 60, 0.12)',
          to: '/races',
        },
      ]
    : [];

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <span>Panel de Control</span>
            <span className="page-title-badge">Vista General</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            Monitoreo en tiempo real de operaciones, agencias y sistemas de apuestas.
          </p>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {stats ? (
        <>
          <div className="stats-grid">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="card">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <p className="stat-label">{card.label}</p>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: card.bg,
                        color: card.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={20} />
                    </div>
                  </div>
                  <p className="stat-value">{card.value}</p>
                  <div
                    style={{
                      marginTop: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-tertiary)' }}>Estado operacional</span>
                    <Link
                      to={card.to}
                      style={{
                        color: card.color,
                        textDecoration: 'none',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      <span>Ver</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Access Matrix */}
          <section className="card" style={{ marginTop: '0.5rem' }}>
            <h2 className="card-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} color="#34d399" />
                Módulos de Gestión Rápida
              </span>
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1rem',
              }}
            >
              <Link
                to="/agencies"
                className="card"
                style={{
                  margin: 0,
                  textDecoration: 'none',
                  background: 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div
                  style={{
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(56, 189, 248, 0.1)',
                    color: '#38bdf8',
                  }}
                >
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-primary)', fontSize: '0.98rem' }}>
                    Agencias
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    Registrar agencias, puntos de venta y sucursales.
                  </p>
                </div>
              </Link>

              <Link
                to="/supervisors"
                className="card"
                style={{
                  margin: 0,
                  textDecoration: 'none',
                  background: 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                }}
              >
                <div
                  style={{
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(167, 139, 250, 0.1)',
                    color: '#a78bfa',
                  }}
                >
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-primary)', fontSize: '0.98rem' }}>
                    Supervisores
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    Asignación y permisos de supervisores por agencia.
                  </p>
                </div>
              </Link>

              <Link
                to="/races"
                className="card"
                style={{
                  margin: 0,
                  textDecoration: 'none',
                  background: 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                }}
              >
                <div
                  style={{
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(251, 146, 60, 0.1)',
                    color: '#fb923c',
                  }}
                >
                  <Flame size={24} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-primary)', fontSize: '0.98rem' }}>
                    Hipismo Nacional
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    Carreras de La Rinconada, ejemplares y podio.
                  </p>
                </div>
              </Link>

              <Link
                to="/parley"
                className="card"
                style={{
                  margin: 0,
                  textDecoration: 'none',
                  background: 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                }}
              >
                <div
                  style={{
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(52, 211, 153, 0.1)',
                    color: '#34d399',
                  }}
                >
                  <Gamepad2 size={24} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-primary)', fontSize: '0.98rem' }}>
                    Parley Deportivo
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    Fútbol, Béisbol, Baloncesto y mercados en vivo.
                  </p>
                </div>
              </Link>

              <Link
                to="/limits"
                className="card"
                style={{
                  margin: 0,
                  textDecoration: 'none',
                  background: 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                }}
              >
                <div
                  style={{
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(244, 114, 182, 0.1)',
                    color: '#f472b6',
                  }}
                >
                  <Sliders size={24} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem', color: 'var(--text-primary)', fontSize: '0.98rem' }}>
                    Topes & Restricciones
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    Montos máximos por jugada y límites por ticket.
                  </p>
                </div>
              </Link>
            </div>
          </section>
        </>
      ) : (
        !error && (
          <div className="empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <span>Sincronizando estadísticas operacionales...</span>
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
