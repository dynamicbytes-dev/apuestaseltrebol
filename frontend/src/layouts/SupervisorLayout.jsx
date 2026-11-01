import {
  LayoutDashboard,
  Store,
  History,
  BarChart3,
  CalendarDays,
  Sliders,
} from 'lucide-react';
import SidebarLayout from '../components/SidebarLayout';

const navGroups = [
  {
    title: 'Supervisión',
    items: [
      { to: '/supervisor', label: 'Panel de Control', end: true, icon: LayoutDashboard },
      { to: '/cartelera', label: 'Cartelera', icon: CalendarDays },
      { to: '/supervisor/analiticas', label: 'Analíticas de Ventas', icon: BarChart3 },
    ],
  },
  {
    title: 'Agencia & Taquillas',
    items: [
      { to: '/supervisor/taquillas', label: 'Gestión de Taquillas', icon: Store },
      { to: '/supervisor/topes', label: 'Topes y Límites', icon: Sliders },
      { to: '/supervisor/historial', label: 'Historial de Tickets', icon: History },
    ],
  },
];

export default function SupervisorLayout() {
  return (
    <SidebarLayout
      roleBadge="SUPERVISOR"
      defaultRole="Supervisor"
      navGroups={navGroups}
      homePath="/supervisor"
    />
  );
}
