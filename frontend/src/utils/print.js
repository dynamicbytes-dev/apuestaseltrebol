/**
 * Impresion del comprobante en impresoras termicas de punto de venta.
 */

/** Ancho del papel de la impresora termica (80 mm es lo estandar). */
export const TICKET_PAPER_WIDTH_MM = 80;

/** Area imprimible: el papel menos los margenes que usa la impresora. */
export const TICKET_CONTENT_WIDTH_MM = 74;

/** Selector del comprobante dentro del modal. */
const TICKET_SELECTOR = '#printable-ticket';

/**
 * Convierte pixeles CSS a milimetros.
 */
function pxToMm(px) {
  return (px * 25.4) / 96;
}

/**
 * Imprime solo el comprobante, ajustado al ancho del papel.
 *
 * La altura de la pagina se calcula con la altura real del comprobante: de
 * ese modo el ticket cabe en una sola hoja y el papel no sale con una franja
 * en blanco al final.
 */
export function printTicket() {
  const ticket = document.querySelector(TICKET_SELECTOR);

  if (!ticket) {
    window.print();
    return;
  }

  const alto = Math.max(60, Math.ceil(pxToMm(ticket.scrollHeight)));

  // Chrome ignora "auto" en la altura de pagina, asi que se inyecta una
  // regla con la medida exacta justo antes de imprimir.
  const style = document.createElement('style');
  style.setAttribute('data-print-ticket', 'true');
  style.textContent = `@page { size: ${TICKET_PAPER_WIDTH_MM}mm ${alto}mm; margin: 0; }`;

  document.head.appendChild(style);

  try {
    window.print();
  } finally {
    style.remove();
  }
}
