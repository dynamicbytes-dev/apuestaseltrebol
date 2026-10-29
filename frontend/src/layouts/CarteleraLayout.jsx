import AdminLayout from './AdminLayout';
import SupervisorLayout from './SupervisorLayout';
import TaquillaLayout from './TaquillaLayout';

/**
 * La cartelera es un módulo común a los tres roles, pero debe verse dentro
 * del panel de quien la está mirando: con su barra lateral y su cabecera.
 */
export default function CarteleraLayout() {
  let user = {};

  try {
    user = JSON.parse(localStorage.getItem('user') ?? '{}');
  } catch {
    user = {};
  }

  if (user.role === 'supervisor') {
    return <SupervisorLayout />;
  }

  if (user.role === 'taquilla') {
    return <TaquillaLayout />;
  }

  return <AdminLayout />;
}
