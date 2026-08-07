import { AnimatePresence, motion } from 'framer-motion';

export default function CartDrawer({ isOpen, onClose, cartItems, onRemoveItem, onCheckout }) {
  const total = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const handleImageError = (event) => {
    event.currentTarget.src =
      'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%2296%22 height%3D%2296%22 viewBox%3D%220 0 96 96%22%3E%3Crect width%3D%2296%22 height%3D%2296%22 rx%3D%2212%22 fill%3D%22%23121214%22/%3E%3Ctext x%3D%2250%25%22 y%3D%2252%25%22 fill%3D%22%239ca3af%22 font-family%3D%22Arial%2Csans-serif%22 font-size%3D%2212%22 text-anchor%3D%22middle%22 dominant-baseline%3D%22middle%22%3EN/A%3C/text%3E%3C/svg%3E';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 cursor-pointer bg-black"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            aria-label="Carrinho de compras"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col justify-between border-l border-[#27272a] bg-[#121214] p-6 shadow-2xl"
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  Seu Carrinho
                  <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-400">
                    {totalItems} itens
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 text-xl text-zinc-400 hover:text-white"
                  aria-label="Fechar carrinho"
                >
                  ×
                </button>
              </div>

              <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                {cartItems.length === 0 ? (
                  <p className="py-12 text-center text-sm text-zinc-500">Seu carrinho está vazio.</p>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 rounded-xl border border-[#27272a] bg-[#0a0a0a] p-3">
                      <img
                        src={item.imageUrl}
                        alt=""
                        onError={handleImageError}
                        className="h-16 w-16 rounded-lg bg-black/40 p-1 object-contain"
                      />
                      <div className="flex-1">
                        <h3 className="line-clamp-1 text-sm font-semibold text-white">{item.name}</h3>
                        <span className="text-xs text-zinc-400">Qtd: {item.quantity}</span>
                        <p className="mt-0.5 text-sm font-bold text-sky-400">
                          R$ {(Number(item.price) * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1 text-xs text-zinc-500 transition-colors hover:text-red-400"
                      >
                        Remover
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4 border-t border-[#27272a] pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Total à vista (Pix):</span>
                <span className="text-xl font-bold text-white">
                  R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <button
                type="button"
                disabled={cartItems.length === 0}
                onClick={onCheckout}
                className="w-full cursor-pointer rounded-xl bg-sky-500 py-3 font-semibold text-black shadow-lg shadow-sky-500/20 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
              >
                Finalizar Compra
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
