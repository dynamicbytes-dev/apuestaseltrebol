/**
 * Utilidades de horarios de sorteo.
 *
 * Venezuela no observa horario de verano desde 2016, así que la diferencia
 * con UTC es fija en -04:00.
 */

const CARACAS_OFFSET = '-04:00';

/**
 * Instante (en UTC) de un sorteo a partir de su fecha y hora locales.
 *
 * @param {string} date  AAAA-MM-DD
 * @param {string} time  HH:MM
 * @returns {Date|null}
 */
export function drawInstant(date, time) {
  if (!date || !time) {
    return null;
  }

  const parsed = new Date(`${date}T${time}:00${CARACAS_OFFSET}`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Indica si el sorteo ya pasó y no admite apuestas.
 */
export function isDrawPast(date, time) {
  const instant = drawInstant(date, time);

  return instant ? instant.getTime() <= Date.now() : false;
}

/**
 * Indica si el sorteo ya tiene resultado oficial registrado.
 *
 * @param {Array<{lottery_id: number, sorteo_at: string}>} resolvedDraws
 */
export function isDrawClosed(resolvedDraws, lotteryId, date, time) {
  const instant = drawInstant(date, time);

  if (!instant) {
    return false;
  }

  const target = instant.getTime();

  return (resolvedDraws ?? []).some(
    (draw) =>
      String(draw.lottery_id) === String(lotteryId) &&
      new Date(draw.sorteo_at).getTime() === target
  );
}

/**
 * Texto del sorteo para mostrarlo en la interfaz.
 */
export function formatDrawLabel(date, time) {
  if (!date || !time) {
    return '—';
  }

  const instant = drawInstant(date, time);

  if (!instant) {
    return '—';
  }

  const dia = instant.toLocaleDateString('es-VE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Caracas',
  });

  return `${dia} ${time}`;
}
