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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#121214] p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Nexus Hardware</p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          {isRegistering ? 'Crie sua conta' : 'Entre na sua conta'}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          {isRegistering
            ? 'Use um nome de usuário único para continuar navegando e comprar.'
            : 'Informe seu usuário e senha para continuar.'}
        </p>

        <div className="mt-5 flex rounded-lg border border-zinc-800 bg-black/30 p-1 text-sm">
          <button type="button" onClick={() => changeMode('register')} className={`flex-1 rounded-md py-2 ${isRegistering ? 'bg-sky-500 font-semibold text-black' : 'text-zinc-400'}`}>
            Criar conta
          </button>
          <button type="button" onClick={() => changeMode('login')} className={`flex-1 rounded-md py-2 ${!isRegistering ? 'bg-sky-500 font-semibold text-black' : 'text-zinc-400'}`}>
            Entrar
          </button>
        </div>

        <label className="mt-5 block text-sm text-zinc-300">
          Usuário
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength="3"
            maxLength="40"
            pattern="[A-Za-z0-9._\\-]+"
            autoComplete="username"
            required
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2.5 text-white outline-none transition focus:border-sky-400"
          />
        </label>

        <label className="mt-4 block text-sm text-zinc-300">
          Senha
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength="6"
            maxLength="100"
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            required
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2.5 text-white outline-none transition focus:border-sky-400"
          />
        </label>

        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}

        <button disabled={isSubmitting} className="mt-5 w-full rounded-xl bg-sky-500 py-3 font-semibold text-black transition hover:bg-sky-400 disabled:cursor-wait disabled:opacity-60">
          {isSubmitting ? 'Aguarde...' : isRegistering ? 'Criar e continuar' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
