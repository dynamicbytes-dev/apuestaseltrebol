import axios from 'axios';
import {
  clearSession,
  refreshSession,
  getSessionExpiry,
  getSecondsRemaining,
  shouldRefreshSession,
} from '../utils/session';

const api = axios.create({
  // Ruta relativa por defecto: el servidor de desarrollo de Vite reenvia
  // "/api" al backend, y asi el puerto no hay que fijarlo en el frontend.
  // Para un despliegue estatico se define VITE_API_URL con la URL completa.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * El login no depende de la sesión: no se renueva el token ni se borra la
 * sesión activa si falla (por ejemplo, por credenciales incorrectas).
 */
function isLoginRequest(config) {
  return String(config?.url ?? '').includes('/auth/login');
}

api.interceptors.request.use(async (config) => {
  if (isLoginRequest(config)) {
    return config;
  }

  const token = localStorage.getItem('token');

  if (token) {
    // Si la sesión ya venció, se intenta renovar antes de enviar la
    // petición: el token se renueva de forma automática.
    const expiry = getSessionExpiry();
    if (expiry && Date.now() > expiry) {
      const renewed = await refreshSession();

      if (!renewed) {
        clearSession();
        window.location.href = '/login?expired=1';
        return Promise.reject(new Error('Sesión expirada.'));
      }

      config.headers.Authorization = `Bearer ${renewed}`;
      return config;
    }

    // Margen de seguridad: si queda poco tiempo, se renueva ahora.
    if (shouldRefreshSession()) {
      const renewed = await refreshSession();

      if (renewed) {
        config.headers.Authorization = `Bearer ${renewed}`;
        return config;
      }
    }

    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const original = error.config;

    if (isLoginRequest(original)) {
      return Promise.reject(error);
    }

    // Un 401 con el token ya vencido se resuelve renovando la sesión una
    // sola vez y reintentando la petición original.
    if (status === 401 && original && !original._retried) {
      original._retried = true;

      const renewed = await refreshSession();

      if (renewed) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${renewed}`;

        return api(original);
      }
    }

    if (status === 401) {
      clearSession();
      window.location.href = '/login?expired=1';
    }

    return Promise.reject(error);
  },
);

export { getSecondsRemaining, getSessionExpiry, refreshSession, clearSession };
export default api;
