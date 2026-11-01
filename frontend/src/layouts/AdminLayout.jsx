import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Ticket,
  Flame,
  Gamepad2,
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
import { MatrixBetIcon } from '../components/MatrixBetLogo';
import api from '../api/client';
import '../styles/admin.css';

const navItems = [
  { to: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { to: '/cartelera', label: 'Cartelera', icon: CalendarDays },
  { to: '/agencies', label: 'Agencias', icon: Building2 },
  { to: '/supervisors', label: 'Supervisores', icon: ShieldCheck },
  { to: '/lotteries', label: 'Loterías', icon: Ticket },
  { to: '/races', label: 'Hipismo', icon: Flame },
  { to: '/parley', label: 'Parley', icon: Gamepad2 },
  { to: '/analiticas', label: 'Analíticas', icon: BarChart3 },
];

export default function AdminLayout() {
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

  // Close mobile drawer on route transition
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

  const getInitials = (name = 'Admin') => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="studio-shell">
      {/* Mobile Drawer Overlay */}
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
              <span className="dock-tag">ADMIN PRO</span>
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
            {/* Live Clock Chip */}
            <div className="dock-chip dock-chip-live">
              <span className="dock-pulse-dot" />
              <span className="dock-clock-mono">{currentTime}</span>
            </div>

            <SessionTimer />
            <ThemeToggle />

            {/* User Profile Pill */}
            <div className="dock-user-cluster">
              <div className="dock-avatar">{getInitials(user.name)}</div>
              <div className="dock-user-meta">
                <span className="dock-user-name">{user.name ?? 'Administrador'}</span>
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

            {/* Mobile Menu Hamburger */}
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

        {/* Mobile Dropdown Island Menu */}
        {mobileMenuOpen && (
          <div className="studio-mobile-island">
            <nav className="mobile-nav-grid">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
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

      {/* Main Workspace Canvas */}
      <main className="studio-canvas">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
