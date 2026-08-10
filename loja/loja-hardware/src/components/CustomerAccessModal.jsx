import { useEffect, useRef, useState } from 'react';
import { loginCustomer, registerCustomer } from '../services/api';

export default function CustomerAccessModal({ isOpen, onAuthenticated, storeName }) {
  const [mode, setMode] = useState('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const usernameRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    usernameRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

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
    <div className="customer-overlay fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 py-6 sm:items-center">
      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="customer-access-title" className="customer-access-card w-full max-w-md rounded-[1.65rem] p-6 shadow-2xl sm:p-7">
        <div className="customer-card-mark" aria-hidden="true"><span>✦</span><i /></div>
        <p className="section-kicker">Olá, você está na {storeName}</p>
        <h2 id="customer-access-title" className="mt-2 text-3xl font-extrabold text-[var(--text)]">{isRegistering ? 'Vamos começar?' : 'Que bom te ver.'}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{isRegistering ? 'Crie uma conta rápida para guardar sua seleção e continuar para a compra.' : 'Entre com seu usuário e sua senha para continuar.'}</p>

        <div className="customer-tabs mt-6 flex rounded-xl p-1 text-sm">
          <button type="button" onClick={() => changeMode('register')} aria-pressed={isRegistering} className={`flex-1 rounded-lg py-2.5 transition-colors ${isRegistering ? 'is-active font-semibold' : ''}`}>Criar conta</button>
          <button type="button" onClick={() => changeMode('login')} aria-pressed={!isRegistering} className={`flex-1 rounded-lg py-2.5 transition-colors ${!isRegistering ? 'is-active font-semibold' : ''}`}>Entrar</button>
        </div>

        <label className="customer-label mt-6 block text-sm">
          Usuário
          <input ref={usernameRef} value={username} onChange={(event) => setUsername(event.target.value)} minLength="3" maxLength="40" pattern="(?:[A-Za-z0-9._]|-)+" autoComplete="username" required className="customer-input mt-2 w-full rounded-xl px-3.5 py-3 outline-none" />
        </label>
        <label className="customer-label mt-4 block text-sm">
          Senha
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="6" maxLength="100" autoComplete={isRegistering ? 'new-password' : 'current-password'} required className="customer-input mt-2 w-full rounded-xl px-3.5 py-3 outline-none" />
        </label>
        {error && <p role="alert" aria-live="polite" className="mt-4 text-sm text-rose-500">{error}</p>}
        <button disabled={isSubmitting} className="customer-submit mt-6 w-full cursor-pointer rounded-xl py-3.5 font-semibold disabled:cursor-wait disabled:opacity-60">
          {isSubmitting ? 'Aguarde...' : isRegistering ? 'Criar e continuar' : 'Entrar na minha conta'}
        </button>
        <p className="customer-privacy">Ao continuar, sua seleção fica protegida durante a compra.</p>
      </form>
    </div>
  );
}
