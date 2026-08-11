import { useEffect, useMemo, useRef, useState } from 'react';
import { createPaymentCheckout, fetchPaymentMethods } from '../services/api';
import {
  beginCheckoutAttempt,
  discardCheckoutAttempt,
  rememberPendingCheckout,
} from '../services/paymentStorage';

function isValidCpf(value) {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length) => { const total = cpf.slice(0, length).split('').reduce((sum, number, index) => sum + Number(number) * (length + 1 - index), 0); const result = (total * 10) % 11; return result === 10 ? 0 : result; };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}
const onlyDigits = (value) => value.replace(/\D/g, '');
const formatCep = (value) => value.length > 5 ? `${value.slice(0, 5)}-${value.slice(5)}` : value;
const CARD_PAYMENT_METHOD = 'CARTAO_CREDITO';
const PAYMENT_METHOD_LABELS = {
  CARTAO_CREDITO: 'Cartão de crédito',
  BOLETO: 'Boleto',
  PIX: 'Pix',
};

function isDefinitiveAttemptConflict(error) {
  if (Number(error?.status) !== 409) return false;
  if (['CHECKOUT_ATTEMPT_TERMINAL', 'IDEMPOTENCY_PAYLOAD_MISMATCH'].includes(error?.code)) return true;
  const message = error?.message || '';
  return /tentativa(?: de checkout)?.{0,60}encerrada/i.test(message)
    || /chave de idempot[eê]ncia.{0,60}(?:j[aá] )?foi usada com outro checkout/i.test(message);
}

export default function CheckoutDialog({ isOpen, onClose, cartItems }) {
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [cpf, setCpf] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(CARD_PAYMENT_METHOD); const [postalCode, setPostalCode] = useState('');
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([CARD_PAYMENT_METHOD]);
  const [paymentMethodsMessage, setPaymentMethodsMessage] = useState('');
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [state, setState] = useState(''); const [city, setCity] = useState(''); const [neighborhood, setNeighborhood] = useState('');
  const [street, setStreet] = useState(''); const [addressNumber, setAddressNumber] = useState('');
  const [error, setError] = useState(''); const [cepMessage, setCepMessage] = useState(''); const [isLookingUpCep, setIsLookingUpCep] = useState(false); const [isSubmitting, setIsSubmitting] = useState(false);
  const total = useMemo(() => cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0), [cartItems]);
  const fullNameRef = useRef(null);
  const submissionInProgressRef = useRef(false);
  const cepLookupRef = useRef({ sequence: 0, controller: null });

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    fullNameRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submissionInProgressRef.current) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    let isActive = true;
    setIsLoadingPaymentMethods(true);
    setPaymentMethodsMessage('');

    fetchPaymentMethods({ signal: controller.signal })
      .then((methods) => {
        if (!isActive) return;
        setAvailablePaymentMethods(methods);
        setPaymentMethod((current) => (
          methods.includes(current)
            ? current
            : methods.includes(CARD_PAYMENT_METHOD) ? CARD_PAYMENT_METHOD : methods[0]
        ));
      })
      .catch((requestError) => {
        if (!isActive || requestError?.name === 'AbortError') return;
        setAvailablePaymentMethods([CARD_PAYMENT_METHOD]);
        setPaymentMethod(CARD_PAYMENT_METHOD);
        setPaymentMethodsMessage('Não foi possível consultar as opções agora; somente cartão está disponível nesta tentativa.');
      })
      .finally(() => {
        if (isActive) setIsLoadingPaymentMethods(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [isOpen]);

  useEffect(() => () => {
    cepLookupRef.current.sequence += 1;
    cepLookupRef.current.controller?.abort();
    cepLookupRef.current.controller = null;
  }, []);

  if (!isOpen) return null;

  const lookupCep = async (rawCep) => {
    if (rawCep.length !== 8) return;
    cepLookupRef.current.controller?.abort();
    const sequence = cepLookupRef.current.sequence + 1;
    const controller = new AbortController();
    cepLookupRef.current = { sequence, controller };
    setIsLookingUpCep(true); setCepMessage('Buscando endereço...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`, { signal: controller.signal });
      const address = await response.json();
      if (controller.signal.aborted || cepLookupRef.current.sequence !== sequence) return;
      if (!response.ok || address.erro) throw new Error('CEP não encontrado. Preencha o endereço manualmente.');
      setStreet(address.logradouro || ''); setNeighborhood(address.bairro || ''); setCity(address.localidade || ''); setState(address.uf || '');
      setCepMessage(address.logradouro ? 'Endereço preenchido. Confirme o número.' : 'CEP localizado. Complete rua e bairro.');
    } catch (lookupError) {
      if (controller.signal.aborted || cepLookupRef.current.sequence !== sequence) return;
      setCepMessage(lookupError.message || 'Não foi possível buscar o CEP.');
    }
    finally {
      if (cepLookupRef.current.sequence === sequence) {
        cepLookupRef.current.controller = null;
        setIsLookingUpCep(false);
      }
    }
  };
  const handleCepChange = (event) => {
    const nextCep = onlyDigits(event.target.value).slice(0, 8);
    cepLookupRef.current.sequence += 1;
    cepLookupRef.current.controller?.abort();
    cepLookupRef.current.controller = null;
    setIsLookingUpCep(false);
    setPostalCode(nextCep);
    setCepMessage('');
    if (nextCep !== postalCode) {
      setState(''); setCity(''); setNeighborhood(''); setStreet(''); setAddressNumber('');
    }
    if (nextCep.length === 8) lookupCep(nextCep);
  };
  const handleClose = () => {
    if (!submissionInProgressRef.current) onClose();
  };
  const handleSubmit = async (event) => {
    event.preventDefault(); setError('');
    if (submissionInProgressRef.current) return;
    if (isLoadingPaymentMethods) return setError('Aguarde a confirmação das formas de pagamento disponíveis.');
    if (!availablePaymentMethods.includes(paymentMethod)) return setError('Selecione uma forma de pagamento disponível.');
    if (!isValidCpf(cpf)) return setError('Informe um CPF válido.');
    if (postalCode.length !== 8 || !state || !city || !neighborhood || !street || !addressNumber) return setError('Preencha todos os dados de entrega.');
    const items = cartItems.map((item) => ({ productId: item.id, quantity: item.quantity }));
    let attempt;
    try {
      attempt = beginCheckoutAttempt(items);
    } catch (storageError) {
      return setError(storageError.message || 'Não foi possível preparar esta tentativa de pagamento.');
    }
    submissionInProgressRef.current = true;
    setIsSubmitting(true);
    try {
      const checkout = await createPaymentCheckout({ fullName, email, cpf, paymentMethod, postalCode, state, city, neighborhood, street, addressNumber, items }, attempt.idempotencyKey);
      if (!rememberPendingCheckout(checkout.orderId, attempt.items, attempt.idempotencyKey)) {
        throw new Error('O checkout foi criado, mas não foi possível guardar sua referência. Mantenha esta janela aberta e tente novamente.');
      }
      window.location.assign(checkout.checkoutUrl);
    } catch (requestError) {
      const attemptMustRotate = isDefinitiveAttemptConflict(requestError);
      if (attemptMustRotate) discardCheckoutAttempt(attempt.idempotencyKey);
      const message = requestError.message || 'Não foi possível registrar seu pedido.';
      setError(attemptMustRotate ? `${message} Clique novamente para iniciar uma nova tentativa.` : message);
    }
    finally { submissionInProgressRef.current = false; setIsSubmitting(false); }
  };
  const inputClass = 'checkout-input mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none';

  return (
    <div className="checkout-overlay fixed inset-0 z-[80] overflow-y-auto p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="checkout-title" aria-describedby="checkout-description" className="checkout-dialog mx-auto my-4 w-full max-w-5xl rounded-3xl p-5 shadow-2xl sm:my-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div><p className="section-kicker">Finalizar compra</p><h2 id="checkout-title" className="mt-1 text-2xl font-black text-[var(--text)]">Entrega e pagamento</h2><p id="checkout-description" className="mt-1 text-sm text-[var(--muted)]">Precisamos destes dados para enviar seu pedido certinho.</p></div>
          <button type="button" onClick={handleClose} disabled={isSubmitting} className="close-checkout text-2xl disabled:cursor-wait disabled:opacity-40" aria-label="Fechar checkout">×</button>
        </div>

        <form onSubmit={handleSubmit} className="checkout-layout mt-7">
          <div className="checkout-fields space-y-6">
            <fieldset><legend className="checkout-legend">Seus dados</legend><div className="mt-3 grid gap-4 sm:grid-cols-2"><Field label="Nome completo"><input ref={fullNameRef} value={fullName} onChange={(event) => setFullName(event.target.value)} minLength="5" maxLength="160" autoComplete="name" required className={inputClass} /></Field><Field label="E-mail"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength="254" autoComplete="email" required className={inputClass} /></Field><Field label="CPF"><input value={cpf} onChange={(event) => setCpf(event.target.value)} inputMode="numeric" maxLength="14" placeholder="000.000.000-00" required className={inputClass} /></Field><Field label="Forma de pagamento"><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={isLoadingPaymentMethods} className={`${inputClass} disabled:cursor-wait disabled:opacity-60`}>{availablePaymentMethods.map((method) => <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>)}</select>{paymentMethodsMessage && <small className="mt-2 block text-xs leading-5 text-amber-600">{paymentMethodsMessage}</small>}</Field></div></fieldset>
            <fieldset><legend className="checkout-legend">Endereço de entrega</legend><div className="mt-3 grid gap-4 sm:grid-cols-6"><Field label="CEP" className="sm:col-span-2"><div className="relative"><input value={formatCep(postalCode)} onChange={handleCepChange} inputMode="numeric" maxLength="9" autoComplete="postal-code" placeholder="00000-000" required className={inputClass} />{isLookingUpCep && <span className="cep-loader" aria-label="Buscando CEP" />}</div></Field><Field label="Estado" className="sm:col-span-1"><input value={state} onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))} maxLength="2" autoComplete="address-level1" required className={inputClass} /></Field><Field label="Município" className="sm:col-span-3"><input value={city} onChange={(event) => setCity(event.target.value)} maxLength="120" autoComplete="address-level2" required className={inputClass} /></Field><Field label="Rua" className="sm:col-span-4"><input value={street} onChange={(event) => setStreet(event.target.value)} maxLength="180" autoComplete="street-address" required className={inputClass} /></Field><Field label="Número" className="sm:col-span-2"><input value={addressNumber} onChange={(event) => setAddressNumber(event.target.value)} maxLength="20" autoComplete="address-line2" required className={inputClass} /></Field><Field label="Bairro" className="sm:col-span-6"><input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} maxLength="160" autoComplete="address-level3" required className={inputClass} /></Field></div>{cepMessage && <p aria-live="polite" className={`mt-3 text-xs ${cepMessage.startsWith('CEP não') || cepMessage.startsWith('Não foi') ? 'text-rose-500' : 'text-emerald-600'}`}>{cepMessage}</p>}</fieldset>
          </div>

          <aside className="checkout-summary">
            <div><p className="checkout-legend">Sua seleção</p><p className="mt-2 text-sm text-[var(--muted)]">{cartItems.reduce((sum, item) => sum + item.quantity, 0)} itens preparados para você.</p></div>
            <div className="checkout-items">{cartItems.map((item) => <div className="checkout-item" key={item.id}><img src={item.imageUrl} alt="" loading="lazy" decoding="async" /><div><strong>{item.name}</strong><small>{item.quantity}× · R$ {Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small></div></div>)}</div>
            <div className="checkout-total flex items-center justify-between rounded-2xl p-4 text-sm"><span className="text-[var(--muted)]">Total do pedido</span><strong className="text-lg text-[var(--text)]">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
            {error && <p role="alert" aria-live="polite" className="text-sm text-rose-500">{error}</p>}
            <button disabled={isSubmitting || isLookingUpCep || isLoadingPaymentMethods} className="admin-primary w-full cursor-pointer rounded-xl py-3 font-semibold disabled:cursor-wait disabled:opacity-60">{isSubmitting ? 'Redirecionando para pagamento...' : isLoadingPaymentMethods ? 'Carregando formas de pagamento...' : 'Ir para pagamento seguro'}</button>
            <p className="checkout-security"><span aria-hidden="true">✓</span> Pagamento processado no checkout seguro da Stripe. A sacola será mantida até a confirmação.</p>
          </aside>
        </form>
      </div>
    </div>
  );
}
function Field({ label, className = '', children }) { return <label className={`block text-sm font-medium text-[var(--text)] ${className}`}>{label}{children}</label>; }
