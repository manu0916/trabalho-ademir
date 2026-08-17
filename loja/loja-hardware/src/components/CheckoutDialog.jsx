import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createPaymentCheckout,
  fetchCustomerAccount,
} from '../services/api';
import CustomerAddressFields from './CustomerAddressFields';
import { addressPayload, addressToForm, EMPTY_CUSTOMER_ADDRESS, formatCep, formatCpf, isAddressComplete, onlyDigits } from '../utils/customerAddress';
import useModalAccessibility from '../hooks/useModalAccessibility';
import {
  beginCheckoutAttempt,
  discardCheckoutAttempt,
  rememberPendingCheckout,
} from '../services/paymentStorage';

const EMPTY_PROFILE = { fullName: '', email: '', cpf: '' };
const MAX_SAVED_ADDRESSES = 10;

function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length) => {
    const total = cpf.slice(0, length).split('').reduce((sum, number, index) => sum + Number(number) * (length + 1 - index), 0);
    const result = (total * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function isDefinitiveAttemptConflict(error) {
  if (Number(error?.status) !== 409) return false;
  if (['CHECKOUT_ATTEMPT_TERMINAL', 'IDEMPOTENCY_PAYLOAD_MISMATCH'].includes(error?.code)) return true;
  const message = error?.message || '';
  return /tentativa(?: de checkout)?.{0,60}encerrada/i.test(message)
    || /chave de idempot[eê]ncia.{0,60}(?:j[aá] )?foi usada com outro checkout/i.test(message);
}

function isAuthenticationError(error) {
  return error?.status === 401 || error?.status === 403;
}

export default function CheckoutDialog({
  isOpen,
  onClose,
  cartItems,
  onAuthenticationRequired,
  onManageAccount,
  initialDraft = null,
  onDraftChange,
}) {
  const initialDraftRef = useRef(initialDraft);
  const [account, setAccount] = useState(null);
  const [personalForm, setPersonalForm] = useState(() => initialDraft?.personalForm || EMPTY_PROFILE);
  const [addressMode, setAddressMode] = useState(() => initialDraft?.addressMode === 'saved' ? 'saved' : 'new');
  const [selectedAddressId, setSelectedAddressId] = useState(() => String(initialDraft?.selectedAddressId || ''));
  const [newAddress, setNewAddress] = useState(() => addressToForm(initialDraft?.newAddress || EMPTY_CUSTOMER_ADDRESS));
  const [saveNewAddress, setSaveNewAddress] = useState(() => initialDraft?.saveNewAddress !== false);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [accountLoadError, setAccountLoadError] = useState('');
  const [accountLoadAttempt, setAccountLoadAttempt] = useState(0);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // State shown after a successful order creation when the redirect was blocked
  const [whatsappFallback, setWhatsappFallback] = useState(null);
  const total = useMemo(() => cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0), [cartItems]);
  const fullNameRef = useRef(null);
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const submissionInProgressRef = useRef(false);
  const latestDraftRef = useRef(null);
  latestDraftRef.current = { personalForm, addressMode, selectedAddressId, newAddress, saveNewAddress };

  useEffect(() => {
    if (!isOpen) return;
    onDraftChange?.(latestDraftRef.current);
  }, [addressMode, isOpen, newAddress, onDraftChange, personalForm, saveNewAddress, selectedAddressId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    let isActive = true;
    setIsLoadingAccount(true);
    setAccount(null);
    setAccountLoadError('');
    setError('');

    fetchCustomerAccount({ signal: controller.signal })
      .then((nextAccount) => {
        if (!isActive) return;
        const restoredDraft = initialDraftRef.current;
        const addresses = Array.isArray(nextAccount?.addresses) ? nextAccount.addresses : [];
        const preferredAddress = addresses.find((address) => address.isDefault) || addresses[0];
        const restoredAddress = addresses.find((address) => String(address.id) === String(restoredDraft?.selectedAddressId || ''));
        const canSaveAnotherAddress = addresses.length < MAX_SAVED_ADDRESSES;
        setAccount({ ...nextAccount, profile: nextAccount?.profile || null, addresses });
        setPersonalForm({
          fullName: nextAccount?.profile?.fullName || restoredDraft?.personalForm?.fullName || '',
          email: nextAccount?.profile?.email || restoredDraft?.personalForm?.email || '',
          cpf: nextAccount?.profile ? '' : restoredDraft?.personalForm?.cpf || '',
        });
        const shouldRestoreNewAddress = restoredDraft?.addressMode === 'new';
        setAddressMode(shouldRestoreNewAddress || !preferredAddress ? 'new' : 'saved');
        setSelectedAddressId(restoredAddress ? String(restoredAddress.id) : preferredAddress ? String(preferredAddress.id) : '');
        setNewAddress(addressToForm(restoredDraft?.newAddress || { ...EMPTY_CUSTOMER_ADDRESS, isDefault: addresses.length === 0 }));
        setSaveNewAddress(canSaveAnotherAddress && restoredDraft?.saveNewAddress !== false);
        window.setTimeout(() => {
          if (!nextAccount?.profile) fullNameRef.current?.focus();
        }, 0);
      })
      .catch((requestError) => {
        if (!isActive || requestError?.name === 'AbortError') return;
        if (isAuthenticationError(requestError)) {
          onAuthenticationRequired?.(latestDraftRef.current);
          return;
        }
        setAccountLoadError(requestError.message || 'Não foi possível carregar os dados da sua conta.');
      })
      .finally(() => {
        if (isActive) setIsLoadingAccount(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [accountLoadAttempt, isOpen, onAuthenticationRequired]);

  const handleClose = () => {
    if (!submissionInProgressRef.current) onClose();
  };

  useModalAccessibility({
    isOpen,
    dialogRef,
    initialFocusRef: closeButtonRef,
    onClose: handleClose,
    canClose: !isSubmitting,
  });

  if (!isOpen) return null;

  const savedAddressLimitReached = (account?.addresses?.length || 0) >= MAX_SAVED_ADDRESSES;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (submissionInProgressRef.current) return;
    if (isLoadingAccount) return setError('Aguarde o carregamento dos dados da sua conta.');
    if (accountLoadError) return setError('Recarregue os dados da sua conta antes de continuar.');
    if (!account?.profile && !isValidCpf(personalForm.cpf)) return setError('Informe um CPF válido para salvar seus dados pessoais.');
    if (addressMode === 'saved' && !account?.addresses?.some((address) => String(address.id) === selectedAddressId)) return setError('Selecione um endereço de entrega.');
    if (addressMode === 'new' && !isAddressComplete(newAddress, saveNewAddress)) return setError('Preencha todos os dados do novo endereço.');

    const items = cartItems.map((item) => ({ productId: item.id, quantity: item.quantity }));
    let attempt;
    try {
      attempt = beginCheckoutAttempt(items);
    } catch (storageError) {
      setError(storageError.message || 'Não foi possível preparar esta tentativa de pagamento.');
      return;
    }

    const checkoutData = {
      items,
      ...(account?.profile
        ? { personalDataMode: 'SAVED' }
        : {
          personalDataMode: 'NEW',
          fullName: personalForm.fullName.trim(),
          email: personalForm.email.trim(),
          cpf: personalForm.cpf,
          saveProfile: true,
        }),
    };

    if (addressMode === 'saved') {
      checkoutData.addressId = Number(selectedAddressId);
    } else {
      const address = addressPayload(newAddress);
      Object.assign(checkoutData, {
        addressLabel: address.label,
        postalCode: address.postalCode,
        state: address.state,
        city: address.city,
        neighborhood: address.neighborhood,
        street: address.street,
        addressNumber: address.addressNumber,
        complement: address.complement,
        saveAddress: saveNewAddress,
        makeDefaultAddress: saveNewAddress && address.isDefault,
      });
    }

    submissionInProgressRef.current = true;
    setIsSubmitting(true);
    try {
      const checkout = await createPaymentCheckout(checkoutData, attempt.idempotencyKey);
      if (!rememberPendingCheckout(checkout.orderId, attempt.items, attempt.idempotencyKey)) {
        throw new Error('O pedido foi criado, mas não foi possível guardar sua referência. Mantenha esta janela aberta e tente novamente.');
      }
      // Redirect to WhatsApp. If the browser blocks the navigation (pop-up blocker, etc.)
      // show a fallback with the link so the customer can still complete the purchase.
      try {
        window.location.assign(checkout.whatsappUrl);
      } catch {
        setWhatsappFallback({ orderId: checkout.orderId, whatsappUrl: checkout.whatsappUrl });
        setIsSubmitting(false);
        submissionInProgressRef.current = false;
      }
    } catch (requestError) {
      if (isAuthenticationError(requestError)) {
        onAuthenticationRequired?.(latestDraftRef.current);
        return;
      }
      const attemptMustRotate = isDefinitiveAttemptConflict(requestError);
      if (attemptMustRotate) discardCheckoutAttempt(attempt.idempotencyKey);
      const message = requestError.message || 'Não foi possível registrar seu pedido.';
      setError(attemptMustRotate ? `${message} Clique novamente para iniciar uma nova tentativa.` : message);
    } finally {
      submissionInProgressRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div data-modal-root="true" className="checkout-overlay fixed inset-0 z-[80] overflow-y-auto p-4">
      <div ref={dialogRef} tabIndex="-1" aria-busy={isLoadingAccount || isSubmitting} role="dialog" aria-modal="true" aria-labelledby="checkout-title" aria-describedby="checkout-description" className="checkout-dialog mx-auto my-4 w-full max-w-5xl rounded-3xl p-5 shadow-2xl sm:my-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Finalizar compra</p>
            <h2 id="checkout-title" className="mt-1 text-2xl font-black text-[var(--text)]">Seus dados e entrega</h2>
            <p id="checkout-description" className="mt-1 text-sm text-[var(--muted)]">Use o que já está salvo ou cadastre uma nova entrega.</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={handleClose} disabled={isSubmitting} className="close-checkout text-2xl disabled:cursor-wait disabled:opacity-40" aria-label="Fechar checkout">×</button>
        </div>

        <form onSubmit={handleSubmit} aria-busy={isSubmitting} className="checkout-layout mt-7">
          <div className="checkout-fields space-y-6">
            {isLoadingAccount ? (
              <div className="checkout-account-loading" aria-live="polite"><span />Preparando seus dados salvos...</div>
            ) : accountLoadError ? (
              <div className="checkout-account-loading checkout-load-error" role="group" aria-labelledby="checkout-load-error-title">
                <div>
                  <strong id="checkout-load-error-title">Não foi possível carregar sua conta</strong>
                  <p role="alert">{accountLoadError}</p>
                  <button type="button" onClick={() => setAccountLoadAttempt((current) => current + 1)}>Tentar novamente</button>
                </div>
              </div>
            ) : (
              <>
                <fieldset disabled={isSubmitting} className="checkout-data-section">
                  <legend className="sr-only">Dados pessoais</legend>
                  <div className="checkout-section-heading">
                    <p className="checkout-legend">1 · Dados pessoais</p>
                    {account?.profile && <span className="account-saved-badge">✓ Salvos na conta</span>}
                  </div>
                  {account?.profile ? (
                    <div className="checkout-saved-profile mt-4">
                      <span className="checkout-profile-avatar" aria-hidden="true">{account.profile.fullName?.charAt(0)?.toUpperCase()}</span>
                      <div><strong>{account.profile.fullName}</strong><p>{account.profile.email}</p><small>CPF {account.profile.cpfMasked}</small></div>
                      {onManageAccount && <button type="button" onClick={onManageAccount}>Alterar</button>}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <p className="checkout-first-use-note">Preencha uma vez. Vamos salvar estes dados na sua conta para as próximas compras.</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field label="Nome completo" className="sm:col-span-2"><input ref={fullNameRef} value={personalForm.fullName} onChange={(event) => setPersonalForm((current) => ({ ...current, fullName: event.target.value }))} minLength="5" maxLength="160" autoComplete="name" required className="checkout-input mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none" /></Field>
                        <Field label="E-mail"><input type="email" value={personalForm.email} onChange={(event) => setPersonalForm((current) => ({ ...current, email: event.target.value }))} maxLength="254" autoComplete="email" required className="checkout-input mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none" /></Field>
                        <Field label="CPF"><input value={personalForm.cpf} onChange={(event) => setPersonalForm((current) => ({ ...current, cpf: formatCpf(event.target.value) }))} inputMode="numeric" maxLength="14" placeholder="000.000.000-00" required className="checkout-input mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none" /></Field>
                      </div>
                    </div>
                  )}
                </fieldset>

                <fieldset disabled={isSubmitting} className="checkout-data-section">
                  <legend className="checkout-legend">2 · Endereço de entrega</legend>
                  <div className="checkout-address-choices mt-4">
                    {account?.addresses?.map((address) => (
                      <label key={address.id} className={`checkout-address-choice ${addressMode === 'saved' && selectedAddressId === String(address.id) ? 'is-selected' : ''}`}>
                        <input type="radio" name="delivery-address" checked={addressMode === 'saved' && selectedAddressId === String(address.id)} onChange={() => { setAddressMode('saved'); setSelectedAddressId(String(address.id)); }} />
                        <span className="checkout-choice-check" aria-hidden="true" />
                        <span><strong>{address.label}{address.isDefault && <i>Principal</i>}</strong><small>{address.street}, {address.addressNumber}{address.complement ? ` · ${address.complement}` : ''}</small><small>{address.city}/{address.state} · {formatCep(address.postalCode)}</small></span>
                      </label>
                    ))}
                    <label className={`checkout-address-choice is-new ${addressMode === 'new' ? 'is-selected' : ''}`}>
                      <input type="radio" name="delivery-address" checked={addressMode === 'new'} onChange={() => setAddressMode('new')} />
                      <span className="checkout-choice-check" aria-hidden="true" />
                      <span><strong>+ Adicionar novo endereço</strong><small>Use apenas nesta compra ou salve na sua conta.</small></span>
                    </label>
                  </div>
                  {addressMode === 'new' && (
                    <div className="checkout-new-address mt-5">
                      <CustomerAddressFields value={newAddress} onChange={setNewAddress} requireLabel={saveNewAddress} disabled={isSubmitting} showDefaultToggle={false} />
                      <label className={`checkout-save-address mt-4 ${savedAddressLimitReached ? 'is-disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={saveNewAddress}
                          disabled={savedAddressLimitReached}
                          onChange={(event) => setSaveNewAddress(event.target.checked)}
                        />
                        <span>
                          <strong>Salvar na minha conta</strong>
                          <small>{savedAddressLimitReached ? 'Você já atingiu o limite de 10 endereços. Este será usado somente nesta compra.' : 'Desmarque para usar este endereço somente nesta compra.'}</small>
                        </span>
                      </label>
                      {saveNewAddress && (
                        <label className="account-default-toggle mt-4 flex cursor-pointer items-center gap-3 text-sm text-[var(--text)]">
                          <input type="checkbox" checked={newAddress.isDefault} onChange={(event) => setNewAddress((current) => ({ ...current, isDefault: event.target.checked }))} />
                          Usar como meu endereço principal
                        </label>
                      )}
                    </div>
                  )}
                </fieldset>
              </>
            )}
          </div>

          <aside className="checkout-summary">
            <div><p className="checkout-legend">Sua seleção</p><p className="mt-2 text-sm text-[var(--muted)]">{cartItems.reduce((sum, item) => sum + item.quantity, 0)} itens preparados para você.</p></div>
            <div className="checkout-items">{cartItems.map((item) => <div className="checkout-item" key={item.id}><img src={item.imageUrl} alt="" loading="lazy" decoding="async" /><div><strong>{item.name}</strong><small>{item.quantity}× · R$ {Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small></div></div>)}</div>
            <div className="checkout-total flex items-center justify-between rounded-2xl p-4 text-sm"><span className="text-[var(--muted)]">Total do pedido</span><strong className="text-lg text-[var(--text)]">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
            {whatsappFallback && (
              <div role="alert" className="checkout-whatsapp-fallback rounded-2xl p-4 text-sm" style={{background:'var(--surface-elevated)',border:'1px solid var(--border)'}}>
                <p className="font-semibold text-[var(--text)]">Pedido #{whatsappFallback.orderId} criado com sucesso!</p>
                <p className="mt-1 text-[var(--muted)]">O redirecionamento automático foi bloqueado. Clique no botão abaixo para abrir o WhatsApp.</p>
                <a href={whatsappFallback.whatsappUrl} target="_blank" rel="noopener noreferrer" className="admin-primary mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold no-underline">Abrir WhatsApp para combinar o pagamento</a>
              </div>
            )}
            {error && <p role="alert" aria-live="polite" className="text-sm text-rose-500">{error}</p>}
            <button disabled={isSubmitting || isLoadingAccount || Boolean(accountLoadError)} className="admin-primary w-full cursor-pointer rounded-xl py-3 font-semibold disabled:cursor-wait disabled:opacity-60">
              {isSubmitting ? 'Criando pedido...' : isLoadingAccount ? 'Carregando seus dados...' : accountLoadError ? 'Recarregue os dados da conta' : (
                <span className="flex items-center justify-center gap-2"><span aria-hidden="true">💬</span> Finalizar pelo WhatsApp</span>
              )}
            </button>
            <p className="checkout-security"><span aria-hidden="true">✓</span> Pedido registrado com segurança. Combine o pagamento diretamente pelo WhatsApp.</p>
          </aside>
        </form>
      </div>
    </div>
  );
}

function Field({ label, className = '', children }) {
  return <label className={`block text-sm font-medium text-[var(--text)] ${className}`}>{label}{children}</label>;
}
