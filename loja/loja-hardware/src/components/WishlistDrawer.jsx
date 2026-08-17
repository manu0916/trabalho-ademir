import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function WishlistDrawer({
  isOpen,
  onClose,
  wishlistIds = [],
  products = [],
  onToggleWishlist,
  onOpenProductDetail,
}) {
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);

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

  if (!isOpen) return null;

  const wishlistProducts = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex justify-end"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          aria-hidden="true"
        />

        <motion.aside
          ref={drawerRef}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wishlist-title"
          className="relative z-10 flex h-full w-full max-w-md flex-col bg-[var(--surface-solid)] p-6 shadow-2xl border-l border-[var(--line)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <div>
              <p className="section-kicker">Seus Favoritos</p>
              <h2 id="wishlist-title" className="text-xl font-extrabold text-[var(--text)]">
                Lista de Desejos ({wishlistProducts.length})
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg)] text-xl font-bold text-[var(--text)] border border-[var(--line)]"
              aria-label="Fechar lista de desejos"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-5 space-y-4">
            {wishlistProducts.length === 0 ? (
              <div className="py-16 text-center text-xs text-[var(--muted)]">
                <span className="text-4xl mb-3 block">🤍</span>
                <p className="text-sm font-bold text-[var(--text)]">Sua lista de desejos está vazia</p>
                <p className="mt-1">Clique no ícone de coração nos tênis para salvá-los aqui!</p>
              </div>
            ) : (
              wishlistProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="flex gap-4 rounded-2xl bg-[var(--bg)] p-3.5 border border-[var(--line)] items-center"
                >
                  <img
                    src={prod.imageUrl}
                    alt={prod.name}
                    className="h-16 w-16 rounded-xl object-cover border border-[var(--line)] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-[var(--text)] truncate">{prod.name}</h3>
                    <p className="text-xs font-black text-[var(--accent)] mt-0.5">
                      R$ {Number(prod.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenProductDetail(prod);
                        }}
                        className="buy-button px-3 py-1 rounded-lg text-[11px] font-bold"
                      >
                        Ver Detalhes
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleWishlist(prod.id)}
                        className="text-[11px] text-rose-500 hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {wishlistProducts.length > 0 && (
            <div className="border-t border-[var(--line)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="buy-button w-full py-3 rounded-xl text-xs font-bold"
              >
                Continuar Navegando
              </button>
            </div>
          )}
        </motion.aside>
      </div>
    </AnimatePresence>
  );
}
