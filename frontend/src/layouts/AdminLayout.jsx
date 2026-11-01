import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Ticket,
  Flame,
  Gamepad2,
  BarChart3,
  CalendarDays,
} from 'lucide-react';
import SidebarLayout from '../components/SidebarLayout';

const navGroups = [
  {
    title: 'Principal',
    items: [
      { to: '/dashboard', label: 'Panel General', icon: LayoutDashboard },
      { to: '/cartelera', label: 'Cartelera', icon: CalendarDays },
      { to: '/analiticas', label: 'Analíticas', icon: BarChart3 },
    ],
  },
  {
    title: 'Operaciones & Red',
    items: [
      { to: '/agencies', label: 'Agencias', icon: Building2 },
      { to: '/supervisors', label: 'Supervisores', icon: ShieldCheck },
    ],
  },
  {
    title: 'Modalidades de Juego',
    items: [
      { to: '/lotteries', label: 'Loterías & Animalitos', icon: Ticket },
      { to: '/races', label: 'Hipismo Nacional', icon: Flame },
      { to: '/parley', label: 'Parley Deportivo', icon: Gamepad2 },
    ],
  },
];

export default function AdminLayout() {
  return (
    <SidebarLayout
      roleBadge="ADMIN PRO"
      defaultRole="Administrador"
      navGroups={navGroups}
      homePath="/dashboard"
    />
  );
}
