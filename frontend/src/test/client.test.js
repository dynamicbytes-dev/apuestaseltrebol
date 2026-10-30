import { describe, expect, it } from 'vitest';
import api from '../api/client';

describe('Cliente de la API', () => {
  it('no fija el puerto del backend en el frontend', () => {
    // El puerto depende de lo que este corriendo en la maquina: "php artisan
    // serve" toma el primer puerto libre desde el 8000. El frontend llama a
    // "/api" y el servidor de desarrollo de Vite reenvia la ruta al backend
    // que encuentre.
    expect(api.defaults.baseURL).not.toMatch(/:\d{2,5}/);
  });

  it('apunta a la ruta /api', () => {
    expect(api.defaults.baseURL.endsWith('/api')).toBe(true);
  });
});
