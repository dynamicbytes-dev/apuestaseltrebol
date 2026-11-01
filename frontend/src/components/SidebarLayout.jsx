import { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Store,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import SessionTimer from './SessionTimer';
import ErrorBoundary from './ErrorBoundary';
import { MatrixBetIcon } from './MatrixBetLogo';
import api from '../api/client';
import '../styles/admin.css';

/**
 * Modern Collapsible Sidebar Layout for Matrix Bet
 * Supports grouped sections, collapsed mini-mode (icon-only),
 * keyboard shortcut (Ctrl+B), mobile responsive drawer, and sticky topbar.
 */
export default function SidebarLayout({
  roleBadge = 'ADMIN',
  defaultRole = 'Usuario',
  navGroups = [],
  homePath = '/dashboard',
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // Persistent collapsed state across page reloads
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('mb_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') ?? '{}');
    } catch {
      return {};
    }
  }, []);

  // Update clock every second
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

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsCollapsed((prev) => {
          const next = !prev;
          try {
            localStorage.setItem('mb_sidebar_collapsed', String(next));
          } catch {
            // Ignore
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('mb_sidebar_collapsed', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

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

  const getInitials = (name = 'U') => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
  };

  // Find active label for breadcrumb
  const currentActiveItem = useMemo(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (item.end && location.pathname === item.to) {
          return item;
        }
        if (!item.end && (location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))) {
          return item;
        }
      }
    }
    return null;
  }, [navGroups, location.pathname]);

  return (
    <div className={`app-shell ${isCollapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Modern Collapsible Sidebar */}
      <aside className="app-sidebar" aria-label="Navegación principal">
        {/* Sidebar Brand Header */}
        <div className="sidebar-header">
          <Link to={homePath} className="sidebar-brand" title="Matrix Bet">
            <div className="sidebar-brand-icon">
              <MatrixBetIcon size={30} />
            </div>
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-title">
                <span className="brand-primary">Matrix</span>
                <span className="brand-accent">Bet</span>
              </div>
              <span className="sidebar-brand-badge">{roleBadge}</span>
            </div>
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expandir menú lateral (Ctrl+B)' : 'Colapsar menú lateral (Ctrl+B)'}
            aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Navigation Groups Container */}
        <nav className="sidebar-nav-scroll">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="sidebar-nav-group">
              <div className="sidebar-group-header">
                <span className="sidebar-group-title">{group.title}</span>
                <span className="sidebar-group-line" aria-hidden="true" />
              </div>

              <div className="sidebar-group-items">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `sidebar-nav-item ${isActive ? 'is-active' : ''}`
                      }
                      title={isCollapsed ? item.label : undefined}
                    >
                      <span className="sidebar-nav-icon">
                        <Icon size={18} strokeWidth={2.1} />
                      </span>
                      <span className="sidebar-nav-label">{item.label}</span>
                      {item.badge && (
                        <span className="sidebar-nav-badge">{item.badge}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar User Profile Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar" title={user.name ?? defaultRole}>
              {getInitials(user.name)}
            </div>
            <div className="sidebar-user-meta">
              <span className="sidebar-user-name" title={user.name ?? defaultRole}>
                {user.name ?? defaultRole}
              </span>
              <span className="sidebar-user-role">
                {user.agency?.name ?? defaultRole}
              </span>
            </div>
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container Area */}
      <div className="app-main">
        {/* Modern Sticky Topbar */}
        <header className="app-topbar">
          <div className="topbar-left">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              type="button"
              className="topbar-mobile-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="topbar-breadcrumb">
              <span className="breadcrumb-tag">{roleBadge}</span>
              <span className="breadcrumb-divider">/</span>
              <span className="breadcrumb-current">
                {currentActiveItem?.label ?? 'Panel'}
              </span>
            </div>
          </div>

          <div className="topbar-right">
            {/* Live Clock Chip */}
            <div className="topbar-chip topbar-chip-live" title="Hora actual del sistema">
              <span className="dock-pulse-dot" />
              <span className="topbar-clock-mono">{currentTime}</span>
            </div>

            {/* Agency Badge if available */}
            {user.agency?.name && (
              <div className="topbar-chip topbar-agency-chip" title={`Agencia: ${user.agency.name}`}>
                <Store size={14} />
                <span>{user.agency.name}</span>
              </div>
            )}

            <SessionTimer />
            <ThemeToggle />

            {/* Header User Capsule */}
            <div className="topbar-user-pill">
              <div className="topbar-avatar">{getInitials(user.name)}</div>
              <span className="topbar-user-name">{user.name ?? defaultRole}</span>
              <button
                type="button"
                className="topbar-logout-btn"
                onClick={handleLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Canvas */}
        <main className="app-canvas">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
