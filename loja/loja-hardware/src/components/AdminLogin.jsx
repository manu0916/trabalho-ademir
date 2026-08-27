import { useState } from 'react';

export default function AdminLogin({ onAuthenticated, serviceMessage = '', storeName, theme }) {
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
    <section className="admin-login-page" aria-labelledby="admin-login-title">
      <div className="admin-login-layout">
        <aside aria-hidden="true" className="admin-login-editorial">
          <p className="eyebrow">
            {theme?.edition || 'Kicks Store · gestão'}
          </p>
          <h2>
            {theme?.title || 'Sua loja, sob seu olhar.'}
          </h2>
          <p>
            {theme?.footerStatement || 'Uma área reservada para cuidar de cada detalhe da vitrine.'}
          </p>
          <div className="admin-login-editorial__steps">
            <span><strong>01</strong> Produtos</span>
            <span><strong>02</strong> Estoque</span>
            <span><strong>03</strong> Pedidos</span>
          </div>
        </aside>

        <div className="admin-login-card">
          <div className="admin-login-mark">
            <img
              src="/favicon.svg"
              alt={`Identidade visual ${storeName}`}
            />
          </div>

          <p className="eyebrow">
            Área restrita · {storeName}
          </p>
          <h1 id="admin-login-title">
            Bem-vindo de volta.
          </h1>
          <p className="admin-login-card__intro">
            Use suas credenciais para cuidar da vitrine, dos pedidos e do estoque.
          </p>

          {serviceMessage && (
            <p className="admin-login-service" role="status" aria-live="polite">
              {serviceMessage}
            </p>
          )}

          <form onSubmit={handleSubmit} className="admin-login-form">
            <label htmlFor="admin-email">
              E-mail
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength="254"
                autoFocus
                className="admin-login-input"
                placeholder="seu@email.com"
              />
            </label>

            <label htmlFor="admin-password">
              Senha
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength="12"
                maxLength="72"
                className="admin-login-input"
                placeholder="••••••••••••"
              />
            </label>

            {error && (
              <p className="admin-login-error" role="alert" aria-live="polite">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="button button-primary admin-login-submit"
            >
              {isSubmitting ? 'Verificando acesso...' : 'Entrar no painel'}
            </button>
          </form>

          <p className="admin-login-security">
            <span aria-hidden="true">●</span> Sessão protegida e acesso restrito
          </p>
        </div>
      </div>
    </section>
  );
}
