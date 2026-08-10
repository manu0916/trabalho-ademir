import { useMemo, useState } from 'react';
import { createPaymentCheckout } from '../services/api';

function isValidCpf(value) {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length) => { const total = cpf.slice(0, length).split('').reduce((sum, number, index) => sum + Number(number) * (length + 1 - index), 0); const result = (total * 10) % 11; return result === 10 ? 0 : result; };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}
const onlyDigits = (value) => value.replace(/\D/g, '');
const formatCep = (value) => value.length > 5 ? `${value.slice(0, 5)}-${value.slice(5)}` : value;

export default function CheckoutDialog({ isOpen, onClose, cartItems, onOrderCreated }) {
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [cpf, setCpf] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX'); const [postalCode, setPostalCode] = useState('');
  const [state, setState] = useState(''); const [city, setCity] = useState(''); const [neighborhood, setNeighborhood] = useState('');
  const [street, setStreet] = useState(''); const [addressNumber, setAddressNumber] = useState('');
  const [error, setError] = useState(''); const [cepMessage, setCepMessage] = useState(''); const [isLookingUpCep, setIsLookingUpCep] = useState(false); const [isSubmitting, setIsSubmitting] = useState(false);
  const total = useMemo(() => cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0), [cartItems]);

  if (!isOpen) return null;

  const lookupCep = async (rawCep) => {
    if (rawCep.length !== 8) return;
    setIsLookingUpCep(true); setCepMessage('Buscando endereço...');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      const address = await response.json();
      if (!response.ok || address.erro) throw new Error('CEP não encontrado. Preencha o endereço manualmente.');
      setStreet(address.logradouro || ''); setNeighborhood(address.bairro || ''); setCity(address.localidade || ''); setState(address.uf || '');
      setCepMessage(address.logradouro ? 'Endereço preenchido. Confirme o número.' : 'CEP localizado. Complete rua e bairro.');
    } catch (lookupError) { setCepMessage(lookupError.message || 'Não foi possível buscar o CEP.'); }
    finally { setIsLookingUpCep(false); }
  };
  const handleCepChange = (event) => { const nextCep = onlyDigits(event.target.value).slice(0, 8); setPostalCode(nextCep); setCepMessage(''); if (nextCep.length === 8) lookupCep(nextCep); };
  const handleSubmit = async (event) => {
    event.preventDefault(); setError('');
    if (!isValidCpf(cpf)) return setError('Informe um CPF válido.');
    if (postalCode.length !== 8 || !state || !city || !neighborhood || !street || !addressNumber) return setError('Preencha todos os dados de entrega.');
    setIsSubmitting(true);
    try {
      const checkout = await createPaymentCheckout({ fullName, email, cpf, paymentMethod, postalCode, state, city, neighborhood, street, addressNumber, items: cartItems.map((item) => ({ productId: item.id, quantity: item.quantity })) });
      onOrderCreated(); window.location.assign(checkout.checkoutUrl);
    } catch (requestError) { setError(requestError.message || 'Não foi possível registrar seu pedido.'); }
    finally { setIsSubmitting(false); }
  };
  const inputClass = 'checkout-input mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm outline-none';

  return <div className="checkout-overlay fixed inset-0 z-[80] overflow-y-auto p-4"><div className="checkout-dialog mx-auto my-6 w-full max-w-2xl rounded-3xl p-6 shadow-2xl sm:p-8">
    <div className="flex items-start justify-between gap-4"><div><p className="section-kicker">Finalizar compra</p><h2 className="mt-1 text-2xl font-black text-[var(--text)]">Entrega e pagamento</h2><p className="mt-1 text-sm text-[var(--muted)]">Precisamos destes dados para enviar seu pedido certinho.</p></div><button type="button" onClick={onClose} className="close-checkout text-2xl" aria-label="Fechar checkout">×</button></div>
    <form onSubmit={handleSubmit} className="mt-7 space-y-6">
      <fieldset><legend className="checkout-legend">Seus dados</legend><div className="mt-3 grid gap-4 sm:grid-cols-2"><Field label="Nome completo"><input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength="5" maxLength="160" autoComplete="name" required className={inputClass} /></Field><Field label="E-mail"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength="254" autoComplete="email" required className={inputClass} /></Field><Field label="CPF"><input value={cpf} onChange={(event) => setCpf(event.target.value)} inputMode="numeric" maxLength="14" placeholder="000.000.000-00" required className={inputClass} /></Field><Field label="Forma de pagamento"><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={inputClass}><option value="PIX">Pix</option><option value="CARTAO_CREDITO">Cartão de crédito</option><option value="BOLETO">Boleto</option></select></Field></div></fieldset>
      <fieldset><legend className="checkout-legend">Endereço de entrega</legend><div className="mt-3 grid gap-4 sm:grid-cols-6"><Field label="CEP" className="sm:col-span-2"><div className="relative"><input value={formatCep(postalCode)} onChange={handleCepChange} inputMode="numeric" maxLength="9" autoComplete="postal-code" placeholder="00000-000" required className={inputClass} />{isLookingUpCep && <span className="cep-loader" aria-label="Buscando CEP" />}</div></Field><Field label="Estado" className="sm:col-span-1"><input value={state} onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))} maxLength="2" autoComplete="address-level1" required className={inputClass} /></Field><Field label="Município" className="sm:col-span-3"><input value={city} onChange={(event) => setCity(event.target.value)} maxLength="120" autoComplete="address-level2" required className={inputClass} /></Field><Field label="Rua" className="sm:col-span-4"><input value={street} onChange={(event) => setStreet(event.target.value)} maxLength="180" autoComplete="street-address" required className={inputClass} /></Field><Field label="Número" className="sm:col-span-2"><input value={addressNumber} onChange={(event) => setAddressNumber(event.target.value)} maxLength="20" autoComplete="address-line2" required className={inputClass} /></Field><Field label="Bairro" className="sm:col-span-6"><input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} maxLength="160" autoComplete="address-level3" required className={inputClass} /></Field></div>{cepMessage && <p className={`mt-3 text-xs ${cepMessage.startsWith('CEP não') || cepMessage.startsWith('Não foi') ? 'text-rose-500' : 'text-emerald-600'}`}>{cepMessage}</p>}</fieldset>
      <div className="checkout-total flex items-center justify-between rounded-2xl p-4 text-sm"><span className="text-[var(--muted)]">Total do pedido</span><strong className="text-lg text-[var(--text)]">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
      {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}<button disabled={isSubmitting || isLookingUpCep} className="admin-primary w-full cursor-pointer rounded-xl py-3 font-semibold disabled:cursor-wait disabled:opacity-60">{isSubmitting ? 'Redirecionando para pagamento...' : 'Ir para pagamento seguro'}</button>
    </form>
  </div></div>;
}
function Field({ label, className = '', children }) { return <label className={`block text-sm font-medium text-[var(--text)] ${className}`}>{label}{children}</label>; }
