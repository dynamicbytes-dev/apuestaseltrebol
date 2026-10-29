import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Clover,
  LayoutDashboard,
  Store,
  LogOut,
  Menu,
  X,
  Clock,
  Building,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import SessionTimer from '../components/SessionTimer';
import ErrorBoundary from '../components/ErrorBoundary';
import api from '../api/client';
import '../styles/admin.css';

const navItems = [
  { to: '/supervisor', label: 'Panel Supervisor', end: true, icon: LayoutDashboard },
  { to: '/supervisor/taquillas', label: 'Gestión de Taquillas', icon: Store },
];

export default function SupervisorLayout() {
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
      localStorage.removeItem('sessionExpiresAt');
      navigate('/login');
    }
  };

  const getInitials = (name = 'Supervisor') => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="admin-layout">
      {mobileMenuOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 45, padding: 0 }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`admin-sidebar ${mobileMenuOpen ? 'is-open' : ''}`}>
        <div className="admin-brand-wrapper">
          <div className="brand-icon-box">
            <Clover size={24} strokeWidth={2.5} />
          </div>
          <div className="brand-text-group">
            <h1 className="admin-brand">El Trébol</h1>
            <span className="brand-subtitle">Supervisión</span>
          </div>
        </div>

        <div className="admin-user-card">
          <div className="admin-avatar">{getInitials(user.name)}</div>
          <div className="admin-user-info">
            <p className="admin-user-name">{user.name ?? 'Supervisor'}</p>
            <span className="admin-role-badge">{user.agency?.name ?? 'Sin agencia'}</span>
          </div>
        </div>

        <nav className="admin-nav">
          <span className="nav-section-title">Operaciones de Agencia</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="admin-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="admin-main-container">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="topbar-context-badge">
              <Building size={14} color="#34d399" />
              <span>Agencia: {user.agency?.name ?? 'Central'}</span>
            </div>
          </div>

          <div className="topbar-right">
            <SessionTimer />
            <ThemeToggle />
            <div className="topbar-context-badge" style={{ fontFamily: 'var(--font-mono)' }}>
              <Clock size={14} />
              <span>{currentTime}</span>
            </div>
            <div className="topbar-live-status">
              <span className="live-pulse-dot" />
              <span>En línea</span>
            </div>
          </div>
        </header>

        <main className="admin-main">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
