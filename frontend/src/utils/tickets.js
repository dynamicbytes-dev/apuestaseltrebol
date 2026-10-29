import { VENEZUELA_TIMEZONE } from './parley';

export const TICKET_TYPE_LABELS = {
  animalitos: 'Animalitos',
  hipismo: 'Hipismo',
  parley: 'Parley',
};

export const TICKET_STATUS_LABELS = {
  pending: 'Pendiente',
  paid: 'Pagado',
  cancelled: 'Anulado',
};

// Estado de liquidación: indica si la jugada es ganadora, perdedora,
// si todavía no hay resultado oficial o si requiere revisión manual.
export const SETTLEMENT_STATUS_LABELS = {
  pending: 'Pendiente de resultado',
  won: 'Ganador',
  lost: 'No ganador',
  review: 'En revisión',
};

export function settlementStatusLabel(status) {
  return SETTLEMENT_STATUS_LABELS[status] ?? status ?? '';
}

export function settlementStatusClass(status) {
  if (status === 'won') {
    return 'status-finished';
  }

  if (status === 'lost') {
    return 'status-inactive';
  }

  if (status === 'review') {
    return 'status-pending';
  }

  return 'status-pending';
}

/**
 * Estado único del ticket para las tablas.
 *
 * Un ticket solo muestra un estado: si esta pagado o anulado manda ese; si
 * no, manda el resultado de la liquidacion, que cambia solo cuando se
 * registra el resultado oficial.
 */
export function ticketSingleStatus(ticket) {
  if (ticket.status === 'paid') {
    return { key: 'paid', label: 'Pagado', className: 'status-finished' };
  }

  if (ticket.status === 'cancelled') {
    return { key: 'cancelled', label: 'Anulado', className: 'status-inactive' };
  }

  if (ticket.settlement_status === 'won') {
    return { key: 'won', label: 'Ganador', className: 'status-finished' };
  }

  if (ticket.settlement_status === 'lost') {
    return { key: 'lost', label: 'No ganador', className: 'status-inactive' };
  }

  if (ticket.settlement_status === 'review') {
    return { key: 'review', label: 'En revisión', className: 'status-pending' };
  }

  return { key: 'pending', label: 'Pendiente de resultado', className: 'status-pending' };
}

/**
 * El ticket solo se puede pagar si la liquidación lo permite.
 * Un ticket perdedor o en revisión no habilita el pago en taquilla.
 */
export function canPayTicket(ticket) {
  if (!ticket || ticket.status !== 'pending') {
    return false;
  }

  if (ticket.settlement_status === 'lost' || ticket.settlement_status === 'review') {
    return false;
  }

  return true;
}

export const MOVEMENT_LABELS = {
  created: 'Ticket emitido',
  paid: 'Premio pagado',
  cancelled: 'Ticket anulado',
  settlement_won: 'Jugada ganadora',
  settlement_lost: 'Jugada perdedora',
  review: 'Enviado a revisión',
};

export function ticketStatusClass(status) {
  if (status === 'paid') {
    return 'status-finished';
  }

  if (status === 'cancelled') {
    return 'status-inactive';
  }

  return 'status-pending';
}

export function formatAmount(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  return Number(value).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatTicketDate(value) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('es-VE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: VENEZUELA_TIMEZONE,
  });
}

/**
 * Formatea la hora de un sorteo declarado por la apuesta.
 */
export function formatDrawTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return `${date.toLocaleDateString('es-VE', {
    dateStyle: 'short',
    timeZone: VENEZUELA_TIMEZONE,
  })} ${date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VENEZUELA_TIMEZONE,
  })}`;
}

export const TICKET_CANCEL_WINDOW_MINUTES = 5;

export function canCancelTicket(ticket) {
  if (!ticket || ticket.status !== 'pending' || !ticket.created_at) {
    return false;
  }
  const createdAt = new Date(ticket.created_at).getTime();
  const diffMinutes = (Date.now() - createdAt) / (1000 * 60);
  return diffMinutes < TICKET_CANCEL_WINDOW_MINUTES;
}

export function getCancelMinutesRemaining(ticket) {
  if (!ticket || ticket.status !== 'pending' || !ticket.created_at) {
    return 0;
  }
  const createdAt = new Date(ticket.created_at).getTime();
  const elapsedMs = Date.now() - createdAt;
  const remainingMs = (TICKET_CANCEL_WINDOW_MINUTES * 60 * 1000) - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / (1000 * 60)));
}

