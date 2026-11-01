import {
  LayoutDashboard,
  PlusCircle,
  Receipt,
  CalendarDays,
} from 'lucide-react';
import SidebarLayout from '../components/SidebarLayout';

const navGroups = [
  {
    title: 'Caja Operativa',
    items: [
      { to: '/taquilla', label: 'Inicio de Caja', icon: LayoutDashboard, end: true },
      { to: '/taquilla/nueva', label: 'Nueva Apuesta', icon: PlusCircle },
      { to: '/taquilla/tickets', label: 'Consultar & Pagar', icon: Receipt },
    ],
  },
  {
    title: 'Información',
    items: [
      { to: '/cartelera', label: 'Cartelera de Resultados', icon: CalendarDays },
    ],
  },
];

export default function TaquillaLayout() {
  return (
    <SidebarLayout
      roleBadge="TAQUILLA"
      defaultRole="Taquilla"
      navGroups={navGroups}
      homePath="/taquilla"
    />
  );
}
