import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clover, Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import api from '../api/client';
import { getErrorMessage } from '../utils/errors';
import { homePathForRole } from '../utils/roles';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [expiredNotice] = useState(() => {
    return window.location.search.includes('expired=1');
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user, expires_in } = response.data;

      // El plazo lo define el servidor: el cliente no lo inventa.
      const durationMs = (Number(expires_in) || 0) * 1000;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      if (durationMs > 0) {
        localStorage.setItem('sessionExpiresAt', String(Date.now() + durationMs));
      } else {
        localStorage.removeItem('sessionExpiresAt');
      }

      navigate(homePathForRole(user.role));
    } catch (err) {
      // El mensaje sale del servidor cuando la respuesta lo trae. Si no hay
      // respuesta (API apagada, puerto equivocado) el aviso lo dice, para no
      // culpar a unas credenciales que pueden estar correctas.
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-canvas)',
        backgroundImage: `
          radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.12) 0%, transparent 60%),
          radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.06) 0%, transparent 50%),
          radial-gradient(circle at 20% 60%, rgba(16, 185, 129, 0.05) 0%, transparent 40%)
        `,
        padding: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background-color var(--transition-fast)',
      }}
    >
      {/* Floating Theme Toggle in top-right corner */}
      <div
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 10,
        }}
      >
        <ThemeToggle showLabel />
      </div>

      {/* Background ambient decorative rings */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          border: '1px solid rgba(16, 185, 129, 0.1)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '-60px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          border: '1px solid rgba(16, 185, 129, 0.15)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.2) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
              boxShadow: '0 0 35px rgba(16, 185, 129, 0.35)',
              marginBottom: '1rem',
            }}
          >
            <Clover size={36} strokeWidth={2.5} />
          </div>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '0 0 0.4rem',
              background: 'var(--brand-title-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            El Trébol
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.92rem',
              margin: 0,
            }}
          >
            Sistema Integral de Apuestas, Hipismo & Parley
          </p>
        </div>

        {/* Card Box */}
        <div
          style={{
            backgroundColor: 'var(--bg-glass)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid var(--border-medium)',
            padding: '2.25rem',
            boxShadow: 'var(--shadow-lg)',
            transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
          }}
        >
          <div style={{ marginBottom: '1.5rem' }}>
            <h2
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: '0 0 0.25rem',
              }}
            >
              Iniciar sesión
            </h2>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              Ingresa tus credenciales para acceder al terminal
            </p>
          </div>

          {expiredNotice && (
            <div
              className="alert alert-info"
              style={{
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>⏱️ Tu sesión finalizar y debes iniciar sesión nuevamente.</span>
            </div>
          )}

          {error && (
            <div
              className="alert alert-error"
              style={{
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Email Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <label
                htmlFor="login-email"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                Correo electrónico
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    color: 'var(--text-tertiary)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@eltrebol.com"
                  className="input"
                  style={{
                    paddingLeft: '42px',
                    height: '46px',
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <label
                htmlFor="login-password"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                Contraseña
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    color: 'var(--text-tertiary)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input"
                  style={{
                    paddingLeft: '42px',
                    paddingRight: '42px',
                    height: '46px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                height: '46px',
                marginTop: '0.5rem',
                fontSize: '0.95rem',
                width: '100%',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <span>Ingresar al Sistema</span>
              )}
            </button>
          </form>

          {/* Security badge footer */}
          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              color: 'var(--text-tertiary)',
              fontSize: '0.75rem',
            }}
          >
            <ShieldCheck size={15} color="var(--primary)" />
            <span>Terminal seguro verificado • Cifrado de alta seguridad</span>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
