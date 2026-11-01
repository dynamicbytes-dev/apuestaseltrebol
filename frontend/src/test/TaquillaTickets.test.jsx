import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaquillaTickets from '../pages/TaquillaTickets';

// La API no se llama de verdad: se responde con datos de prueba.
const ticket = {
  id: 7,
  code: '61556803',
  type: 'parley',
  status: 'pending',
  settlement_status: 'lost',
  settlement_note: 'El ticket no es ganador. En el partido salió el N° 20.',
  stake: '10000.00',
  potential_payout: '20400.00',
  paid_amount: null,
  created_at: '2026-10-29T18:30:01.000000Z',
  agency: { id: 1, name: 'Agencia Centro' },
  taquilla: { id: 2, name: 'Taquilla Norte' },
  selections: [
    {
      id: 17,
      selection_label: 'Away',
      odd: '2.00',
      amount: '10000.00',
      metadata: { team: 'Visitante', league: 'La Liga' },
    },
  ],
};

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(async (url) => {
      if (url.startsWith('/taquilla/tickets/') && url.endsWith('/settlement')) {
        return {
          data: {
            data: {
              status: 'lost',
              payable: 0,
              legs: [
                {
                  selection_id: 17,
                  label: 'Away',
                  amount: 10000,
                  status: 'lost',
                  payout: 0,
                },
              ],
              note: 'El ticket no es ganador.',
              potential_payout: 20400,
            },
          },
        };
      }

      if (url.startsWith('/taquilla/tickets/') && url.endsWith('/movements')) {
        return { data: { data: [] } };
      }

      return { data: { data: [ticket] } };
    }),
    post: vi.fn(async () => ({ data: { data: ticket } })),
    put: vi.fn(async () => ({ data: { data: ticket } })),
    delete: vi.fn(async () => ({ data: {} })),
  },
}));

describe('Modulo de consultar y pagar tickets', () => {
  beforeEach(() => {
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 2, name: 'Taquilla Norte', role: 'taquilla', agency: { id: 1, name: 'Agencia Centro' } })
    );
  });

  it('abre el detalle del ticket al pulsar Ver', async () => {
    render(
      <MemoryRouter>
        <TaquillaTickets />
      </MemoryRouter>
    );

    const boton = await screen.findByRole('button', { name: /ver/i });
    boton.click();

    // El comprobante tiene que aparecer con los datos del ticket.
    await waitFor(() => {
      expect(screen.getByText('61556803')).toBeTruthy();
    });

    expect(screen.getByText('MATRIX BET')).toBeTruthy();
    expect(screen.getByText(/Agencia:/)).toBeTruthy();
    // El equipo se muestra desde el metadata de la seleccion.
    expect(screen.getAllByText('Visitante').length).toBeGreaterThan(0);
  });

  it('muestra un solo estado por ticket en la tabla', async () => {
    render(
      <MemoryRouter>
        <TaquillaTickets />
      </MemoryRouter>
    );

    await screen.findByRole('button', { name: /ver/i });

    // No debe aparecer a la vez 'Pendiente' y 'Pendiente de resultado'.
    expect(screen.queryByText('Pendiente')).toBeNull();
    expect(screen.getByText('No ganador')).toBeTruthy();
  });
});
