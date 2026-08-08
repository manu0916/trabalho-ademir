import { useState } from 'react';

export default function AdminLogin({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await onAuthenticated({ email, password });
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível autenticar.');
    } finally {
      setIsSubmitting(false);
    }
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

  const focusHandlers = {
    onFocus: (e) => {
      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)';
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
    },
    onBlur: (e) => {
      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)';
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  return (
    <section className="max-w-md mx-auto px-4 py-16">
      <div
        className="relative rounded-2xl p-7"
        style={{
          background: 'rgba(13, 13, 24, 0.97)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          boxShadow: '0 24px 60px rgba(4,4,10,0.5)',
        }}
      >
        {/* Top glow */}
        <div
          className="absolute top-0 left-8 right-8 h-px rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.7), rgba(56,189,248,0.4), transparent)' }}
        />

        {/* Icon */}
        <div
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(56,189,248,0.1) 100%)',
            border: '1px solid rgba(99,102,241,0.3)',
          }}
        >
          <svg className="h-6 w-6" style={{ color: '#818cf8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        <h1
          className="text-2xl font-black text-white mb-1"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Acesso Administrativo
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
          Informe suas credenciais para entrar no painel.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" htmlFor="admin-email" style={{ color: 'var(--text-muted)' }}>
              E-mail
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength="254"
              style={inputStyle}
              {...focusHandlers}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" htmlFor="admin-password" style={{ color: 'var(--text-muted)' }}>
              Senha
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength="12"
              maxLength="72"
              style={inputStyle}
              {...focusHandlers}
            />
          </div>

          {error && (
            <div
              className="flex items-center gap-2 rounded-xl p-3 text-sm"
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
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 text-sm font-bold rounded-xl transition-all"
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
            {isSubmitting ? '⏳ Verificando...' : '→ Entrar no painel'}
          </button>
        </form>
      </div>
    </section>
  );
}
