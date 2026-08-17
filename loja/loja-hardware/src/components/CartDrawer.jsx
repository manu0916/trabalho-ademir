import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { validateCoupon } from '../services/api';

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onRemoveItem,
  onCheckout,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
}) {
  const closeButtonRef = useRef(null);
  const [couponCode, setCouponCode] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const discountAmount = appliedCoupon?.discountAmount ? Number(appliedCoupon.discountAmount) : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount);
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
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    setCouponError('');
    if (!couponCode.trim()) return;

    setIsValidatingCoupon(true);
    try {
      const result = await validateCoupon(couponCode, subtotal);
      if (result.valid) {
        onApplyCoupon?.(result);
        setCouponCode('');
      } else {
        setCouponError(result.message || 'Cupom inválido.');
      }
    } catch (err) {
      setCouponError(err.message || 'Erro ao validar cupom.');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="cart-overlay fixed inset-0 z-50 cursor-pointer"
          />

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
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="cart-heading flex items-center justify-between pb-5 border-b border-[var(--line)]">
                <div>
                  <p className="section-kicker">Sua seleção</p>
                  <h2 id="cart-title" className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-[var(--text)]">
                    Sacola
                    <span className="cart-items-count rounded-full px-2.5 py-1 text-xs">
                      {totalItems} {totalItems === 1 ? 'item' : 'itens'}
                    </span>
                  </h2>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  className="cart-close"
                  aria-label="Fechar carrinho"
                >
                  ×
                </button>
              </div>

              <div className="cart-list mt-4 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="cart-empty py-14 text-center">
                    <span aria-hidden="true">◌</span>
                    <p className="mt-3 text-sm">Sua seleção ainda está vazia.</p>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <article
                      key={item.cartKey || item.id}
                      className="cart-item flex items-center gap-4 rounded-2xl p-3 bg-[var(--surface-solid)] border border-[var(--line)]"
                    >
                      <div className="cart-item-image flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                        <img
                          src={item.imageUrl}
                          alt=""
                          onError={handleImageError}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-1 text-sm font-semibold text-[var(--text)]">{item.name}</h3>
                        <div className="cart-item-specs flex flex-wrap items-center gap-1.5 mt-0.5">
                          {item.selectedSize && (
                            <span className="inline-block text-[11px] font-semibold bg-[var(--bg)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--text)]">
                              Tam: {item.selectedSize}
                            </span>
                          )}
                          {item.selectedColor && (
                            <span className="inline-block text-[11px] font-semibold bg-[var(--bg)] px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--text)]">
                              Cor: {item.selectedColor}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[var(--muted)] block mt-0.5">Quantidade {item.quantity}</span>
                        <p className="mt-1 text-sm font-bold text-[var(--accent)]">
                          R$ {(Number(item.price) * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.cartKey || item.id)}
                        className="cart-remove text-xs text-rose-500 hover:underline"
                        aria-label={`Remover ${item.name} da sacola`}
                      >
                        Remover
                      </button>
                    </article>
                  ))
                )}
              </div>

              {/* Coupon Form in Cart */}
              {cartItems.length > 0 && (
                <div className="mt-5 rounded-2xl bg-[var(--bg)] p-3.5 border border-[var(--line)]">
                  <span className="block text-xs font-semibold text-[var(--text)] mb-1.5">
                    🎟️ Cupom de Desconto:
                  </span>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-xs">
                      <div>
                        <span className="font-bold text-emerald-500">Cupom {appliedCoupon.code}</span>
                        <span className="text-[11px] text-[var(--muted)] block">
                          Desconto de R$ {discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={onRemoveCoupon}
                        className="text-xs text-rose-500 font-bold hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleCouponSubmit} className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Ex: KICKS10"
                        className="flex-1 rounded-xl bg-[var(--surface-solid)] p-2 text-xs text-[var(--text)] uppercase font-bold border border-[var(--line)] focus:border-[var(--accent)] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isValidatingCoupon || !couponCode.trim()}
                        className="buy-button px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
                      >
                        {isValidatingCoupon ? '...' : 'Aplicar'}
                      </button>
                    </form>
                  )}
                  {couponError && <p className="mt-1.5 text-xs text-rose-500 font-semibold">{couponError}</p>}
                </div>
              )}
            </div>

            <div className="cart-summary space-y-4 pt-4 border-t border-[var(--line)]">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-500 font-semibold">
                    <span>Desconto ({appliedCoupon.code})</span>
                    <span>- R$ {discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex items-end justify-between gap-4 pt-2 border-t border-[var(--line)]">
                  <span className="text-sm font-bold text-[var(--text)]">Total Final</span>
                  <span className="text-2xl font-extrabold text-[var(--accent)]">
                    R$ {finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={cartItems.length === 0}
                onClick={onCheckout}
                className="cart-checkout buy-button w-full cursor-pointer rounded-2xl py-3.5 font-bold transition-all disabled:cursor-not-allowed shadow-xl"
              >
                Finalizar Compra <span aria-hidden="true">→</span>
              </button>
              <p className="cart-security text-center text-xs text-[var(--muted)]">
                <span aria-hidden="true">✓</span> PIX instantâneo, Cartão em 12x e WhatsApp
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
