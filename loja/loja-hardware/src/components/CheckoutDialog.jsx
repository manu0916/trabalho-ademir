import { useMemo, useState } from 'react';
import { createPaymentCheckout } from '../services/api';

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

const inputStyle = {
  width: '100%',
  background: 'rgba(8, 8, 16, 0.7)',
  border: '1px solid rgba(99, 102, 241, 0.2)',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '0.875rem',
  color: 'var(--text-main)',
  fontFamily: "'Outfit', sans-serif",
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

function InputField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {children}
    </label>
  );
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
      const checkout = await createPaymentCheckout({
        fullName,
        email,
        cpf,
        paymentMethod,
        items: cartItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      });
      onOrderCreated();
      window.location.assign(checkout.checkoutUrl);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível registrar seu pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const focusHandlers = {
    onFocus: (e) => {
      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)';
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
    },
    onBlur: (e) => {
      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)';
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  const paymentIcons = {
    PIX: '⚡',
    CARTAO_CREDITO: '💳',
    BOLETO: '📄',
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(4, 4, 10, 0.9)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl my-6"
        style={{
          background: 'rgba(13, 13, 24, 0.97)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          boxShadow: '0 32px 80px rgba(4,4,10,0.8), 0 0 0 1px rgba(99,102,241,0.1)',
        }}
      >
        {/* Top glow */}
        <div
          className="absolute top-0 left-8 right-8 h-px rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.7), rgba(56,189,248,0.4), transparent)' }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] uppercase mb-1" style={{ color: '#818cf8' }}>
              Finalizar compra
            </p>
            <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Dados do pedido
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-all flex-shrink-0 mt-1"
            style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            aria-label="Fechar checkout"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}
            >
              <svg className="h-8 w-8" style={{ color: '#34d399' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold mb-2">{success}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField label="Nome completo">
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                minLength="5"
                maxLength="160"
                required
                style={inputStyle}
                {...focusHandlers}
              />
            </InputField>

            <InputField label="E-mail">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength="254"
                autoComplete="email"
                required
                style={inputStyle}
                {...focusHandlers}
              />
            </InputField>

            <InputField label="CPF">
              <input
                value={cpf}
                onChange={(event) => setCpf(event.target.value)}
                inputMode="numeric"
                maxLength="14"
                placeholder="000.000.000-00"
                required
                style={inputStyle}
                {...focusHandlers}
              />
            </InputField>

            <InputField label="Forma de pagamento">
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                {...focusHandlers}
              >
                <option value="PIX">⚡ Pix (desconto à vista)</option>
                <option value="CARTAO_CREDITO">💳 Cartão de crédito</option>
                <option value="BOLETO">📄 Boleto bancário</option>
              </select>
            </InputField>

            {/* Order summary */}
            <div
              className="flex items-center justify-between rounded-xl p-4"
              style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <div>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {paymentIcons[paymentMethod]} Total do pedido
                </span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                  {cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'}
                </p>
              </div>
              <strong
                className="text-xl font-black text-white"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-xl p-3 text-sm"
                role="alert"
                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              disabled={isSubmitting}
              type="submit"
              className="w-full py-3.5 text-sm font-bold rounded-xl transition-all"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#fff',
                boxShadow: '0 6px 24px rgba(99,102,241,0.4)',
                fontFamily: "'Outfit', sans-serif",
                cursor: isSubmitting ? 'wait' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.55)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.4)';
              }}
            >
              {isSubmitting ? '⏳ Redirecionando...' : '🔒 Ir para pagamento seguro'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
