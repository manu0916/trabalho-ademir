import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function CartDrawer({ isOpen, onClose, cartItems, onRemoveItem, onCheckout }) {
  const closeButtonRef = useRef(null);
  const total = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const handleImageError = (event) => {
    event.currentTarget.style.display = 'none';
    event.currentTarget.parentElement.classList.add('cart-image-unavailable');
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="cart-overlay fixed inset-0 z-50 cursor-pointer" />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            className="cart-drawer fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col justify-between p-6 shadow-2xl sm:p-7"
          >
            <div>
              <div className="cart-heading flex items-center justify-between pb-5">
                <div>
                  <p className="section-kicker">Sua seleção</p>
                  <h2 id="cart-title" className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-[var(--text)]">
                    Sacola
                    <span className="cart-items-count rounded-full px-2.5 py-1 text-xs">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
                  </h2>
                </div>
                <button ref={closeButtonRef} type="button" onClick={onClose} className="cart-close" aria-label="Fechar carrinho">×</button>
              </div>

              <div className="cart-list mt-5 max-h-[58vh] space-y-3 overflow-y-auto pr-1">
                {cartItems.length === 0 ? (
                  <div className="cart-empty py-14 text-center">
                    <span aria-hidden="true">◌</span>
                    <p className="mt-3 text-sm">Sua seleção ainda está vazia.</p>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <article key={item.cartKey || item.id} className="cart-item flex items-center gap-4 rounded-2xl p-3">
                      <div className="cart-item-image flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                        <img src={item.imageUrl} alt="" onError={handleImageError} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-1 text-sm font-semibold text-[var(--text)]">{item.name}</h3>
                        <div className="cart-item-specs flex flex-wrap items-center gap-1.5 mt-0.5">
                          {item.selectedSize && <span className="inline-block text-[11px] font-semibold bg-[var(--surface-solid)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--text)]">Tam: {item.selectedSize}</span>}
                          {item.selectedColor && <span className="inline-block text-[11px] font-semibold bg-[var(--surface-solid)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--text)]">Cor: {item.selectedColor}</span>}
                        </div>
                        <span className="text-xs text-[var(--muted)] block mt-0.5">Quantidade {item.quantity}</span>
                        <p className="mt-1 text-sm font-bold text-[var(--accent)]">R$ {(Number(item.price) * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <button type="button" onClick={() => onRemoveItem(item.cartKey || item.id)} className="cart-remove" aria-label={`Remover ${item.name} da sacola`}>Remover</button>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="cart-summary space-y-5 pt-5">
              <div className="flex items-end justify-between gap-4">
                <span className="text-sm text-[var(--muted)]">Total à vista</span>
                <span className="text-2xl font-extrabold text-[var(--text)]">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <button type="button" disabled={cartItems.length === 0} onClick={onCheckout} className="cart-checkout w-full cursor-pointer rounded-xl py-3.5 font-semibold transition-all disabled:cursor-not-allowed">
                Finalizar pelo WhatsApp <span aria-hidden="true">→</span>
              </button>
              <p className="cart-security"><span aria-hidden="true">✓</span> Combine o pagamento diretamente pelo WhatsApp</p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
