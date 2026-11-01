import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  ShieldCheck,
  Store,
  Ticket,
  Flame,
  ArrowUpRight,
  Gamepad2,
  Sparkles,
  Loader2,
  BarChart3,
  CalendarDays,
  Zap,
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

  // Sport & Adrenaline Palette: #121212 #1E1E1E #E11D48 #38BDF8 #FFFFFF
  const statCards = stats
    ? [
        {
          label: 'Agencias Operativas',
          value: stats.agencies,
          icon: Building2,
          tone: 'crimson',
          color: '#E11D48',
          bg: 'rgba(225, 29, 72, 0.12)',
          border: 'rgba(225, 29, 72, 0.3)',
          to: '/agencies',
          hint: 'Puntos de venta centrales',
        },
        {
          label: 'Supervisores Activos',
          value: stats.supervisors,
          icon: ShieldCheck,
          tone: 'sky',
          color: '#38BDF8',
          bg: 'rgba(56, 189, 248, 0.12)',
          border: 'rgba(56, 189, 248, 0.3)',
          to: '/supervisors',
          hint: 'Supervisores y agencias asignadas',
        },
        {
          label: 'Taquillas En Línea',
          value: stats.taquillas,
          icon: Store,
          tone: 'emerald',
          color: '#10B981',
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.3)',
          to: '/agencies',
          hint: 'Cajas de emisión y pago',
        },
        {
          label: 'Loterías & Animalitos',
          value: stats.lotteries,
          icon: Ticket,
          tone: 'amber',
          color: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)',
          to: '/lotteries',
          hint: 'Ruletas y sorteos del día',
        },
        {
          label: 'Carreras Programadas',
          value: stats.races,
          icon: Flame,
          tone: 'crimson',
          color: '#E11D48',
          bg: 'rgba(225, 29, 72, 0.12)',
          border: 'rgba(225, 29, 72, 0.3)',
          to: '/races',
          hint: 'Reuniones de hipismo nacional',
        },
      ]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Hero Welcome Header */}
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--palette-orange)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Zap size={13} />
              Centro de Operaciones
            </span>
            <span style={{ color: 'var(--border-medium)' }}>•</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Matrix Bet Platform 2026
            </span>
          </div>
          <h1 className="page-title">
            <span>Panel General de Control</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
            Monitoreo en tiempo real de operaciones, hipismo, parley y taquillas conectadas.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Link to="/analiticas" className="btn btn-secondary btn-sm">
            <BarChart3 size={14} />
            <span>Ver Analíticas</span>
          </Link>
          <Link to="/cartelera" className="btn btn-primary btn-sm">
            <CalendarDays size={14} />
            <span>Cartelera de Resultados</span>
          </Link>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {stats ? (
        <>
          {/* Bento Stats KPI Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
            }}
          >
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${card.border}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem 1.35rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-sm)',
                    position: 'relative',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {card.label}
                      </span>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: card.bg,
                          color: card.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={17} strokeWidth={2.2} />
                      </div>
                    </div>
                    <strong
                      style={{
                        fontSize: '1.75rem',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {card.value}
                    </strong>
                  </div>

                  <div
                    style={{
                      marginTop: '1rem',
                      paddingTop: '0.65rem',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.74rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-tertiary)' }}>{card.hint}</span>
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
                      <span>Abrir</span>
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Access Bento Matrix */}
          <section className="card" style={{ padding: '1.5rem', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: 'var(--palette-orange)' }} />
                <span>Módulos de Gestión Rápida</span>
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                Acceso directo a operaciones centrales
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1rem',
              }}
            >
              {/* Agencies */}
              <Link
                to="/agencies"
                style={{
                  textDecoration: 'none',
                  background: 'var(--bg-canvas-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  padding: '1.15rem',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--palette-orange)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    padding: '0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(248, 123, 27, 0.12)',
                    color: '#F87B1B',
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.2rem', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 600 }}>
                    Agencias & Taquillas
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.4 }}>
                    Registrar puntos de venta, supervisores y cupos operacionales.
                  </p>
                </div>
              </Link>

              {/* Races */}
              <Link
                to="/races"
                style={{
                  textDecoration: 'none',
                  background: 'var(--bg-canvas-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  padding: '1.15rem',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--emerald-400)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    padding: '0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(203, 217, 155, 0.15)',
                    color: 'var(--emerald-400)',
                    flexShrink: 0,
                  }}
                >
                  <Flame size={20} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.2rem', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 600 }}>
                    Hipismo & Cuadro 5 y 6
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.4 }}>
                    Reuniones, ejemplares, dividendos oficiales y validación automática.
                  </p>
                </div>
              </Link>

              {/* Parley */}
              <Link
                to="/parley"
                style={{
                  textDecoration: 'none',
                  background: 'var(--bg-canvas-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  padding: '1.15rem',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#FFDEB9';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    padding: '0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 222, 185, 0.18)',
                    color: '#e0943a',
                    flexShrink: 0,
                  }}
                >
                  <Gamepad2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.2rem', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 600 }}>
                    Parley Deportivo
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.4 }}>
                    Ligas de béisbol, fútbol, básquetbol y liquidación de cuotas.
                  </p>
                </div>
              </Link>

            </div>
          </section>
        </>
      ) : (
        !error && (
          <div className="empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '3rem' }}>
            <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
            <span>Sincronizando métricas operacionales del sistema...</span>
          </div>
        )
      )}
    </div>
  );
}
