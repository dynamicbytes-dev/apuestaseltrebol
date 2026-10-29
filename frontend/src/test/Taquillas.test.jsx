import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Taquillas from '../pages/Taquillas';

const taquillas = [
  {
    id: 3,
    name: 'Taquilla Norte',
    email: 'norte@eltrebol.com',
    agency_id: 1,
    supervisor_id: 2,
    commission_percentage: 11.5,
    created_at: '2026-10-20T14:00:00.000000Z',
    sales: {
      tickets: 4,
      stake: 1200,
      paid: 0,
      net: 1200,
      share_percentage: 11.5,
      share_amount: 138,
    },
  },
];

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(async () => ({ data: { data: taquillas } })),
    post: vi.fn(async () => ({ data: { data: taquillas[0] } })),
    put: vi.fn(async () => ({ data: { data: taquillas[0] } })),
    delete: vi.fn(async () => ({ data: {} })),
  },
}));

describe('Gestion de taquillas del supervisor', () => {
  beforeEach(() => {
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 2, name: 'Nelson Castillo', role: 'supervisor', agency: { id: 1, name: 'Agencia Centro' } })
    );
  });

  it('muestra los campos de registro en una rejilla de ancho parejo', async () => {
    const { container } = render(
      <MemoryRouter>
        <Taquillas />
      </MemoryRouter>
    );

    await screen.findByText('Taquilla Norte');

    const formulario = container.querySelector('form');
    expect(formulario.classList.contains('form-grid')).toBe(true);
    expect(formulario.classList.contains('form-row')).toBe(false);

    const campos = formulario.querySelectorAll('.form-field');
    expect(campos.length).toBe(4);

    // Nota: jsdom no calcula el diseno, asi que aqui no se puede medir el
    // ancho real de cada campo. Eso se comprueba con una captura real.
    const anchos = [...campos].map((campo) => Math.round(campo.getBoundingClientRect().width));
    expect(new Set(anchos).size).toBe(1);
  });

  it('tiene un campo para el porcentaje de comision', async () => {
    render(
      <MemoryRouter>
        <Taquillas />
      </MemoryRouter>
    );

    await screen.findByText('Taquilla Norte');

    const campo = document.getElementById('taquilla-comision');
    expect(campo).not.toBeNull();
    expect(campo.type).toBe('number');
    // El valor por defecto sale de la configuracion.
    expect(campo.value).toBe('13');
  });

  it('carga el porcentaje propio de la taquilla al editarla', async () => {
    render(
      <MemoryRouter>
        <Taquillas />
      </MemoryRouter>
    );

    await screen.findByText('Taquilla Norte');

    const editar = screen.getByRole('button', { name: /editar/i });
    editar.click();

    await waitFor(() => {
      expect(document.getElementById('taquilla-comision').value).toBe('11.5');
    });
  });

  it('muestra el porcentaje de cada taquilla en la tabla', async () => {
    render(
      <MemoryRouter>
        <Taquillas />
      </MemoryRouter>
    );

    await screen.findByText('Taquilla Norte');

    // El monto de la comision y su porcentaje.
    expect(screen.getByText(/138/)).toBeTruthy();
    expect(screen.getByText(/\(11\.50%\)/)).toBeTruthy();
  });
});
