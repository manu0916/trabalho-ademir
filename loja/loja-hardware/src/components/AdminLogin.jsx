import { useState } from 'react';

export default function AdminLogin({ onAuthenticated, storeName, theme }) {
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

  return (
    <section className="admin-login-wrap mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-20">
      <div className="admin-login-stage">
        <div className="admin-login-editorial" aria-hidden="true">
          <p className="section-kicker">{theme?.edition || 'Acesso editorial'}</p>
          <h1>{theme?.title || 'Sua loja, sob seu olhar.'}</h1>
          <p>{theme?.footerStatement || 'Uma área reservada para cuidar de cada detalhe da vitrine.'}</p>
          <div className="admin-login-signals">
            <span><b>01</b>Estoque</span><span><b>02</b>Pedidos</span><span><b>03</b>Identidade</span>
          </div>
        </div>

        <div className="admin-login-card rounded-[1.65rem] p-6 shadow-2xl sm:p-8">
          <p className="section-kicker">Área restrita · {storeName}</p>
          <h2 className="mt-2 text-3xl font-extrabold text-[var(--text)]">Bem-vindo de volta.</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Use suas credenciais para cuidar da vitrine, dos pedidos e do estoque.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="admin-login-label block text-xs font-semibold" htmlFor="admin-email">
              E-mail
              <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength="254" autoFocus className="admin-input mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none" />
            </label>
            <label className="admin-login-label block text-xs font-semibold" htmlFor="admin-password">
              Senha
              <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength="12" maxLength="72" className="admin-input mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none" />
            </label>
            {error && <p className="text-sm text-rose-500" role="alert" aria-live="polite">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="admin-primary w-full cursor-pointer rounded-xl py-3.5 font-semibold disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Verificando acesso...' : 'Entrar no painel'}
            </button>
          </form>
          <p className="admin-login-secure"><span aria-hidden="true">◉</span> Sessão protegida e acesso restrito</p>
        </div>
      </div>
    </section>
  );
}
