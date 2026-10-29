import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import TaquillaHome from './pages/TaquillaHome';
import NuevaApuesta from './pages/NuevaApuesta';
import TaquillaTickets from './pages/TaquillaTickets';
import AdminLayout from './layouts/AdminLayout';
import SupervisorLayout from './layouts/SupervisorLayout';
import TaquillaLayout from './layouts/TaquillaLayout';
import { homePathForRole } from './utils/roles';
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

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Comprobar expiración estricta de 5 minutos de sesión
  const expiresAt = Number(localStorage.getItem('sessionExpiresAt') || 0);
  if (expiresAt && Date.now() > expiresAt) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sessionExpiresAt');
    return <Navigate to="/login?expired=1" replace />;
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
