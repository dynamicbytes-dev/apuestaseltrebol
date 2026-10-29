import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import {
  getSecondsRemaining,
  refreshSession,
  clearSession,
  shouldRefreshSession,
} from '../utils/session';

export default function SessionTimer() {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsRemaining());
  const [renewing, setRenewing] = useState(false);

  const renew = useCallback(async () => {
    if (renewing) return;

    setRenewing(true);
    const renewed = await refreshSession();

    if (!renewed) {
      clearSession();
      navigate('/login?expired=1');
      return;
    }

    setSecondsLeft(getSecondsRemaining());
    setRenewing(false);
  }, [navigate, renewing]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const remaining = getSecondsRemaining();
      setSecondsLeft(remaining);

      // La sesión se renueva sola poco antes de caducar, para no interrumpir
      // al operador a mitad de la jornada. Si ya venció, se intenta una
      // última renovación antes de cerrar la sesión.
      if (remaining <= 0 || shouldRefreshSession()) {
        const renewed = await refreshSession();

        if (renewed) {
          setSecondsLeft(getSecondsRemaining());
        } else {
          clearInterval(interval);
          clearSession();
          navigate('/login?expired=1');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [navigate]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isWarning = secondsLeft <= 60;
  const isDanger = secondsLeft <= 30;

  return (
    <div
      title="Tiempo restante de sesión activa. Se renueva automáticamente al agotarse."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.45rem',
        padding: '0.35rem 0.75rem',
        borderRadius: 'var(--radius-full)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8rem',
        fontWeight: 700,
        letterSpacing: '0.02em',
        transition: 'all var(--transition-fast)',
        border: '1px solid',
        background: isDanger
          ? 'rgba(239, 68, 68, 0.15)'
          : isWarning
            ? 'rgba(245, 158, 11, 0.15)'
            : 'var(--bg-surface-hover)',
        borderColor: isDanger
          ? 'rgba(239, 68, 68, 0.4)'
          : isWarning
            ? 'rgba(245, 158, 11, 0.4)'
            : 'var(--border-subtle)',
        color: isDanger ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--text-secondary)',
      }}
    >
      <Timer size={14} className={isDanger ? 'animate-pulse' : ''} />
      <span>{formatted}</span>
      {isWarning && (
        <button
          type="button"
          onClick={renew}
          disabled={renewing}
          title="Renovar la sesión ahora"
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: renewing ? 'wait' : 'pointer',
            fontSize: '0.7rem',
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          {renewing ? '...' : 'renovar'}
        </button>
      )}
    </div>
  );
}
