import { useEffect, useRef, useState } from 'react';
import { loginCustomer, registerCustomer } from '../services/api';
import useModalAccessibility from '../hooks/useModalAccessibility';

export default function CustomerAccessModal({
  isOpen,
  onAuthenticated,
  onClose,
  storeName,
  initialMode = 'register',
  checkoutRequired = false,
}) {
  const [mode, setMode] = useState(initialMode === 'login' ? 'login' : 'register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const usernameRef = useRef(null);
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setError('');
      return undefined;
    }
    setMode(initialMode === 'login' ? 'login' : 'register');
    setError('');
    return undefined;
  }, [initialMode, isOpen]);

  const requestClose = () => {
    if (onClose && !submittingRef.current) onClose();
  };

  useModalAccessibility({
    isOpen,
    dialogRef,
    initialFocusRef: usernameRef,
    onClose: requestClose,
    canClose: Boolean(onClose) && !isSubmitting,
  });

  if (!isOpen) return null;
  const isRegistering = mode === 'register';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const authenticate = isRegistering ? registerCustomer : loginCustomer;
      const session = await authenticate({ username, password });
      onAuthenticated(session);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível continuar.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  return (
    <div data-modal-root="true" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }} className="customer-overlay fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 py-6 sm:items-center">
      <form ref={dialogRef} tabIndex="-1" onSubmit={handleSubmit} aria-busy={isSubmitting} role="dialog" aria-modal="true" aria-labelledby="customer-access-title" aria-describedby="customer-access-description" className="customer-access-card w-full max-w-md rounded-[1.65rem] p-6 shadow-2xl sm:p-7">
        {onClose ? (
          <button type="button" onClick={requestClose} disabled={isSubmitting} className="close-checkout absolute right-4 top-4 z-10 text-2xl disabled:cursor-wait disabled:opacity-40" aria-label={checkoutRequired ? 'Fechar e voltar para a sacola' : 'Fechar acesso à conta'}>×</button>
        ) : (
          <div className="customer-card-mark" aria-hidden="true"><span>✦</span><i /></div>
        )}
        <p className={`section-kicker ${onClose ? 'pr-12' : ''}`}>{checkoutRequired ? 'Sua sacola está pronta' : `Olá, você está na ${storeName}`}</p>
        <h2 id="customer-access-title" className="mt-2 text-3xl font-extrabold text-[var(--text)]">
          {checkoutRequired
            ? isRegistering ? 'Crie sua conta para comprar' : 'Entre para finalizar'
            : isRegistering ? 'Vamos começar?' : 'Que bom te ver.'}
        </h2>
        <p id="customer-access-description" className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {checkoutRequired
            ? isRegistering
              ? 'É rápido: sua sacola será mantida e o checkout abrirá assim que a conta for criada.'
              : 'Sua sacola está salva. Entre com seu usuário e sua senha para continuar no checkout.'
            : isRegistering
              ? 'Crie uma conta rápida para guardar sua seleção e continuar para a compra.'
              : 'Entre com seu usuário e sua senha para continuar.'}
        </p>

        <div className="customer-tabs mt-6 flex rounded-xl p-1 text-sm">
          <button type="button" disabled={isSubmitting} onClick={() => changeMode('register')} aria-pressed={isRegistering} className={`flex-1 rounded-lg py-2.5 transition-colors disabled:cursor-wait disabled:opacity-60 ${isRegistering ? 'is-active font-semibold' : ''}`}>Criar conta</button>
          <button type="button" disabled={isSubmitting} onClick={() => changeMode('login')} aria-pressed={!isRegistering} className={`flex-1 rounded-lg py-2.5 transition-colors disabled:cursor-wait disabled:opacity-60 ${!isRegistering ? 'is-active font-semibold' : ''}`}>Entrar</button>
        </div>

        <label className="customer-label mt-6 block text-sm">
          Usuário
          <input ref={usernameRef} disabled={isSubmitting} value={username} onChange={(event) => setUsername(event.target.value)} minLength="3" maxLength="40" pattern="(?:[A-Za-z0-9._]|-)+" autoComplete="username" required className="customer-input mt-2 w-full rounded-xl px-3.5 py-3 outline-none disabled:cursor-wait disabled:opacity-60" />
        </label>
        <label className="customer-label mt-4 block text-sm">
          Senha
          <input type="password" disabled={isSubmitting} value={password} onChange={(event) => setPassword(event.target.value)} minLength="6" maxLength="100" autoComplete={isRegistering ? 'new-password' : 'current-password'} required className="customer-input mt-2 w-full rounded-xl px-3.5 py-3 outline-none disabled:cursor-wait disabled:opacity-60" />
        </label>
        {error && <p role="alert" aria-live="polite" className="mt-4 text-sm text-rose-500">{error}</p>}
        <button disabled={isSubmitting} className="customer-submit mt-6 w-full cursor-pointer rounded-xl py-3.5 font-semibold disabled:cursor-wait disabled:opacity-60">
          {isSubmitting
            ? 'Aguarde...'
            : checkoutRequired
              ? isRegistering ? 'Criar conta e ir ao checkout' : 'Entrar e ir ao checkout'
              : isRegistering ? 'Criar e continuar' : 'Entrar na minha conta'}
        </button>
        <p className="customer-privacy">{checkoutRequired ? 'Você pode fechar e continuar navegando. O login só é necessário para comprar.' : 'Ao continuar, sua seleção fica protegida durante a compra.'}</p>
      </form>
    </div>
  );
}
