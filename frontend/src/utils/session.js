import axios from 'axios';

// Misma base que el cliente de la API: ruta relativa ("/api") en desarrollo
// (la reenvia Vite al backend) o la URL completa que se defina en el .env.
const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Margen en segundos para renovar el token antes de que caduque.
 */
export const SESSION_REFRESH_THRESHOLD_SECONDS = 90;

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('sessionExpiresAt');
}

/**
 * Lee el claim "exp" del token JWT.
 *
 * La sesión no se inventa: el plazo real es el que dice el propio token, que
 * es lo mismo que valida el servidor.
 */
export function decodeToken(token) {
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Instante de expiración de la sesión (en milisegundos), o null si no hay
 * token o no se puede leer.
 */
export function getSessionExpiry() {
  const stored = Number(localStorage.getItem('sessionExpiresAt') || 0);
  if (stored) {
    return stored;
  }

  const payload = decodeToken(localStorage.getItem('token'));

  return payload?.exp ? payload.exp * 1000 : null;
}

/**
 * Segundos restantes de sesión.
 */
export function getSecondsRemaining() {
  const expiry = getSessionExpiry();

  if (!expiry) {
    return 0;
  }

  return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
}

let refreshPromise = null;

/**
 * Renueva el token de la sesión.
 *
 * Se usa axios directamente (no la instancia de la API) para no entrar en la
 * cadena de interceptores ni provocar un bucle con el 401.
 *
 * @returns {Promise<string|null>} el token nuevo, o null si no se pudo renovar
 */
export function refreshSession() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      return null;
    }

    try {
      const response = await axios.post(
        `${API_URL}/auth/refresh`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const newToken = response.data?.token;

      if (!newToken) {
        return null;
      }

      localStorage.setItem('token', newToken);

      const expiresIn = Number(response.data?.expires_in ?? 0);
      if (expiresIn > 0) {
        localStorage.setItem('sessionExpiresAt', String(Date.now() + expiresIn * 1000));
      }

      if (response.data?.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }

      return newToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Indica si la sesión está por expirar y conviene renovarla.
 */
export function shouldRefreshSession() {
  const remaining = getSecondsRemaining();

  return remaining > 0 && remaining <= SESSION_REFRESH_THRESHOLD_SECONDS;
}
