import { useMemo, useState } from 'react';
import { createOrder } from '../services/api';

function isValidCpf(value) {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (length) => {
    const total = cpf.slice(0, length).split('').reduce((sum, number, index) => sum + Number(number) * (length + 1 - index), 0);
    const result = (total * 10) % 11;
    return result === 10 ? 0 : result;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export default function CheckoutDialog({ isOpen, onClose, cartItems, onOrderCreated }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const total = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [cartItems],
  );

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!isValidCpf(cpf)) {
      setError('Informe um CPF válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await createOrder({
        fullName,
        email,
        cpf,
        paymentMethod,
        items: cartItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      });
      setSuccess(`Pedido #${order.id} registrado com sucesso.`);
      onOrderCreated();
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível registrar seu pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/85 p-4 backdrop-blur-sm">
      <div className="mx-auto my-6 w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#121214] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Finalizar compra</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Dados do pedido</h2>
          </div>
          <button type="button" onClick={onClose} className="text-xl text-zinc-400 hover:text-white" aria-label="Fechar checkout">×</button>
        </div>

        {success ? (
          <div className="mt-6">
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</p>
            <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-sky-500 py-3 font-semibold text-black">Fechar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm text-zinc-300">Nome completo
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength="5" maxLength="160" required className="mt-2 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-sky-400" />
            </label>
            <label className="block text-sm text-zinc-300">E-mail
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength="254" autoComplete="email" required className="mt-2 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-sky-400" />
            </label>
            <label className="block text-sm text-zinc-300">CPF
              <input value={cpf} onChange={(event) => setCpf(event.target.value)} inputMode="numeric" maxLength="14" placeholder="000.000.000-00" required className="mt-2 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-sky-400" />
            </label>
            <label className="block text-sm text-zinc-300">Forma de pagamento
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-700 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-sky-400">
                <option value="PIX">Pix</option>
                <option value="CARTAO_CREDITO">Cartão de crédito</option>
                <option value="BOLETO">Boleto</option>
              </select>
            </label>
            <div className="flex items-center justify-between rounded-lg bg-black/30 p-3 text-sm">
              <span className="text-zinc-400">Total do pedido</span>
              <strong className="text-white">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <button disabled={isSubmitting} className="w-full rounded-xl bg-sky-500 py-3 font-semibold text-black transition hover:bg-sky-400 disabled:cursor-wait disabled:opacity-60">
              {isSubmitting ? 'Registrando pedido...' : 'Confirmar pedido'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
