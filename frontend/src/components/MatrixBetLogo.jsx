import React from 'react';

/**
 * Isotipo Minimalista Matrix Bet:
 * Monograma "M" limpio y de alta precisión geométrica.
 * Paleta oficial de la aplicación:
 * - Primario: Crimson Red (#E11D48)
 * - Secundario: Electric Sky Blue (#38BDF8)
 * - Superficie: Carbon Black (#181818)
 */
export function MatrixBetIcon({ size = 28, className = '', style = {} }) {
  const gradId = React.useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <defs>
        {/* Gradiente oficial de la app: Electric Sky Blue -> Crimson Red */}
        <linearGradient id={`${gradId}-app`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
      </defs>

      {/* Contenedor sutil de superficie dark minimalista */}
      <rect
        width="32"
        height="32"
        rx="8"
        fill="#181818"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth="1"
      />

      {/* Trazo M minimalista continuo y puro */}
      <path
        d="M7.5 23.5V9.5L16 18L24.5 9.5V23.5"
        stroke={`url(#${gradId}-app)`}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Logotipo Completo Matrix Bet: Isotipo minimalista + Tipografía de la marca
 */
export default function MatrixBetLogo({
  size = 32,
  subtitle = null,
  className = '',
  style = {},
}) {
  return (
    <div
      className={`matrix-bet-brand-logo ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.65rem',
        userSelect: 'none',
        textDecoration: 'none',
        ...style,
      }}
    >
      <MatrixBetIcon size={size} />

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', var(--font-sans), sans-serif",
              fontWeight: 800,
              fontSize: `${Math.max(14, size * 0.56)}px`,
              letterSpacing: '0.02em',
              color: 'var(--text-primary, #FFFFFF)',
              textTransform: 'uppercase',
            }}
          >
            Matrix
          </span>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', var(--font-sans), sans-serif",
              fontWeight: 900,
              fontSize: `${Math.max(14, size * 0.56)}px`,
              letterSpacing: '0.02em',
              background: 'linear-gradient(135deg, #38BDF8 0%, #E11D48 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textTransform: 'uppercase',
            }}
          >
            Bet
          </span>
        </div>

        {subtitle && (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 500,
              color: 'var(--text-tertiary, #71717A)',
              letterSpacing: '0.02em',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
