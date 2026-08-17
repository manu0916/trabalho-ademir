import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createStockAlert } from '../services/api';

export default function StockAlertModal({ product, selectedSize, selectedColor, isOpen, onClose, customerSession }) {
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (customerSession?.account?.email) {
      setEmail(customerSession.account.email);
    }
  }, [customerSession]);

  useEffect(() => {
    if (!isOpen) return undefined;
    setSuccess(false);
    setError('');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Por favor, informe seu e-mail.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createStockAlert({
        productId: product.id,
        productName: product.name,
        size: selectedSize,
        color: selectedColor,
        email: email.trim(),
        whatsapp: whatsapp.trim() || null,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Não foi possível cadastrar o alerta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 py-6 sm:p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSubmitting) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          aria-hidden="true"
        />

        <motion.section
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-alert-title"
          className="relative z-10 w-full max-w-md overflow-hidden rounded-[1.85rem] bg-[var(--surface-solid)] p-6 shadow-2xl border border-[var(--line)] sm:p-8"
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg)]/80 text-xl font-bold text-[var(--text)] backdrop-blur-md transition-transform hover:scale-110 border border-[var(--line)]"
            aria-label="Fechar aviso"
          >
            ×
          </button>

          <div>
            <p className="section-kicker">Reposição de Estoque</p>
            <h2 id="stock-alert-title" className="mt-1 text-2xl font-extrabold text-[var(--text)]">
              Avise-me quando chegar!
            </h2>
            <div className="mt-3 rounded-xl bg-[var(--bg)] p-3 text-xs border border-[var(--line)] text-[var(--muted)]">
              <p className="font-bold text-[var(--text)]">{product.name}</p>
              <p className="mt-0.5">
                Tamanho: <strong className="text-[var(--accent)]">{selectedSize}</strong> • Cor: <strong className="text-[var(--text)]">{selectedColor}</strong>
              </p>
            </div>
          </div>

          {success ? (
            <div className="mt-6 rounded-2xl bg-emerald-500/10 p-5 border border-emerald-500/20 text-center">
              <span className="text-3xl mb-2 block">🔔 ✓</span>
              <h3 className="text-sm font-bold text-emerald-500">Alerta Cadastrado!</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Assim que este tamanho/cor estiver disponível no nosso estoque, você receberá uma notificação prioritária.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="buy-button mt-4 px-6 py-2 rounded-xl text-xs font-bold"
              >
                Concluído
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
              {error && (
                <div className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-500 border border-rose-500/20">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1" htmlFor="stock-alert-email">
                  Seu E-mail:
                </label>
                <input
                  id="stock-alert-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full rounded-xl bg-[var(--bg)] p-3 text-xs text-[var(--text)] border border-[var(--line)] focus:border-[var(--accent)] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-1" htmlFor="stock-alert-whatsapp">
                  WhatsApp (Opcional):
                </label>
                <input
                  id="stock-alert-whatsapp"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(DDD) 99999-9999"
                  className="w-full rounded-xl bg-[var(--bg)] p-3 text-xs text-[var(--text)] border border-[var(--line)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="buy-button w-full py-3 rounded-xl text-xs font-bold shadow-lg disabled:opacity-40"
                >
                  {isSubmitting ? 'Cadastrando alerta...' : 'Cadastrar Alerta de Reposição'}
                </button>
              </div>
            </form>
          )}
        </motion.section>
      </div>
    </AnimatePresence>
  );
}
