const STATUS_LABELS = {
  NS: 'Programado',
  TBD: 'Por definir',
  FT: 'Finalizado',
  AET: 'Finalizado',
  PEN: 'Finalizado',
  AOT: 'Finalizado',
  AP: 'Finalizado',
  PST: 'Pospuesto',
  CANC: 'Cancelado',
  ABD: 'Suspendido',
  SUSP: 'Suspendido',
  INT: 'Interrumpido',
  AWD: 'Adjudicado',
  WO: 'Walkover',
  LIVE: 'En vivo',
  1: 'Programado',
  2: 'En vivo',
  3: 'Finalizado',
};

export const VENEZUELA_TIMEZONE = 'America/Caracas';

export function todayISO() {
  // 'en-CA' formatea como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VENEZUELA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function formatTime(value) {
  if (!value) return '—';

  return new Date(value).toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VENEZUELA_TIMEZONE,
  });
}

export function formatDateTime(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString('es-VE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: VENEZUELA_TIMEZONE,
  });
}

export function statusLabel(status) {
  const short = String(status?.short ?? '').toUpperCase();

  return STATUS_LABELS[short] ?? status?.long ?? '—';
}

export function statusClass(status) {
  const short = String(status?.short ?? '').toUpperCase();
  const long = String(status?.long ?? '').toLowerCase();

  if (
    ['FT', 'AET', 'PEN', 'AOT', 'AP', 'AWD', 'WO', '3'].includes(short) ||
    long.includes('finished') ||
    long.includes('final')
  ) {
    return 'status-finished';
  }

  if (
    ['NS', 'TBD', 'PST', 'CANC', 'ABD', 'SUSP', 'INT', '1'].includes(short) ||
    long.includes('not started') ||
    long.includes('scheduled') ||
    long.includes('postponed')
  ) {
    return 'status-pending';
  }

  return 'status-live';
}

export function eventScore(event) {
  if (event.score?.home === null || event.score?.home === undefined) {
    return '—';
  }

  return `${event.score.home} - ${event.score.away ?? 0}`;
}

export function resolveBetTeam(selectionLabel, homeTeam, awayTeam) {
  if (!selectionLabel) return homeTeam || awayTeam || '—';

  const label = String(selectionLabel).trim();
  const lowerLabel = label.toLowerCase();
  const lowerHome = (homeTeam || '').toLowerCase();
  const lowerAway = (awayTeam || '').toLowerCase();

  if (['home', '1', 'local', 'h'].includes(lowerLabel)) {
    return homeTeam || 'Local';
  }
  if (['away', '2', 'visitante', 'a'].includes(lowerLabel)) {
    return awayTeam || 'Visitante';
  }
  if (['draw', 'x', 'empate'].includes(lowerLabel)) {
    return 'Empate';
  }

  if (lowerHome && (lowerLabel === lowerHome || lowerLabel.startsWith(lowerHome))) {
    return homeTeam;
  }
  if (lowerAway && (lowerLabel === lowerAway || lowerLabel.startsWith(lowerAway))) {
    return awayTeam;
  }

  if (lowerHome && lowerLabel.includes(lowerHome)) {
    return homeTeam;
  }
  if (lowerAway && lowerLabel.includes(lowerAway)) {
    return awayTeam;
  }

  return label;
}

