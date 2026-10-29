import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';

export default function SessionTimer() {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const expiresAt = Number(localStorage.getItem('sessionExpiresAt') || 0);
    if (!expiresAt) return 300; // 5 minutos por defecto
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    return remaining;
  });

  useEffect(() => {
    // Si no existe sessionExpiresAt pero hay sesión activa, inicializarla a 5 minutos
    let expiresAt = Number(localStorage.getItem('sessionExpiresAt') || 0);
    if (!expiresAt) {
      expiresAt = Date.now() + 5 * 60 * 1000;
      localStorage.setItem('sessionExpiresAt', String(expiresAt));
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('sessionExpiresAt');
        navigate('/login?expired=1');
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
      title="Tiempo restante de sesión activa (límite de 5 minutos)"
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
        color: isDanger
          ? '#ef4444'
          : isWarning
          ? '#f59e0b'
          : 'var(--text-secondary)',
      }}
    >
      <Timer size={14} className={isDanger ? 'animate-pulse' : ''} />
      <span>{formatted}</span>
    </div>
  );
}
