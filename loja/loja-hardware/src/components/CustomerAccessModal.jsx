import { useState } from 'react';
import { loginCustomer, registerCustomer } from '../services/api';

export default function CustomerAccessModal({ isOpen, onAuthenticated }) {
  const [mode, setMode] = useState('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isRegistering = mode === 'register';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const authenticate = isRegistering ? registerCustomer : loginCustomer;
      const session = await authenticate({ username, password });
      onAuthenticated(session);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível continuar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(8, 8, 16, 0.7)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    borderRadius: '10px',
    padding: '11px 14px',
    fontSize: '0.875rem',
    color: 'var(--text-main)',
    fontFamily: "'Outfit', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(4, 4, 10, 0.9)', backdropFilter: 'blur(8px)' }}
    >
      {/* Glow orbs */}
      <div
        className="pointer-events-none fixed"
        style={{
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          top: '10%',
          left: '10%',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="pointer-events-none fixed"
        style={{
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)',
          bottom: '10%',
          right: '10%',
          filter: 'blur(40px)',
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl p-7 shadow-2xl"
        style={{
          background: 'rgba(13, 13, 24, 0.95)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          boxShadow: '0 24px 80px rgba(4, 4, 10, 0.7), 0 0 0 1px rgba(99,102,241,0.1)',
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-6 right-6 h-px rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.7), rgba(56,189,248,0.5), transparent)' }}
        />

        {/* Logo & Title */}
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(56,189,248,0.1) 100%)',
              border: '1px solid rgba(99,102,241,0.3)',
              boxShadow: '0 0 24px rgba(99,102,241,0.2)',
            }}
          >
            <svg className="h-7 w-7" style={{ color: '#818cf8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p
            className="text-xs font-bold tracking-[0.2em] uppercase mb-2"
            style={{ color: '#818cf8' }}
          >
            Nexus Hardware
          </p>
          <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {isRegistering ? 'Criar conta' : 'Entrar na conta'}
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-dim)' }}>
            {isRegistering
              ? 'Crie seu usuário para navegar e comprar.'
              : 'Informe seu usuário e senha para continuar.'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div
          className="mb-6 flex rounded-xl p-1 text-sm"
          style={{ background: 'rgba(8,8,16,0.6)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <button
            type="button"
            onClick={() => changeMode('register')}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all"
            style={{
              background: isRegistering ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
              color: isRegistering ? '#fff' : 'var(--text-dim)',
              boxShadow: isRegistering ? '0 2px 12px rgba(99,102,241,0.4)' : 'none',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Criar conta
          </button>
          <button
            type="button"
            onClick={() => changeMode('login')}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all"
            style={{
              background: !isRegistering ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
              color: !isRegistering ? '#fff' : 'var(--text-dim)',
              boxShadow: !isRegistering ? '0 2px 12px rgba(99,102,241,0.4)' : 'none',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Entrar
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Usuário
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength="3"
              maxLength="40"
              pattern="[A-Za-z0-9._\\-]+"
              autoComplete="username"
              required
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Senha
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength="6"
              maxLength="100"
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              required
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </label>
        </div>

        {error && (
          <div
            className="mt-4 flex items-center gap-2 rounded-xl p-3 text-sm"
            role="alert"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}
          >
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {error}
          </div>
        )}

        <button
          disabled={isSubmitting}
          className="mt-5 w-full py-3.5 text-sm font-bold rounded-xl transition-all"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#fff',
            boxShadow: '0 6px 24px rgba(99,102,241,0.4)',
            fontFamily: "'Outfit', sans-serif",
            cursor: isSubmitting ? 'wait' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.55)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.4)';
          }}
        >
          {isSubmitting ? 'Aguarde...' : isRegistering ? '→ Criar e continuar' : '→ Entrar'}
        </button>
      </form>
    </div>
  );
}
