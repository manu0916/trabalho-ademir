import React, { useState } from 'react';

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
      setError(requestError.message || 'Nao foi possivel autenticar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="max-w-md mx-auto px-4 py-12">
      <div className="bg-[#121214] border border-[#27272a] rounded-xl p-6 shadow-xl">
        <h1 className="text-2xl font-extrabold text-white">Acesso administrativo</h1>
        <p className="text-sm text-zinc-400 mt-2">Informe apenas e-mail e senha.</p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <label className="block text-xs text-zinc-400 mb-2" htmlFor="admin-email">E-mail</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength="254"
              className="w-full bg-[#0a0a0a] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-2" htmlFor="admin-password">Senha</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength="12"
              maxLength="72"
              className="w-full bg-[#0a0a0a] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
            />
          </div>

          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-sky-500 disabled:bg-sky-800 hover:bg-sky-400 text-black font-semibold py-3 rounded-lg text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Verificando...' : 'Entrar no painel'}
          </button>
        </form>
      </div>
    </section>
  );
}
