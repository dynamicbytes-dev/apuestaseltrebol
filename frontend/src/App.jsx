import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Agencies from './pages/Agencies';
import Supervisors from './pages/Supervisors';
import Limits from './pages/Limits';
import Lotteries from './pages/Lotteries';
import LotteryDetail from './pages/LotteryDetail';
import Races from './pages/Races';
import RaceDetail from './pages/RaceDetail';
import Parley from './pages/Parley';
import SupervisorDashboard from './pages/SupervisorDashboard';
import Taquillas from './pages/Taquillas';
import Historial from './pages/Historial';
import Analiticas from './pages/Analiticas';
import Cartelera from './pages/Cartelera';
import CarteleraLayout from './layouts/CarteleraLayout';
import TaquillaHome from './pages/TaquillaHome';
import NuevaApuesta from './pages/NuevaApuesta';
import TaquillaTickets from './pages/TaquillaTickets';
import AdminLayout from './layouts/AdminLayout';
import SupervisorLayout from './layouts/SupervisorLayout';
import TaquillaLayout from './layouts/TaquillaLayout';
import { homePathForRole } from './utils/roles';
import { getSessionExpiry, refreshSession, clearSession } from './utils/session';
import './App.css';

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem('user') ?? '{}');
  } catch {
    return {};
  }
}

function RoleRoute({ roles, children }) {
  const token = localStorage.getItem('token');
  const user = storedUser();
  const location = useLocation();
  const [renewing, setRenewing] = useState(false);

  const expiry = getSessionExpiry();
  const expired = Boolean(token && expiry && Date.now() > expiry);

  // La sesión vencida no expulsa al usuario de inmediato: se intenta
  // renovar el token una vez. Si no se puede, se cierra la sesión.
  useEffect(() => {
    if (!expired) return;

    let active = true;

    setRenewing(true);

    refreshSession().then((renewed) => {
      if (!renewed) {
        clearSession();
      }
      if (active) {
        setRenewing(false);
      }
    });

    return () => {
      active = false;
    };
  }, [expired]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (expired && renewing) {
    return <p className="empty">Renovando la sesión...</p>;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  return children;
}

function HomeRedirect() {
  const token = localStorage.getItem('token');
  const user = storedUser();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={homePathForRole(user.role)} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* La cartelera está disponible para los tres roles. */}
        <Route
          element={
            <RoleRoute roles={['administrador', 'supervisor', 'taquilla']}>
              <CarteleraLayout />
            </RoleRoute>
          }
        >
          <Route path="/cartelera" element={<Cartelera />} />
        </Route>

        <Route
          element={
            <RoleRoute roles={['administrador']}>
              <AdminLayout />
            </RoleRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agencies" element={<Agencies />} />
          <Route path="/supervisors" element={<Supervisors />} />
          <Route path="/lotteries" element={<Lotteries />} />
          <Route path="/lotteries/:lotteryId" element={<LotteryDetail />} />
          <Route path="/races" element={<Races />} />
          <Route path="/races/:raceId" element={<RaceDetail />} />
          <Route path="/parley" element={<Parley />} />
          <Route path="/limits" element={<Limits />} />
          <Route path="/analiticas" element={<Analiticas />} />
        </Route>

        <Route
          path="/supervisor"
          element={
            <RoleRoute roles={['supervisor']}>
              <SupervisorLayout />
            </RoleRoute>
          }
        >
          <Route index element={<SupervisorDashboard />} />
          <Route path="taquillas" element={<Taquillas />} />
          <Route path="historial" element={<Historial />} />
          <Route path="analiticas" element={<Analiticas />} />
        </Route>

        <Route
          path="/taquilla"
          element={
            <RoleRoute roles={['taquilla']}>
              <TaquillaLayout />
            </RoleRoute>
          }
        >
          <Route index element={<TaquillaHome />} />
          <Route path="nueva" element={<NuevaApuesta />} />
          <Route path="tickets" element={<TaquillaTickets />} />
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
