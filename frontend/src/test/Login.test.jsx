import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import { getErrorMessage } from '../utils/errors';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('../api/client', () => ({
  default: {
    post: (...args) => post(...args),
  },
}));

describe('Avisos del inicio de sesión', () => {
  it('distingue una caída de la API de unas credenciales incorrectas', () => {
    // Sin respuesta del servidor: casi siempre es que la API no esta
    // levantada o que el frontend apunta al puerto equivocado.
    const sinRespuesta = { request: {}, message: 'Network Error' };

    expect(getErrorMessage(sinRespuesta)).toMatch(/no se pudo conectar con el servidor/i);
    expect(getErrorMessage(sinRespuesta)).toMatch(/VITE_API_TARGET/);
  });

  it('muestra el mensaje del servidor cuando la respuesta trae uno', () => {
    const invalidas = {
      response: { status: 401, data: { message: 'Credenciales inválidas.' } },
    };

    expect(getErrorMessage(invalidas)).toBe('Credenciales inválidas.');
  });

  it('muestra los errores de validación del servidor', () => {
    const validacion = {
      response: { status: 422, data: { errors: { email: ['El correo es obligatorio.'] } } },
    };

    expect(getErrorMessage(validacion)).toBe('El correo es obligatorio.');
  });
});

describe('Formulario de inicio de sesión', () => {
  beforeEach(() => {
    post.mockReset();
    localStorage.clear();
  });

  const rellenar = async () => {
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'rosangeles92@gmail.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ingresar al sistema/i }));
  };

  it('avisa de que el servidor no responde en vez de culpar a las credenciales', async () => {
    post.mockRejectedValueOnce({ request: {}, message: 'Network Error' });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await rellenar();

    await waitFor(() => {
      expect(screen.getByText(/no se pudo conectar con el servidor/i)).toBeTruthy();
    });

    // No se debe culpar a unas credenciales que pueden estar correctas.
    expect(screen.queryByText(/verifique sus credenciales/i)).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('muestra el rechazo del servidor cuando las credenciales son invalidas', async () => {
    post.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Credenciales inválidas.' } },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await rellenar();

    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas.')).toBeTruthy();
    });
  });

  it('guarda la sesion devuelta por el servidor', async () => {
    post.mockResolvedValueOnce({
      data: {
        token: 'token-de-prueba',
        expires_in: 3600,
        user: { id: 1, email: 'rosangeles92@gmail.com', role: 'administrador' },
      },
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await rellenar();

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('token-de-prueba');
    });

    expect(JSON.parse(localStorage.getItem('user')).role).toBe('administrador');
    expect(Number(localStorage.getItem('sessionExpiresAt'))).toBeGreaterThan(Date.now());
  });
});
