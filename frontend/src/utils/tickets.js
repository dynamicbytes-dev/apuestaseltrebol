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
  });
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

