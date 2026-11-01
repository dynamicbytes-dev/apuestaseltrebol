import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BarChart3,
  AlertCircle,
  Calendar,
  TrendingUp,
  TrendingDown,
  Ticket,
  Wallet,
  RefreshCw,
  PieChart as PieIcon,
  CircleDot,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Layers,
  Flame,
  Gamepad2,
} from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { TICKET_TYPE_LABELS, TICKET_STATUS_LABELS, formatAmount } from '../utils/tickets';

// Minimalist KPI Card
function MetricCard({ icon: Icon, label, value, tone = 'default', hint, badge }) {
  // Color palette matching Sport & Adrenaline: #121212 #1E1E1E #E11D48 #38BDF8 #FFFFFF
  const colors = {
    crimson: { icon: '#E11D48', border: 'rgba(225, 29, 72, 0.35)', bg: 'rgba(225, 29, 72, 0.06)' },
    orange: { icon: '#E11D48', border: 'rgba(225, 29, 72, 0.35)', bg: 'rgba(225, 29, 72, 0.06)' },
    sky: { icon: '#38BDF8', border: 'rgba(56, 189, 248, 0.35)', bg: 'rgba(56, 189, 248, 0.06)' },
    peach: { icon: '#38BDF8', border: 'rgba(56, 189, 248, 0.35)', bg: 'rgba(56, 189, 248, 0.06)' },
    sage: { icon: '#10B981', border: 'rgba(16, 185, 129, 0.35)', bg: 'rgba(16, 185, 129, 0.06)' },
    emerald: { icon: '#10B981', border: 'rgba(16, 185, 129, 0.35)', bg: 'rgba(16, 185, 129, 0.06)' },
    danger: { icon: '#EF4444', border: 'rgba(239, 68, 68, 0.35)', bg: 'rgba(239, 68, 68, 0.06)' },
    default: { icon: 'var(--primary)', border: 'var(--border-subtle)', bg: 'transparent' },
  };

  const scheme = colors[tone] || colors.default;

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${scheme.border}`,
        borderRadius: 'var(--radius-md)',
        padding: '1.15rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        transition: 'transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 500 }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-canvas-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: scheme.icon,
            }}
          >
            <Icon size={16} strokeWidth={2.2} />
          </div>
          <span>{label}</span>
        </div>
        {badge && (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '0.15rem 0.45rem',
              borderRadius: '9999px',
              background: 'var(--bg-surface-hover)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {badge}
          </span>
        )}
      </div>

      <strong
        style={{
          fontSize: '1.55rem',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          marginTop: '0.2rem',
        }}
      >
        {value}
      </strong>

      {hint && (
        <span style={{ fontSize: '0.73rem', color: 'var(--text-tertiary)', lineHeight: 1.3 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

// Interactive SVG Bar & Trend Chart for Daily Analytics
function DailyActivityChart({ daily = [] }) {
  const [metric, setMetric] = useState('tickets'); // 'tickets' | 'stake'
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!daily || daily.length === 0) {
    return <p className="empty">Sin actividad diaria registrada en el periodo seleccionado.</p>;
  }

  const values = daily.map((d) => (metric === 'tickets' ? d.tickets : Number(d.stake || 0)));
  const maxValue = Math.max(1, ...values);

  const chartHeight = 220;
  const chartWidth = 720;
  const paddingX = 40;
  const paddingY = 25;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;

  const stepX = daily.length > 1 ? usableWidth / (daily.length - 1) : usableWidth / 2;

  // Generate SVG Points for Line & Area
  const points = daily.map((d, i) => {
    const val = metric === 'tickets' ? d.tickets : Number(d.stake || 0);
    const x = paddingX + i * stepX;
    const y = chartHeight - paddingY - (val / maxValue) * usableHeight;
    return { x, y, data: d, val };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${chartHeight - paddingY} L ${points[0].x.toFixed(1)} ${chartHeight - paddingY} Z`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Chart Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${metric === 'tickets' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMetric('tickets')}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
          >
            <Ticket size={13} />
            <span>Volumen de Tickets</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${metric === 'stake' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMetric('stake')}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
          >
            <Wallet size={13} />
            <span>Monto Apostado ($)</span>
          </button>
        </div>

        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.78rem',
              background: 'var(--bg-canvas-subtle)',
              border: '1px solid var(--border-medium)',
              padding: '0.25rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {points[hoveredIdx].data.date}
            </span>
            <span style={{ color: 'var(--palette-orange)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {metric === 'tickets' ? `${points[hoveredIdx].val} tickets` : formatAmount(points[hoveredIdx].val)}
            </span>
          </div>
        )}
      </div>

      {/* SVG Chart Container */}
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          background: 'var(--bg-canvas-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          padding: '0.5rem 0',
        }}
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E11D48" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#E11D48" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#E11D48" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = chartHeight - paddingY - pct * usableHeight;
            const gridVal = Math.round(pct * maxValue);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="var(--border-subtle)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-tertiary)"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                >
                  {metric === 'tickets' ? gridVal : `$${gridVal >= 1000 ? `${(gridVal / 1000).toFixed(1)}k` : gridVal}`}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaPath} fill="url(#chartGradient)" />

          {/* Line Path */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#lineStroke)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points & Interactive Hover Circles */}
          {points.map((p, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Active vertical guideline */}
                {isHovered && (
                  <line
                    x1={p.x}
                    y1={paddingY}
                    x2={p.x}
                    y2={chartHeight - paddingY}
                    stroke="var(--palette-orange)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.6"
                  />
                )}
                {/* Invisible hover hotspot */}
                <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
                {/* Outer halo */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 7 : 4}
                  fill={isHovered ? '#F87B1B' : 'var(--bg-surface)'}
                  stroke={isHovered ? '#ffffff' : '#F87B1B'}
                  strokeWidth={isHovered ? '2.5' : '2'}
                  style={{ transition: 'all 0.15s ease' }}
                />
                {/* X Axis Date labels (sparse if many days) */}
                {(daily.length <= 14 || i % Math.ceil(daily.length / 10) === 0 || i === daily.length - 1) && (
                  <text
                    x={p.x}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    fill={isHovered ? 'var(--text-primary)' : 'var(--text-tertiary)'}
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                    fontWeight={isHovered ? '700' : '400'}
                  >
                    {p.data.date.slice(5)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// Minimalist Donut Chart for Game Types Distribution
function GameTypeDonutChart({ byType = [] }) {
  const totalStake = useMemo(() => {
    return byType.reduce((acc, curr) => acc + Number(curr.stake || 0), 0);
  }, [byType]);

  // Color mapping per game
  const typeColors = {
    parley: '#38BDF8', // Electric Sky Blue (sports core)
    hipismo: '#E11D48', // Crimson Red (adrenaline)
    loterias: '#F59E0B', // Warm Amber
    animalitos: '#10B981', // Emerald
    default: '#1E1E1E',
  };

  const typeIcons = {
    hipismo: Flame,
    parley: Gamepad2,
    loterias: Ticket,
  };

  if (!byType || byType.length === 0) {
    return <p className="empty">Sin datos de juego en este periodo.</p>;
  }

  // Calculate donut arcs
  const radius = 60;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  const slices = byType.map((item) => {
    const stake = Number(item.stake || 0);
    const fraction = totalStake > 0 ? stake / totalStake : 1 / byType.length;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedOffset;
    accumulatedOffset += fraction * circumference;
    const color = typeColors[item.type] || typeColors.default;
    const percent = totalStake > 0 ? Number(((stake / totalStake) * 100).toFixed(1)) : 0;

    return {
      ...item,
      fraction,
      percent,
      strokeDasharray,
      strokeDashoffset,
      color,
    };
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 180px) 1fr', gap: '1.25rem', alignItems: 'center' }}>
      {/* SVG Donut */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '170px', margin: '0 auto' }}>
        <svg viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)', width: '100%', height: 'auto', display: 'block' }}>
          {/* Background circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="transparent"
            stroke="var(--bg-canvas-subtle)"
            strokeWidth={strokeWidth}
          />
          {slices.map((slice) => (
            <circle
              key={slice.type}
              cx="80"
              cy="80"
              r={radius}
              fill="transparent"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={slice.strokeDasharray}
              strokeDashoffset={slice.strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          ))}
        </svg>

        {/* Center label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>
            Total
          </span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {formatAmount(totalStake)}
          </span>
        </div>
      </div>

      {/* Legend & Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {slices.map((slice) => {
          const GameIcon = typeIcons[slice.type] || CircleDot;
          return (
            <div
              key={slice.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.45rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-canvas-subtle)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: slice.color,
                    flexShrink: 0,
                  }}
                />
                <GameIcon size={14} style={{ color: slice.color }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {TICKET_TYPE_LABELS[slice.type] ?? slice.type}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontFamily: 'var(--font-mono)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {formatAmount(slice.stake)}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    background: 'var(--bg-surface)',
                    color: slice.color,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {slice.percent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Minimalist Status Bar Breakdown
function StatusBreakdownBar({ byStatus = [] }) {
  const total = useMemo(() => {
    return byStatus.reduce((acc, curr) => acc + (curr.tickets || 0), 0);
  }, [byStatus]);

  if (!byStatus || byStatus.length === 0) {
    return <p className="empty">Sin datos de estado en el periodo.</p>;
  }

  const statusConfig = {
    won: { label: 'Ganados', color: 'var(--emerald-400)', icon: CheckCircle2 },
    paid: { label: 'Pagados', color: '#CBD99B', icon: CheckCircle2 },
    lost: { label: 'No premiados', color: '#ef4444', icon: XCircle },
    pending: { label: 'Pendientes', color: '#F87B1B', icon: Clock },
    cancelled: { label: 'Anulados', color: 'var(--text-tertiary)', icon: XCircle },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Segmented Progress bar */}
      <div
        style={{
          height: '14px',
          width: '100%',
          borderRadius: '9999px',
          overflow: 'hidden',
          display: 'flex',
          background: 'var(--bg-canvas-subtle)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {byStatus.map((row) => {
          const cfg = statusConfig[row.status] || { color: 'var(--text-secondary)' };
          const pct = total > 0 ? (row.tickets / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={row.status}
              title={`${row.status}: ${row.tickets} (${Number(pct.toFixed(1))}%)`}
              style={{
                width: `${pct}%`,
                backgroundColor: cfg.color,
                transition: 'width 0.4s ease',
              }}
            />
          );
        })}
      </div>

      {/* Grid of status items */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
        {byStatus.map((row) => {
          const cfg = statusConfig[row.status] || { label: row.status, color: 'var(--text-secondary)', icon: CircleDot };
          const StatusIcon = cfg.icon;
          const pct = total > 0 ? Number(((row.tickets / total) * 100).toFixed(1)) : 0;
          return (
            <div
              key={row.status}
              style={{
                background: 'var(--bg-canvas-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <StatusIcon size={12} style={{ color: cfg.color }} />
                  <span>{TICKET_STATUS_LABELS[row.status] ?? cfg.label}</span>
                </div>
                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: cfg.color }}>
                  {pct}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '0.15rem' }}>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {row.tickets}
                </strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {formatAmount(row.stake)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Analiticas() {
  const user = JSON.parse(localStorage.getItem('user') ?? '{}');
  const isAdmin = user.role === 'administrador';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = isAdmin ? '/admin/analytics' : '/supervisor/analytics';
      const res = await api.get(endpoint, {
        params: {
          from: from || undefined,
          to: to || undefined,
        },
      });
      setData(res.data.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // Quick date filters
  const setRangeQuick = (type) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (type === 'today') {
      const today = toStr(now);
      setFrom(today);
      setTo(today);
    } else if (type === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setFrom(toStr(past));
      setTo(toStr(now));
    } else if (type === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(toStr(firstDay));
      setTo(toStr(now));
    } else if (type === 'all') {
      setFrom('');
      setTo('');
    }
  };

  const totals = data?.totals ?? {};

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Header */}
      <header className="page-header" style={{ marginBottom: '0.25rem' }}>
        <div>
          <h1 className="page-title">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={24} style={{ color: 'var(--primary)' }} />
              <span>Analíticas & Métricas</span>
            </span>
            <span className="page-title-badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
              {isAdmin ? 'Operación Global' : 'Mi Agencia'}
            </span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
            {isAdmin
              ? 'Consolidado integral de apuestas, rendimiento por agencia, dividendos y tipos de juego.'
              : `Operación y resultados en vivo para ${data?.scope?.agency_name ?? 'tu agencia'}.`}
          </p>
        </div>
      </header>

      {error && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar with Quick Ranges */}
      <section
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          background: 'var(--bg-surface)',
          padding: '0.85rem 1.15rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="form-field" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
            <label htmlFor="analytics-from" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Desde:
            </label>
            <input
              id="analytics-from"
              className="input input-sm"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
            />
          </div>

          <div className="form-field" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
            <label htmlFor="analytics-to" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Hasta:
            </label>
            <input
              id="analytics-to"
              className="input input-sm"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={load}
            disabled={loading}
            style={{ padding: '0.4rem 0.8rem' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Consultando...' : 'Filtrar'}</span>
          </button>
        </div>

        {/* Quick Range Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setRangeQuick('today')}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.55rem' }}
          >
            Hoy
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setRangeQuick('7days')}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.55rem' }}
          >
            7 Días
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setRangeQuick('month')}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.55rem' }}
          >
            Este Mes
          </button>
          {(from || to) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRangeQuick('all')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.55rem', color: 'var(--palette-orange)' }}
            >
              Limpiar
            </button>
          )}
        </div>
      </section>

      {loading && !data ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem', color: 'var(--palette-orange)' }} />
          <p>Procesando métricas y analíticas financieras...</p>
        </div>
      ) : !data ? (
        <p className="empty">No se encontraron datos para los filtros especificados.</p>
      ) : (
        <>
          {/* Top KPI Metrics Row */}
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
            }}
          >
            <MetricCard
              icon={Ticket}
              label="Tickets Emitidos"
              value={totals.tickets ?? 0}
              tone="default"
              hint={`${totals.pending ?? 0} pendientes · ${totals.cancelled ?? 0} anulados`}
              badge="Total"
            />
            <MetricCard
              icon={Wallet}
              label="Total Apostado"
              value={formatAmount(totals.stake)}
              tone="orange"
              hint="Volumen bruto ingresado"
              badge="Ingresos"
            />
            <MetricCard
              icon={TrendingUp}
              label="Total Pagado"
              value={formatAmount(totals.paid)}
              tone="sage"
              hint={`${totals.paid_count ?? 0} tickets premiados pagados`}
              badge="Dividendos"
            />
            <MetricCard
              icon={(totals.net ?? 0) >= 0 ? TrendingUp : TrendingDown}
              label="Resultado Neto"
              value={formatAmount(totals.net)}
              tone={(totals.net ?? 0) >= 0 ? 'sage' : 'danger'}
              hint="Apostado menos Pagado"
              badge={(totals.stake ?? 0) > 0 ? `${(((totals.net ?? 0) / totals.stake) * 100).toFixed(1)}% margen` : '0.0% margen'}
            />
            <MetricCard
              icon={AlertCircle}
              label="Exposición Pendiente"
              value={formatAmount(totals.exposure)}
              tone="peach"
              hint="Premio potencial por cobrar"
              badge="En Juego"
            />
          </section>

          {/* Main Visual Charts Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Daily Trend SVG Chart */}
            <section className="card" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <TrendingUp size={18} style={{ color: 'var(--palette-orange)' }} />
                  <span>Actividad Diaria & Volumen</span>
                </h2>
                {data.period && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {data.period.from} al {data.period.to}
                  </span>
                )}
              </div>
              <DailyActivityChart daily={data.daily} />
            </section>

            {/* Game Types Distribution (Donut Chart) */}
            <section className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <PieIcon size={18} style={{ color: 'var(--palette-orange)' }} />
                  <span>Distribución por Juego</span>
                </h2>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Apostado ($)
                </span>
              </div>
              <GameTypeDonutChart byType={data.by_type} />
            </section>

            {/* Status Breakdown (Segmented Bar) */}
            <section className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Layers size={18} style={{ color: 'var(--palette-sage)' }} />
                  <span>Estado de los Tickets</span>
                </h2>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {totals.tickets ?? 0} Tickets
                </span>
              </div>
              <StatusBreakdownBar byStatus={data.by_status} />
            </section>
          </div>

          {/* Game Type Detail Table */}
          <section className="card">
            <h2 className="card-title" style={{ marginBottom: '0.85rem' }}>
              Rendimiento Financiero por Tipo de Juego
            </h2>
            {data.by_type?.length === 0 ? (
              <p className="empty">Sin datos en el periodo.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tipo de Juego</th>
                      <th style={{ textAlign: 'right' }}>Tickets</th>
                      <th style={{ textAlign: 'right' }}>Total Apostado</th>
                      <th style={{ textAlign: 'right' }}>Total Pagado</th>
                      <th style={{ textAlign: 'right' }}>Resultado</th>
                      <th style={{ textAlign: 'right' }}>% Retorno (RTP)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_type.map((row) => {
                      const net = Number(row.stake || 0) - Number(row.paid || 0);
                      const rtp = Number(row.stake || 0) > 0 ? ((Number(row.paid || 0) / Number(row.stake || 0)) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={row.type}>
                          <td style={{ fontWeight: 600 }}>
                            {TICKET_TYPE_LABELS[row.type] ?? row.type}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {row.tickets}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {formatAmount(row.stake)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--emerald-400)' }}>
                            {formatAmount(row.paid)}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: net >= 0 ? 'var(--emerald-400)' : '#ef4444',
                            }}
                          >
                            {formatAmount(net)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {rtp}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Parley Settlements (if any) */}
          {data.settlement && data.settlement.length > 0 && (
            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.85rem' }}>
                Liquidación de Parley Deportivo
              </h2>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {data.settlement.map((row) => (
                  <div
                    key={row.settlement_status}
                    style={{
                      background: 'var(--bg-canvas-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {row.settlement_status}
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--palette-orange)', fontFamily: 'var(--font-mono)' }}>
                      {row.tickets}
                    </strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Agency Breakdown (Admin Only) */}
          {isAdmin && (
            <section className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Building2 size={18} style={{ color: 'var(--palette-orange)' }} />
                  <span>Desglose por Agencia</span>
                </h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  {data.by_agency?.length ?? 0} agencias activas
                </span>
              </div>

              {data.by_agency?.length === 0 ? (
                <p className="empty">Sin actividad de agencias en el periodo.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Agencia</th>
                        <th style={{ textAlign: 'right' }}>Tickets</th>
                        <th style={{ textAlign: 'right' }}>Apostado</th>
                        <th style={{ textAlign: 'right' }}>Pagado</th>
                        <th style={{ textAlign: 'right' }}>Resultado Neto</th>
                        <th style={{ textAlign: 'right' }}>Comisión Agencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_agency.map((row) => (
                        <tr key={row.agency_id}>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <Building2 size={15} style={{ color: 'var(--text-tertiary)' }} />
                              <span>{row.agency_name}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{row.tickets}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatAmount(row.stake)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--emerald-400)' }}>
                            {formatAmount(row.paid)}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: row.net >= 0 ? 'var(--emerald-400)' : '#ef4444',
                            }}
                          >
                            {formatAmount(row.net)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--palette-orange)', fontWeight: 700 }}>
                            {formatAmount(row.share_amount)}
                            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '0.35rem', fontSize: '0.78rem' }}>
                              ({Number(row.share_percentage || 0).toFixed(1)}%)
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
