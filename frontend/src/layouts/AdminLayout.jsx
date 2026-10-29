import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Clover,
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Ticket,
  Flame,
  Gamepad2,
  Sliders,
  LogOut,
  Menu,
  X,
  Clock,
  Sparkles,
  BarChart3,
  CalendarDays,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import SessionTimer from '../components/SessionTimer';
import ErrorBoundary from '../components/ErrorBoundary';
import api from '../api/client';
import '../styles/admin.css';

const navItems = [
  { to: '/dashboard', label: 'Panel General', icon: LayoutDashboard },
  { to: '/cartelera', label: 'Cartelera de Juegos', icon: CalendarDays },
  { to: '/agencies', label: 'Agencias', icon: Building2 },
  { to: '/supervisors', label: 'Supervisores', icon: ShieldCheck },
  { to: '/lotteries', label: 'Loterías & Animalitos', icon: Ticket },
  { to: '/races', label: 'Hipismo & Carreras', icon: Flame },
  { to: '/parley', label: 'Parley Deportivo', icon: Gamepad2 },
  { to: '/limits', label: 'Topes & Reglas', icon: Sliders },
  { to: '/analiticas', label: 'Analíticas', icon: BarChart3 },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const user = JSON.parse(localStorage.getItem('user') ?? '{}');

  useEffect(() => {
    // Format Venezuela / local system time
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

  // Close mobile sidebar on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Token may have expired, proceed to clear
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const getInitials = (name = 'Admin') => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="admin-layout">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 45, padding: 0 }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'is-open' : ''}`}>
        <div className="admin-brand-wrapper">
          <div className="brand-icon-box">
            <Clover size={24} strokeWidth={2.5} />
          </div>
          <div className="brand-text-group">
            <h1 className="admin-brand">El Trébol</h1>
            <span className="brand-subtitle">Administración 2026</span>
          </div>
        </div>

        {/* User Card */}
        <div className="admin-user-card">
          <div className="admin-avatar">{getInitials(user.name)}</div>
          <div className="admin-user-info">
            <p className="admin-user-name">{user.name ?? 'Administrador'}</p>
            <span className="admin-role-badge">{user.role ?? 'Admin'}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="admin-nav">
          <span className="nav-section-title">Módulos del Sistema</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer with Logout */}
        <div className="sidebar-footer">
          <button type="button" className="admin-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="admin-main-container">
        {/* Topbar */}
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
              <Sparkles size={14} color="#34d399" />
              <span>Plataforma Operativa Central</span>
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

        {/* Routed View */}
        <main className="admin-main">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
