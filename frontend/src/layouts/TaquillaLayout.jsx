import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Receipt,
  LogOut,
  Menu,
  X,
  Clock,
  Store,
  CalendarDays,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import SessionTimer from '../components/SessionTimer';
import ErrorBoundary from '../components/ErrorBoundary';
import { MatrixBetIcon } from '../components/MatrixBetLogo';
import api from '../api/client';
import '../styles/admin.css';

const navItems = [
  { to: '/taquilla', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/cartelera', label: 'Cartelera', icon: CalendarDays },
  { to: '/taquilla/nueva', label: 'Nueva Apuesta', icon: PlusCircle },
  { to: '/taquilla/tickets', label: 'Consultar & Pagar', icon: Receipt },
];

export default function TaquillaLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const user = JSON.parse(localStorage.getItem('user') ?? '{}');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-VE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore expiration
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const getInitials = (name = 'Taquilla') => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="studio-shell">
      {mobileMenuOpen && (
        <div
          className="studio-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Floating Island Command Navigation */}
      <div className="studio-dock-wrapper">
        <header className="studio-dock">
          {/* Brand Emblem */}
          <div className="dock-brand">
            <div className="dock-logo" style={{ background: 'transparent', padding: 0, border: 'none' }}>
              <MatrixBetIcon size={26} />
            </div>
            <div className="dock-brand-text">
              <span className="dock-title">Matrix Bet</span>
              <span className="dock-tag">POS TAQUILLA</span>
            </div>
          </div>

          {/* Desktop Capsule Navigation */}
          <nav className="dock-nav-capsule">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `dock-pill ${isActive ? 'is-active' : ''}`}
                >
                  <Icon size={15} strokeWidth={2.2} />
                  <span className="dock-pill-text">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Utility Cluster */}
          <div className="dock-utilities">
            <div className="dock-chip dock-chip-live">
              <span className="dock-pulse-dot" />
              <span className="dock-clock-mono">{currentTime}</span>
            </div>

            <div className="dock-chip" style={{ color: 'var(--palette-orange)' }}>
              <Store size={13} />
              <span>{user.agency?.name ?? 'Agencia'}</span>
            </div>

            <SessionTimer />
            <ThemeToggle />

            <div className="dock-user-cluster">
              <div className="dock-avatar">{getInitials(user.name)}</div>
              <div className="dock-user-meta">
                <span className="dock-user-name">{user.name ?? 'Taquilla'}</span>
              </div>
              <button
                type="button"
                className="dock-logout-action"
                onClick={handleLogout}
                title="Cerrar sesión"
              >
                <LogOut size={14} />
              </button>
            </div>

            <button
              type="button"
              className="dock-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="studio-mobile-island">
            <nav className="mobile-nav-grid">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `mobile-dock-pill ${isActive ? 'is-active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon size={18} strokeWidth={2.2} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      <main className="studio-canvas">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
