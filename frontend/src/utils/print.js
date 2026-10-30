/**
 * Impresion del comprobante en impresoras termicas de punto de venta.
 */

/** Ancho del papel de la impresora termica (80 mm es lo estandar). */
export const TICKET_PAPER_WIDTH_MM = 80;

/** Area imprimible: el papel menos los margenes que usa la impresora. */
export const TICKET_CONTENT_WIDTH_MM = 74;

/** Selector del comprobante dentro del modal. */
const TICKET_SELECTOR = '#printable-ticket';

/** Contenedor propio donde se coloca la copia del comprobante que se imprime. */
const PRINT_ROOT_ID = 'print-root';

/**
 * Estilos que el comprobante lleva al imprimirse.
 *
 * Se aplican tambien al medirlo, para que la altura calculada sea la misma
 * que la que sale en el papel (si se midiera con el ancho de la pantalla, el
 * texto se partiria en otras lineas y la altura seria falsa).
 */
const PRINT_STYLES = {
  width: `${TICKET_CONTENT_WIDTH_MM}mm`,
  maxWidth: `${TICKET_CONTENT_WIDTH_MM}mm`,
  boxSizing: 'border-box',
  padding: '2mm',
  fontFamily: "'Courier New', ui-monospace, SFMono-Regular, monospace",
  fontSize: '9pt',
  lineHeight: '1.35',
};

/**
 * Convierte pixeles CSS a milimetros.
 */
function pxToMm(px) {
  return (px * 25.4) / 96;
}

/**
 * Prepara el comprobante para imprimir.
 *
 * - Se copia el comprobante a un contenedor propio (hijo directo del body)
 *   para que el CSS pueda ocultar toda la interfaz con `display: none` sin
 *   tocar el recibo, y para que la copia no dependa del modal.
 * - Se mide el alto real con el ancho del papel.
 * - Chrome ignora `auto` en el alto de pagina, asi que se inyecta una regla
 *   `@page` con la medida exacta justo antes de imprimir.
 *
 * @returns {() => void} funcion que deja la pagina como estaba
 */
export function prepareTicketForPrint() {
  const original = document.querySelector(TICKET_SELECTOR);

  if (!original) {
    return () => {};
  }

  const comprobante = original.cloneNode(true);
  comprobante.removeAttribute('id');
  comprobante.setAttribute('data-printable-ticket', '');

  // Lo que no cabe en un recibo de papel tampoco se mide.
  comprobante.querySelectorAll('[data-print="hide"]').forEach((elemento) => {
    elemento.style.display = 'none';
  });

  Object.assign(comprobante.style, PRINT_STYLES);

  const raiz = document.createElement('div');
  raiz.id = PRINT_ROOT_ID;
  raiz.setAttribute('data-print-root', '');
  // Se mantiene fuera de la vista: se imprime, pero no se ve aparecer.
  raiz.style.cssText = `position: fixed; left: -10000px; top: 0; width: ${TICKET_CONTENT_WIDTH_MM}mm;`;
  raiz.appendChild(comprobante);
  document.body.appendChild(raiz);

  const alto = Math.max(60, Math.ceil(pxToMm(comprobante.getBoundingClientRect().height)) + 2);

  const estilo = document.createElement('style');
  estilo.setAttribute('data-print-ticket', 'true');
  estilo.textContent = `@page { size: ${TICKET_PAPER_WIDTH_MM}mm ${alto}mm; margin: 0; }`;
  document.head.appendChild(estilo);

  return function restaurar() {
    estilo.remove();
    raiz.remove();
  };
}

/**
 * Imprime solo el comprobante, ajustado al ancho del papel.
 */
export function printTicket() {
  const restaurar = prepareTicketForPrint();

  try {
    window.print();
  } finally {
    restaurar();
  }
}
