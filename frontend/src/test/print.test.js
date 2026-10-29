import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { printTicket, TICKET_PAPER_WIDTH_MM } from '../utils/print';

describe('Impresion del comprobante', () => {
  let imprimir;
  let reglaAlImprimir;

  beforeEach(() => {
    // window.print es sincrono en el navegador: la regla de pagina sigue
    // puesta mientras se imprime. El mock la captura en ese momento.
    reglaAlImprimir = null;
    imprimir = vi.fn(() => {
      const estilo = document.head.querySelector('style[data-print-ticket]');
      reglaAlImprimir = estilo ? estilo.textContent : null;
    });
    window.print = imprimir;
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const comprobante = (altoPx) => {
    const ticket = document.createElement('div');
    ticket.id = 'printable-ticket';
    // jsdom no hace layout: se simula la medida del comprobante.
    Object.defineProperty(ticket, 'scrollHeight', { value: altoPx });
    document.body.appendChild(ticket);

    return ticket;
  };

  it('calcula la altura con el comprobante y la inyecta como tamano de pagina', () => {
    comprobante(400);

    printTicket();

    expect(reglaAlImprimir).toContain(`size: ${TICKET_PAPER_WIDTH_MM}mm`);
    // 400 px son unos 106 mm.
    expect(reglaAlImprimir).toMatch(/size: 80mm 1\d\dmm/);
    expect(imprimir).toHaveBeenCalled();
  });

  it('usa el ancho de papel termico de 80 mm', () => {
    comprobante(300);

    printTicket();

    expect(reglaAlImprimir).toContain('80mm');
    expect(reglaAlImprimir).toContain('margin: 0');
  });

  it('quita la regla de pagina al terminar', () => {
    comprobante(200);

    printTicket();

    expect(document.head.querySelectorAll('style[data-print-ticket]').length).toBe(0);
  });

  it('imprime igualmente si no hay comprobante en pantalla', () => {
    printTicket();

    expect(imprimir).toHaveBeenCalled();
    expect(document.head.querySelectorAll('style[data-print-ticket]').length).toBe(0);
  });

  it('usa una altura minima razonable', () => {
    comprobante(0);

    printTicket();

    expect(reglaAlImprimir).toContain('80mm 60mm');
  });
});
