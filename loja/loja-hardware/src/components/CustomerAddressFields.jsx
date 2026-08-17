import { useEffect, useRef, useState } from 'react';
import { formatCep, onlyDigits } from '../utils/customerAddress';

export default function CustomerAddressFields({
  value,
  onChange,
  inputClass = 'checkout-input mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none',
  requireLabel = true,
  disabled = false,
  showDefaultToggle = true,
  defaultLocked = false,
}) {
  const [cepMessage, setCepMessage] = useState('');
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);
  const lookupRef = useRef({ sequence: 0, controller: null });
  const addressEditVersionRef = useRef({ state: 0, city: 0, neighborhood: 0, street: 0 });

  useEffect(() => () => {
    lookupRef.current.sequence += 1;
    lookupRef.current.controller?.abort();
  }, []);

  const update = (field, fieldValue) => {
    if (Object.hasOwn(addressEditVersionRef.current, field)) {
      addressEditVersionRef.current[field] += 1;
    }
    onChange((current) => ({ ...current, [field]: fieldValue }));
  };

  const lookupCep = async (postalCode) => {
    lookupRef.current.controller?.abort();
    const sequence = lookupRef.current.sequence + 1;
    const controller = new AbortController();
    const editVersionsAtStart = { ...addressEditVersionRef.current };
    lookupRef.current = { sequence, controller };
    setIsLookingUpCep(true);
    setCepMessage('Buscando endereço...');

    try {
      const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`, { signal: controller.signal });
      const found = await response.json();
      if (controller.signal.aborted || lookupRef.current.sequence !== sequence) return;
      if (!response.ok || found.erro) throw new Error('CEP não encontrado. Preencha o endereço manualmente.');
      onChange((current) => {
        const next = { ...current, postalCode };
        const foundAddress = {
          street: found.logradouro || '',
          neighborhood: found.bairro || '',
          city: found.localidade || '',
          state: found.uf || '',
        };
        Object.entries(foundAddress).forEach(([field, fieldValue]) => {
          if (addressEditVersionRef.current[field] === editVersionsAtStart[field]) {
            next[field] = fieldValue;
          }
        });
        return next;
      });
      setCepMessage(found.logradouro ? 'Endereço preenchido. Confirme o número.' : 'CEP localizado. Complete rua e bairro.');
    } catch (error) {
      if (controller.signal.aborted || lookupRef.current.sequence !== sequence) return;
      setCepMessage(error.message || 'Não foi possível buscar o CEP.');
    } finally {
      if (lookupRef.current.sequence === sequence) {
        lookupRef.current.controller = null;
        setIsLookingUpCep(false);
      }
    }
  };

  const handleCepChange = (event) => {
    const postalCode = onlyDigits(event.target.value).slice(0, 8);
    lookupRef.current.sequence += 1;
    lookupRef.current.controller?.abort();
    lookupRef.current.controller = null;
    setIsLookingUpCep(false);
    setCepMessage('');
    onChange((current) => ({
      ...current,
      postalCode,
      state: '',
      city: '',
      neighborhood: '',
      street: '',
      addressNumber: '',
    }));
    if (postalCode.length === 8) lookupCep(postalCode);
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label={requireLabel ? 'Nome do endereço' : 'Nome do endereço (opcional)'} className="sm:col-span-3">
          <input disabled={disabled} value={value.label} onChange={(event) => update('label', event.target.value)} maxLength="40" placeholder={requireLabel ? 'Ex.: Casa ou Trabalho' : 'Ex.: Casa'} required={requireLabel} className={inputClass} />
        </Field>
        <Field label="CEP" className="sm:col-span-2">
          <div className="relative">
            <input disabled={disabled} value={formatCep(value.postalCode)} onChange={handleCepChange} inputMode="numeric" maxLength="9" autoComplete="postal-code" placeholder="00000-000" required className={inputClass} />
            {isLookingUpCep && <span className="cep-loader" aria-label="Buscando CEP" />}
          </div>
        </Field>
        <Field label="UF" className="sm:col-span-1">
          <input disabled={disabled} value={value.state} onChange={(event) => update('state', event.target.value.toUpperCase().slice(0, 2))} maxLength="2" autoComplete="address-level1" required className={inputClass} />
        </Field>
        <Field label="Município" className="sm:col-span-3">
          <input disabled={disabled} value={value.city} onChange={(event) => update('city', event.target.value)} maxLength="120" autoComplete="address-level2" required className={inputClass} />
        </Field>
        <Field label="Bairro" className="sm:col-span-3">
          <input disabled={disabled} value={value.neighborhood} onChange={(event) => update('neighborhood', event.target.value)} maxLength="160" autoComplete="address-level3" required className={inputClass} />
        </Field>
        <Field label="Rua" className="sm:col-span-4">
          <input disabled={disabled} value={value.street} onChange={(event) => update('street', event.target.value)} maxLength="180" autoComplete="address-line1" required className={inputClass} />
        </Field>
        <Field label="Número" className="sm:col-span-2">
          <input disabled={disabled} value={value.addressNumber} onChange={(event) => update('addressNumber', event.target.value)} maxLength="20" autoComplete="address-line2" required className={inputClass} />
        </Field>
        <Field label="Complemento (opcional)" className="sm:col-span-6">
          <input disabled={disabled} value={value.complement} onChange={(event) => update('complement', event.target.value)} maxLength="120" placeholder="Apartamento, bloco, ponto de referência..." className={inputClass} />
        </Field>
      </div>
      {showDefaultToggle && (
        <label className="account-default-toggle mt-4 flex cursor-pointer items-center gap-3 text-sm text-[var(--text)]">
          <input type="checkbox" checked={value.isDefault} disabled={disabled || defaultLocked} onChange={(event) => update('isDefault', event.target.checked)} />
          {defaultLocked ? 'Este é seu endereço principal' : 'Usar como meu endereço principal'}
        </label>
      )}
      {cepMessage && (
        <p aria-live="polite" className={`mt-3 text-xs ${cepMessage.startsWith('CEP não') || cepMessage.startsWith('Não foi') ? 'text-rose-500' : 'text-emerald-600'}`}>
          {cepMessage}
        </p>
      )}
    </>
  );
}

function Field({ label, className = '', children }) {
  return <label className={`block text-sm font-medium text-[var(--text)] ${className}`}>{label}{children}</label>;
}
