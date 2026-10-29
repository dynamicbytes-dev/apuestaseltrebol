import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const expiresAt = Number(localStorage.getItem('sessionExpiresAt') || 0);
  if (expiresAt && Date.now() > expiresAt) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sessionExpiresAt');
    window.location.href = '/login?expired=1';
    return Promise.reject(new Error('Sesión expirada tras 5 minutos.'));
  }

  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('sessionExpiresAt');
      window.location.href = '/login?expired=1';
    }
    return Promise.reject(error);
  },
);

export default api;
