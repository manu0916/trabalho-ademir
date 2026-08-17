import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerAccount,
  saveCustomerProfile,
  updateCustomerAddress,
} from '../services/api';
import CustomerAddressFields from './CustomerAddressFields';
import { addressPayload, addressToForm, EMPTY_CUSTOMER_ADDRESS, formatCpf, onlyDigits } from '../utils/customerAddress';
import useModalAccessibility from '../hooks/useModalAccessibility';

const EMPTY_PROFILE = { fullName: '', email: '', cpf: '' };
const MAX_SAVED_ADDRESSES = 10;

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
}) {
  const initialDraftRef = useRef(initialDraft);
  const [activeSection, setActiveSection] = useState(() => initialDraft?.activeSection === 'addresses' ? 'addresses' : 'profile');
  const [account, setAccount] = useState(null);
  const [profileForm, setProfileForm] = useState(() => initialDraft?.profileForm || EMPTY_PROFILE);
  const [addressForm, setAddressForm] = useState(() => initialDraft?.addressForm ? addressToForm(initialDraft.addressForm) : null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [success, setSuccess] = useState('');
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const latestDraftRef = useRef(null);
  latestDraftRef.current = { activeSection, profileForm, addressForm };
  const isMutating = isSaving || deletingAddressId !== null;

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
        setActiveSection(restoredDraft.activeSection === 'addresses' ? 'addresses' : 'profile');
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
    setActiveSection(restoredDraft?.activeSection === 'addresses' ? 'addresses' : 'profile');
    setAddressForm(restoredDraft?.addressForm ? addressToForm(restoredDraft.addressForm) : null);
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

  useModalAccessibility({
    isOpen,
    dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
    canClose: !isMutating,
  });

  if (!isOpen) return null;

  const changeSection = (section) => {
    setActiveSection(section);
    setAddressForm(null);
    setError('');
    setSuccess('');
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
      <section ref={dialogRef} tabIndex="-1" aria-busy={isLoading || isMutating} role="dialog" aria-modal="true" aria-labelledby="customer-account-title" className="customer-account-card mx-auto my-2 w-full max-w-5xl overflow-hidden rounded-[1.75rem] shadow-2xl sm:my-6">
        <header className="account-header flex items-start justify-between gap-5 p-5 sm:p-7">
          <div>
            <p className="section-kicker">Minha conta</p>
            <h2 id="customer-account-title" className="mt-1 text-2xl font-black text-[var(--text)] sm:text-3xl">Seus dados, sempre à mão.</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Cadastre uma vez e compre novamente sem preencher tudo de novo.</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} disabled={isMutating} className="close-checkout shrink-0 text-2xl disabled:cursor-wait disabled:opacity-40" aria-label="Fechar minha conta">×</button>
        </header>

        <div className="account-layout">
          <nav className="account-sections" aria-label="Seções da conta">
            <button type="button" disabled={isLoading || Boolean(loadError) || isMutating} onClick={() => changeSection('profile')} aria-current={activeSection === 'profile' ? 'page' : undefined} className={activeSection === 'profile' ? 'is-active' : ''}>
              <span className="account-section-icon" aria-hidden="true">☺</span>
              <span><strong>Dados pessoais</strong><small>{account?.profile ? 'Cadastro completo' : 'Complete seu cadastro'}</small></span>
              <i aria-hidden="true">→</i>
            </button>
            <button type="button" disabled={isLoading || Boolean(loadError) || isMutating} onClick={() => changeSection('addresses')} aria-current={activeSection === 'addresses' ? 'page' : undefined} className={activeSection === 'addresses' ? 'is-active' : ''}>
              <span className="account-section-icon" aria-hidden="true">⌂</span>
              <span><strong>Endereços</strong><small>{account?.addresses?.length || 0} {account?.addresses?.length === 1 ? 'cadastrado' : 'cadastrados'}</small></span>
              <i aria-hidden="true">→</i>
            </button>
          </nav>

          <div className="account-content p-5 sm:p-7">
            {isLoading ? (
              <div className="account-loading" aria-live="polite"><span />Carregando seus dados...</div>
            ) : loadError ? (
              <div className="account-empty" role="group" aria-labelledby="account-load-error-title">
                <span aria-hidden="true">!</span>
                <h3 id="account-load-error-title">Não foi possível abrir sua conta</h3>
                <p role="alert">{loadError}</p>
                <button type="button" onClick={() => setLoadAttempt((current) => current + 1)}>Tentar novamente</button>
              </div>
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

function Field({ label, className = '', children }) {
  return <label className={`customer-label block text-sm ${className}`}>{label}{children}</label>;
}

function formatPostalCode(value) {
  const digits = onlyDigits(value);
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value;
}
