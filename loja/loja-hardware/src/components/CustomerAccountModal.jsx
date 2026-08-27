import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerAccount,
  fetchCustomerOrders,
  saveCustomerProfile,
  updateCustomerAddress,
} from '../services/api';
import { paymentMethodLabel, paymentStatusMeta } from '../services/paymentStatus';
import CustomerAddressFields from './CustomerAddressFields';
import { addressPayload, addressToForm, EMPTY_CUSTOMER_ADDRESS, formatCpf, onlyDigits } from '../utils/customerAddress';
import useModalAccessibility from '../hooks/useModalAccessibility';
import '../styles/customer-account-orders.css';

const EMPTY_PROFILE = { fullName: '', email: '', cpf: '' };
const MAX_SAVED_ADDRESSES = 10;
const ACCOUNT_SECTION_IDS = ['profile', 'addresses', 'orders'];
const ACCOUNT_SECTIONS = new Set(ACCOUNT_SECTION_IDS);
const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function normalizeAccountSection(section) {
  return ACCOUNT_SECTIONS.has(section) ? section : 'profile';
}

function isAuthenticationError(error) {
  return error?.status === 401 || error?.status === 403;
}

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

export default function CustomerAccountModal({
  isOpen,
  onClose,
  onAuthenticationRequired,
  onAccountChanged,
  initialDraft = null,
  onDraftChange,
  onLogout,
}) {
  const initialDraftRef = useRef(initialDraft);
  const [activeSection, setActiveSection] = useState(() => normalizeAccountSection(initialDraft?.activeSection));
  const [account, setAccount] = useState(null);
  const [profileForm, setProfileForm] = useState(() => initialDraft?.profileForm || EMPTY_PROFILE);
  const [addressForm, setAddressForm] = useState(() => initialDraft?.addressForm ? addressToForm(initialDraft.addressForm) : null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersStatus, setOrdersStatus] = useState('idle');
  const [ordersError, setOrdersError] = useState('');
  const [ordersLoadAttempt, setOrdersLoadAttempt] = useState(0);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [success, setSuccess] = useState('');
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const sectionButtonRefs = useRef([]);
  const latestDraftRef = useRef(null);
  latestDraftRef.current = { activeSection, profileForm, addressForm };
  const isMutating = isSaving || isLoggingOut || deletingAddressId !== null;

  useEffect(() => {
    if (!isOpen) return;
    onDraftChange?.(latestDraftRef.current);
  }, [activeSection, addressForm, isOpen, onDraftChange, profileForm]);

  const applyAccount = useCallback((nextAccount) => {
    const normalized = {
      username: nextAccount?.username || '',
      profile: nextAccount?.profile || null,
      addresses: Array.isArray(nextAccount?.addresses) ? nextAccount.addresses : [],
    };
    setAccount(normalized);
    setProfileForm({
      fullName: normalized.profile?.fullName || '',
      email: normalized.profile?.email || '',
      cpf: '',
    });
    onAccountChanged?.(normalized);
    return normalized;
  }, [onAccountChanged]);

  const loadAccount = useCallback(async (signal) => {
    setIsLoading(true);
    setAccount(null);
    setLoadError('');
    setError('');
    try {
      const normalized = applyAccount(await fetchCustomerAccount({ signal }));
      const restoredDraft = initialDraftRef.current;
      if (restoredDraft) {
        setActiveSection(normalizeAccountSection(restoredDraft.activeSection));
        setProfileForm({
          fullName: restoredDraft.profileForm?.fullName ?? normalized.profile?.fullName ?? '',
          email: restoredDraft.profileForm?.email ?? normalized.profile?.email ?? '',
          cpf: restoredDraft.profileForm?.cpf || '',
        });
        const restoredAddress = restoredDraft.addressForm;
        const addressStillExists = !restoredAddress?.id
          || normalized.addresses.some((address) => String(address.id) === String(restoredAddress.id));
        setAddressForm(restoredAddress && addressStillExists ? addressToForm(restoredAddress) : null);
        initialDraftRef.current = null;
      }
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return;
      if (isAuthenticationError(requestError)) {
        onAuthenticationRequired?.(latestDraftRef.current);
        return;
      }
      setLoadError(requestError.message || 'Não foi possível carregar sua conta.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [applyAccount, onAuthenticationRequired]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const restoredDraft = initialDraftRef.current;
    setActiveSection(normalizeAccountSection(restoredDraft?.activeSection));
    setAddressForm(restoredDraft?.addressForm ? addressToForm(restoredDraft.addressForm) : null);
    setOrders([]);
    setOrdersStatus('idle');
    setOrdersError('');
    setSuccess('');
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    loadAccount(controller.signal);
    return () => {
      controller.abort();
    };
  }, [isOpen, loadAccount, loadAttempt]);

  useEffect(() => {
    if (!isOpen || isLoading || loadError || activeSection !== 'orders') return undefined;

    const controller = new AbortController();
    setOrdersStatus('loading');
    setOrdersError('');

    fetchCustomerOrders({ signal: controller.signal })
      .then((response) => {
        if (!Array.isArray(response)) {
          throw new Error('O histórico de pedidos retornou um formato inesperado.');
        }
        setOrders(response);
        setOrdersStatus('success');
      })
      .catch((requestError) => {
        if (requestError?.name === 'AbortError') return;
        if (isAuthenticationError(requestError)) {
          setOrdersStatus('idle');
          onAuthenticationRequired?.(latestDraftRef.current);
          return;
        }
        setOrdersError(requestError.message || 'Não foi possível carregar seus pedidos.');
        setOrdersStatus('error');
      });

    return () => controller.abort();
  }, [activeSection, isLoading, isOpen, loadError, onAuthenticationRequired, ordersLoadAttempt]);

  useModalAccessibility({
    isOpen,
    dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
    canClose: !isMutating,
  });

  if (!isOpen) return null;

  const changeSection = (section) => {
    setActiveSection(normalizeAccountSection(section));
    setAddressForm(null);
    setError('');
    setSuccess('');
  };

  const handleSectionKeyDown = (event, sectionIndex) => {
    let nextIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (sectionIndex + 1) % ACCOUNT_SECTION_IDS.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (sectionIndex - 1 + ACCOUNT_SECTION_IDS.length) % ACCOUNT_SECTION_IDS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = ACCOUNT_SECTION_IDS.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    changeSection(ACCOUNT_SECTION_IDS[nextIndex]);
    sectionButtonRefs.current[nextIndex]?.focus();
  };

  const handleLogout = async () => {
    if (!onLogout || isLoggingOut) return;
    setError('');
    setSuccess('');
    setIsLoggingOut(true);
    try {
      await onLogout();
    } catch (requestError) {
      setError(requestError?.message || 'Não foi possível sair da conta. Tente novamente.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const nextCpf = profileForm.cpf.trim();
    if (!account?.profile && !isValidCpf(nextCpf)) {
      setError('Informe um CPF válido para salvar seus dados.');
      return;
    }
    if (nextCpf && !isValidCpf(nextCpf)) {
      setError('O novo CPF informado não é válido.');
      return;
    }
    setIsSaving(true);
    try {
      const savedProfile = await saveCustomerProfile({
        fullName: profileForm.fullName.trim(),
        email: profileForm.email.trim(),
        ...(nextCpf ? { cpf: nextCpf } : {}),
      });
      const nextAccount = applyAccount({ ...account, profile: savedProfile });
      setProfileForm({ fullName: nextAccount.profile.fullName, email: nextAccount.profile.email, cpf: '' });
      setSuccess('Dados pessoais salvos. Nas próximas compras, eles já estarão prontos.');
    } catch (requestError) {
      if (isAuthenticationError(requestError)) return onAuthenticationRequired?.(latestDraftRef.current);
      setError(requestError.message || 'Não foi possível salvar seus dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const startNewAddress = () => {
    if ((account?.addresses?.length || 0) >= MAX_SAVED_ADDRESSES) {
      setError('Você já atingiu o limite de 10 endereços salvos. Remova um endereço para cadastrar outro.');
      setSuccess('');
      return;
    }
    setAddressForm(addressToForm({ ...EMPTY_CUSTOMER_ADDRESS, isDefault: !account?.addresses?.length }));
    setError('');
    setSuccess('');
  };

  const handleAddressSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);
    try {
      const payload = addressPayload(addressForm);
      const saved = addressForm.id
        ? await updateCustomerAddress(addressForm.id, payload)
        : await createCustomerAddress(payload);
      const previousAddresses = account?.addresses || [];
      let addresses = addressForm.id
        ? previousAddresses.map((address) => address.id === saved.id ? saved : address)
        : [...previousAddresses, saved];
      if (saved.isDefault) addresses = addresses.map((address) => ({ ...address, isDefault: address.id === saved.id }));
      applyAccount({ ...account, addresses });
      setAddressForm(null);
      setSuccess(addressForm.id ? 'Endereço atualizado.' : 'Novo endereço salvo na sua conta.');
    } catch (requestError) {
      if (isAuthenticationError(requestError)) return onAuthenticationRequired?.(latestDraftRef.current);
      setError(requestError.message || 'Não foi possível salvar o endereço.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAddress = async (address) => {
    if (!window.confirm(`Remover o endereço “${address.label}”?`)) return;
    setDeletingAddressId(address.id);
    setError('');
    setSuccess('');
    try {
      await deleteCustomerAddress(address.id);
      applyAccount(await fetchCustomerAccount());
      setSuccess('Endereço removido da sua conta.');
    } catch (requestError) {
      if (isAuthenticationError(requestError)) return onAuthenticationRequired?.(latestDraftRef.current);
      setError(requestError.message || 'Não foi possível remover o endereço.');
    } finally {
      setDeletingAddressId(null);
    }
  };

  return (
    <div data-modal-root="true" onMouseDown={(event) => { if (event.target === event.currentTarget && !isMutating) onClose(); }} className="customer-overlay fixed inset-0 z-[75] overflow-y-auto p-4 sm:p-6">
      <section ref={dialogRef} tabIndex="-1" aria-busy={isLoading || isMutating || (activeSection === 'orders' && ordersStatus === 'loading')} role="dialog" aria-modal="true" aria-labelledby="customer-account-title" className="customer-account-card mx-auto my-2 w-full max-w-5xl overflow-hidden rounded-[1.75rem] shadow-2xl sm:my-6">
        <header className="account-header flex items-start justify-between gap-5 p-5 sm:p-7">
          <div>
            <p className="section-kicker">Minha conta</p>
            <h2 id="customer-account-title" className="mt-1 text-2xl font-black text-[var(--text)] sm:text-3xl">Seus dados, sempre à mão.</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Cadastre uma vez e compre novamente sem preencher tudo de novo.</p>
          </div>
          <div className="customer-account-header-actions">
            {onLogout && (
              <button type="button" onClick={handleLogout} disabled={isMutating} className="customer-account-logout disabled:cursor-wait disabled:opacity-50">
                {isLoggingOut ? 'Saindo…' : 'Sair da conta'}
              </button>
            )}
            <button ref={closeButtonRef} type="button" onClick={onClose} disabled={isMutating} className="close-checkout shrink-0 text-2xl disabled:cursor-wait disabled:opacity-40" aria-label="Fechar minha conta">×</button>
          </div>
        </header>

        <div className="account-layout">
          <nav className="account-sections" role="tablist" aria-label="Seções da conta">
            <button ref={(node) => { sectionButtonRefs.current[0] = node; }} id="customer-account-tab-profile" role="tab" type="button" disabled={isLoading || Boolean(loadError) || isMutating} onClick={() => changeSection('profile')} onKeyDown={(event) => handleSectionKeyDown(event, 0)} aria-controls="customer-account-content" aria-selected={activeSection === 'profile'} tabIndex={activeSection === 'profile' ? 0 : -1} className={activeSection === 'profile' ? 'is-active' : ''}>
              <span className="account-section-icon" aria-hidden="true">☺</span>
              <span><strong>Dados pessoais</strong><small>{account?.profile ? 'Cadastro completo' : 'Complete seu cadastro'}</small></span>
              <i aria-hidden="true">→</i>
            </button>
            <button ref={(node) => { sectionButtonRefs.current[1] = node; }} id="customer-account-tab-addresses" role="tab" type="button" disabled={isLoading || Boolean(loadError) || isMutating} onClick={() => changeSection('addresses')} onKeyDown={(event) => handleSectionKeyDown(event, 1)} aria-controls="customer-account-content" aria-selected={activeSection === 'addresses'} tabIndex={activeSection === 'addresses' ? 0 : -1} className={activeSection === 'addresses' ? 'is-active' : ''}>
              <span className="account-section-icon" aria-hidden="true">⌂</span>
              <span><strong>Endereços</strong><small>{account?.addresses?.length || 0} {account?.addresses?.length === 1 ? 'cadastrado' : 'cadastrados'}</small></span>
              <i aria-hidden="true">→</i>
            </button>
            <button ref={(node) => { sectionButtonRefs.current[2] = node; }} id="customer-account-tab-orders" role="tab" type="button" disabled={isLoading || Boolean(loadError) || isMutating} onClick={() => changeSection('orders')} onKeyDown={(event) => handleSectionKeyDown(event, 2)} aria-controls="customer-account-content" aria-selected={activeSection === 'orders'} tabIndex={activeSection === 'orders' ? 0 : -1} className={activeSection === 'orders' ? 'is-active' : ''}>
              <span className="account-section-icon" aria-hidden="true">▤</span>
              <span>
                <strong>Pedidos</strong>
                <small>{ordersStatus === 'success' ? `${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}` : 'Histórico de compras'}</small>
              </span>
              <i aria-hidden="true">→</i>
            </button>
          </nav>

          <div id="customer-account-content" role="tabpanel" aria-labelledby={`customer-account-tab-${activeSection}`} className="account-content p-5 sm:p-7">
            {isLoading ? (
              <div className="account-loading" aria-live="polite"><span />Carregando seus dados...</div>
            ) : loadError ? (
              <div className="account-empty" role="group" aria-labelledby="account-load-error-title">
                <span aria-hidden="true">!</span>
                <h3 id="account-load-error-title">Não foi possível abrir sua conta</h3>
                <p role="alert">{loadError}</p>
                <button type="button" onClick={() => setLoadAttempt((current) => current + 1)}>Tentar novamente</button>
              </div>
            ) : activeSection === 'orders' ? (
              <OrdersPanel
                orders={orders}
                status={ordersStatus}
                error={ordersError}
                onRetry={() => setOrdersLoadAttempt((current) => current + 1)}
              />
            ) : activeSection === 'profile' ? (
              <form onSubmit={handleProfileSubmit} aria-busy={isSaving}>
                <div className="account-content-heading">
                  <div><p className="checkout-legend">Dados pessoais</p><h3>Identificação da compra</h3></div>
                  {account?.profile && <span className="account-saved-badge">✓ Salvo</span>}
                </div>
                <p className="account-helper">Esses dados ficam vinculados à sua conta e são usados somente para pedidos e notas da loja.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="Nome completo" className="sm:col-span-2">
                    <input disabled={isSaving} value={profileForm.fullName} onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))} minLength="5" maxLength="160" autoComplete="name" required className="customer-input mt-2 w-full rounded-xl px-3.5 py-3 outline-none disabled:cursor-wait disabled:opacity-60" />
                  </Field>
                  <Field label="E-mail">
                    <input type="email" disabled={isSaving} value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} maxLength="254" autoComplete="email" required className="customer-input mt-2 w-full rounded-xl px-3.5 py-3 outline-none disabled:cursor-wait disabled:opacity-60" />
                  </Field>
                  <Field label={account?.profile ? 'CPF (opcional para alterar)' : 'CPF'}>
                    <input disabled={isSaving} value={profileForm.cpf} onChange={(event) => setProfileForm((current) => ({ ...current, cpf: formatCpf(event.target.value) }))} inputMode="numeric" maxLength="14" placeholder={account?.profile?.cpfMasked || '000.000.000-00'} required={!account?.profile} className="customer-input mt-2 w-full rounded-xl px-3.5 py-3 outline-none disabled:cursor-wait disabled:opacity-60" />
                    {account?.profile?.cpfMasked && <small className="mt-2 block text-xs text-[var(--muted)]">CPF atual: {account.profile.cpfMasked}. Deixe vazio para manter.</small>}
                  </Field>
                </div>
                <button disabled={isSaving} className="customer-submit mt-7 w-full rounded-xl py-3.5 font-semibold disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:px-8">{isSaving ? 'Salvando...' : account?.profile ? 'Salvar alterações' : 'Salvar dados pessoais'}</button>
              </form>
            ) : addressForm ? (
              <form onSubmit={handleAddressSubmit} aria-busy={isSaving}>
                <div className="account-content-heading">
                  <div><p className="checkout-legend">Endereços</p><h3>{addressForm.id ? 'Editar endereço' : 'Adicionar novo endereço'}</h3></div>
                  <button type="button" disabled={isSaving} onClick={() => setAddressForm(null)} className="account-text-action disabled:cursor-wait disabled:opacity-60">Voltar</button>
                </div>
                <p className="account-helper">Dê um nome fácil de reconhecer para selecionar este endereço rapidamente no checkout.</p>
                <div className="mt-6">
                  <CustomerAddressFields value={addressForm} onChange={setAddressForm} disabled={isSaving} defaultLocked={Boolean(addressForm.id && addressForm.isDefault)} inputClass="customer-input mt-2 w-full rounded-xl px-3.5 py-3 outline-none disabled:cursor-wait disabled:opacity-60" />
                </div>
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setAddressForm(null)} disabled={isSaving} className="account-secondary-action">Cancelar</button>
                  <button disabled={isSaving} className="customer-submit rounded-xl px-7 py-3 font-semibold disabled:cursor-wait disabled:opacity-60">{isSaving ? 'Salvando...' : 'Salvar endereço'}</button>
                </div>
              </form>
            ) : (
              <section>
                <div className="account-content-heading">
                  <div><p className="checkout-legend">Endereços</p><h3>Locais de entrega</h3></div>
                  <button
                    type="button"
                    onClick={startNewAddress}
                    disabled={isMutating || (account?.addresses?.length || 0) >= MAX_SAVED_ADDRESSES}
                    title={(account?.addresses?.length || 0) >= MAX_SAVED_ADDRESSES ? 'Limite de 10 endereços atingido' : undefined}
                    className="customer-submit rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >+ Novo endereço</button>
                </div>
                <p className="account-helper">Escolha um endereço salvo no checkout. Você pode manter até 10 endereços na sua conta.</p>
                {(account?.addresses?.length || 0) >= MAX_SAVED_ADDRESSES && <p className="account-limit-note" role="status">Limite atingido: remova um endereço antes de cadastrar outro.</p>}
                {account?.addresses?.length ? (
                  <div className="account-address-list mt-6">
                    {account.addresses.map((address) => (
                      <article key={address.id} className={`account-address-card ${address.isDefault ? 'is-default' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div><strong>{address.label}</strong>{address.isDefault && <span>Principal</span>}</div>
                          <span className="account-address-pin" aria-hidden="true">◇</span>
                        </div>
                        <p>{address.street}, {address.addressNumber}{address.complement ? ` · ${address.complement}` : ''}</p>
                        <small>{address.neighborhood} · {address.city}/{address.state} · CEP {formatPostalCode(address.postalCode)}</small>
                        <div className="account-address-actions">
                          <button type="button" disabled={isMutating} onClick={() => setAddressForm(addressToForm(address))}>Editar</button>
                          <button type="button" onClick={() => handleDeleteAddress(address)} disabled={isMutating}>{deletingAddressId === address.id ? 'Removendo...' : 'Remover'}</button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="account-empty mt-6">
                    <span aria-hidden="true">⌂</span>
                    <h4>Nenhum endereço salvo</h4>
                    <p>Cadastre sua primeira entrega e ela aparecerá pronta na próxima compra.</p>
                    <button type="button" onClick={startNewAddress}>Cadastrar primeiro endereço</button>
                  </div>
                )}
              </section>
            )}
            {error && <p role="alert" aria-live="assertive" className="account-feedback is-error">{error}</p>}
            {success && <p role="status" aria-live="polite" className="account-feedback is-success">{success}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function OrdersPanel({ orders, status, error, onRetry }) {
  const isLoading = status === 'idle' || status === 'loading';

  return (
    <section className="customer-order-history" aria-labelledby="customer-orders-title">
      <div className="account-content-heading">
        <div>
          <p className="checkout-legend">Pedidos</p>
          <h3 id="customer-orders-title">Histórico da sua conta</h3>
        </div>
        {status === 'success' && orders.length > 0 && (
          <span className="customer-order-count">{orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}</span>
        )}
      </div>
      <p className="account-helper">Aqui aparecem somente os pedidos registrados nesta conta, com o status informado pelo pagamento.</p>

      {isLoading ? (
        <div className="account-loading customer-orders-loading" role="status" aria-live="polite">
          <span aria-hidden="true" />
          Carregando seus pedidos…
        </div>
      ) : status === 'error' ? (
        <div className="account-empty customer-orders-empty" role="alert">
          <span aria-hidden="true">!</span>
          <h4>Não foi possível carregar seus pedidos</h4>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>Tentar novamente</button>
        </div>
      ) : orders.length === 0 ? (
        <div className="account-empty customer-orders-empty" role="status">
          <span aria-hidden="true">▤</span>
          <h4>Nenhum pedido encontrado</h4>
          <p>Quando uma compra for registrada nesta conta, ela aparecerá aqui.</p>
        </div>
      ) : (
        <ol className="customer-orders-list" aria-live="polite">
          {orders.map((order, index) => (
            <li key={order?.id ?? `order-${index}`}>
              <OrderHistoryCard order={order || {}} index={index} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function OrderHistoryCard({ order, index }) {
  const status = paymentStatusMeta(order.status);
  const items = Array.isArray(order.items) ? order.items : [];
  const dateTime = validDateTime(order.createdAt);
  const headingId = `customer-order-${String(order.id ?? index).replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  return (
    <article className="customer-order-card" aria-labelledby={headingId}>
      <header className="customer-order-card-header">
        <div>
          <p className="customer-order-number">Pedido</p>
          <h4 id={headingId}>#{order.id ?? 'número indisponível'}</h4>
          {dateTime ? (
            <time dateTime={dateTime.toISOString()}>{DATE_FORMATTER.format(dateTime)}</time>
          ) : (
            <span className="customer-order-date">Data indisponível</span>
          )}
        </div>
        <div className="customer-order-summary">
          <span className={`customer-order-status is-${status.tone}`}>{status.label}</span>
          <strong>{formatCurrency(order.total)}</strong>
        </div>
      </header>

      <dl className="customer-order-facts">
        <div><dt>Pagamento</dt><dd>{paymentMethodLabel(order.paymentMethod)}</dd></div>
        <div><dt>E-mail protegido</dt><dd>{maskEmail(order.email)}</dd></div>
        <div><dt>CPF protegido</dt><dd>{maskCpf(order.cpf)}</dd></div>
        <div><dt>Entrega</dt><dd>{maskedDelivery(order)}</dd></div>
      </dl>

      <section className="customer-order-items" aria-labelledby={`${headingId}-items`}>
        <div className="customer-order-items-heading">
          <h5 id={`${headingId}-items`}>Itens do pedido</h5>
          <span>{formatItemCount(items)}</span>
        </div>
        {items.length > 0 ? (
          <ul>
            {items.map((item, itemIndex) => (
              <li key={`${item?.productId ?? 'item'}-${itemIndex}`}>
                <div>
                  <strong>{item?.productName || 'Nome do produto indisponível'}</strong>
                  <small>{formatItemDetails(item)}</small>
                </div>
                <span>{formatCurrency(item?.unitPrice)} cada</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="customer-order-items-unavailable">Os itens não estão disponíveis neste registro.</p>
        )}
      </section>
    </article>
  );
}

function Field({ label, className = '', children }) {
  return <label className={`customer-label block text-sm ${className}`}>{label}{children}</label>;
}

function validDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return 'Valor indisponível';
  const amount = Number(value);
  return Number.isFinite(amount) ? CURRENCY_FORMATTER.format(amount) : 'Valor indisponível';
}

function maskEmail(value) {
  const email = String(value || '').trim();
  const separator = email.lastIndexOf('@');
  if (separator < 1 || separator === email.length - 1) return 'Não informado';
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function maskCpf(value) {
  const suffix = String(value || '').match(/(\d{2})\D*$/)?.[1];
  return `***.***.***-${suffix || '**'}`;
}

function maskPostalCode(value) {
  const digits = onlyDigits(value);
  return digits.length === 8 ? `*****-${digits.slice(-3)}` : '';
}

function maskedDelivery(order) {
  const city = String(order?.city || '').trim();
  const state = String(order?.state || '').trim().toUpperCase();
  const location = city && state ? `${city}/${state}` : city || state;
  const postalCode = maskPostalCode(order?.postalCode);
  return [location, postalCode ? `CEP ${postalCode}` : ''].filter(Boolean).join(' · ') || 'Dados protegidos';
}

function formatItemCount(items) {
  const count = items.reduce((total, item) => {
    const quantity = Number(item?.quantity);
    return total + (Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
  if (count === 0) return `${items.length} ${items.length === 1 ? 'item registrado' : 'itens registrados'}`;
  return `${count} ${count === 1 ? 'item' : 'itens'}`;
}

function formatItemDetails(item) {
  const quantity = Number(item?.quantity);
  const details = [
    Number.isSafeInteger(quantity) && quantity > 0 ? `Quantidade: ${quantity}` : 'Quantidade não informada',
    item?.shoeSize ? `Tamanho: ${item.shoeSize}` : '',
    item?.colorVariant ? `Cor: ${item.colorVariant}` : '',
  ];
  return details.filter(Boolean).join(' · ');
}

function formatPostalCode(value) {
  const digits = onlyDigits(value);
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value;
}
