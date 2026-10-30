import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  printTicket,
  prepareTicketForPrint,
  TICKET_PAPER_WIDTH_MM,
  TICKET_CONTENT_WIDTH_MM,
} from '../utils/print';

describe('Impresion del comprobante', () => {
  let imprimir;
  let reglaAlImprimir;
  let raizAlImprimir;
  let padreAlImprimir;
  let copiaAlImprimir;
  let altoPx;

  beforeEach(() => {
    // window.print es sincrono en el navegador: la regla de pagina y el
    // contenedor de impresion siguen puestos mientras se imprime. El mock
    // captura en ese momento lo que hay que comprobar.
    reglaAlImprimir = null;
    raizAlImprimir = null;
    padreAlImprimir = null;
    copiaAlImprimir = null;
    imprimir = vi.fn(() => {
      const estilo = document.head.querySelector('style[data-print-ticket]');
      reglaAlImprimir = estilo ? estilo.textContent : null;
      raizAlImprimir = document.getElementById('print-root');
      padreAlImprimir = raizAlImprimir ? raizAlImprimir.parentElement : null;
      copiaAlImprimir = raizAlImprimir
        ? raizAlImprimir.querySelector('[data-printable-ticket]')
        : null;
    });
    window.print = imprimir;
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    // jsdom no hace layout: se simula la medida del comprobante.
    altoPx = 400;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      width: 280,
      height: altoPx,
      top: 0,
      left: 0,
      right: 280,
      bottom: altoPx,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const comprobante = (conMovimientos = false) => {
    const ticket = document.createElement('div');
    ticket.id = 'printable-ticket';

    const cabecera = document.createElement('div');
    cabecera.textContent = 'EL TRÉBOL';
    ticket.appendChild(cabecera);

    if (conMovimientos) {
      const movimientos = document.createElement('div');
      movimientos.setAttribute('data-print', 'hide');
      movimientos.textContent = 'MOVIMIENTOS';
      ticket.appendChild(movimientos);
    }

    document.body.appendChild(ticket);

    return ticket;
  };

  it('calcula la altura con el comprobante y la inyecta como tamano de pagina', () => {
    comprobante();

    printTicket();

    expect(reglaAlImprimir).toContain(`size: ${TICKET_PAPER_WIDTH_MM}mm`);
    // 400 px son unos 106 mm.
    expect(reglaAlImprimir).toMatch(/size: 80mm 1\d\dmm/);
    expect(imprimir).toHaveBeenCalled();
  });

  it('usa el ancho de papel termico de 80 mm y sin margenes de pagina', () => {
    comprobante();

    printTicket();

    expect(reglaAlImprimir).toContain('80mm');
    expect(reglaAlImprimir).toContain('margin: 0');
  });

  it('coloca una copia del comprobante en un contenedor propio del body', () => {
    const original = comprobante();

    printTicket();

    expect(raizAlImprimir).not.toBeNull();
    // El contenedor tiene que ser hijo directo del body: es lo que permite
    // que el CSS esconda toda la interfaz con display:none.
    expect(padreAlImprimir).toBe(document.body);

    expect(copiaAlImprimir).not.toBeNull();
    expect(copiaAlImprimir.textContent).toContain('EL TRÉBOL');

    // El comprobante original no se mueve: el modal sigue intacto.
    expect(original.parentElement).toBe(document.body);
    expect(document.querySelectorAll('#printable-ticket').length).toBe(1);
  });

  it('mide el comprobante con el ancho del papel y no con el de la pantalla', () => {
    comprobante();

    printTicket();

    expect(copiaAlImprimir.style.width).toBe(`${TICKET_CONTENT_WIDTH_MM}mm`);
    expect(copiaAlImprimir.style.boxSizing).toBe('border-box');
    expect(copiaAlImprimir.style.fontSize).toBe('9pt');
  });

  it('oculta en la copia lo que no cabe en un recibo de papel', () => {
    comprobante(true);

    printTicket();

    const movimientos = copiaAlImprimir.querySelector('[data-print="hide"]');
    expect(movimientos.style.display).toBe('none');
  });

  it('quita el contenedor y la regla de pagina al terminar', () => {
    comprobante();

    printTicket();

    expect(document.head.querySelectorAll('style[data-print-ticket]').length).toBe(0);
    expect(document.getElementById('print-root')).toBeNull();
  });

  it('imprime igualmente si no hay comprobante en pantalla', () => {
    printTicket();

    expect(imprimir).toHaveBeenCalled();
    expect(document.head.querySelectorAll('style[data-print-ticket]').length).toBe(0);
  });

  it('usa una altura minima razonable', () => {
    altoPx = 0;
    comprobante();

    printTicket();

    expect(reglaAlImprimir).toContain('80mm 60mm');
  });

  it('preparar la impresion deja la pagina lista y se puede restaurar', () => {
    comprobante();

    const restaurar = prepareTicketForPrint();

    expect(document.getElementById('print-root')).not.toBeNull();
    expect(document.head.querySelector('style[data-print-ticket]')).not.toBeNull();

    restaurar();

    expect(document.getElementById('print-root')).toBeNull();
    expect(document.head.querySelector('style[data-print-ticket]')).toBeNull();
  });
});
