import { AnimatePresence, motion } from 'framer-motion';

export default function CartDrawer({ isOpen, onClose, cartItems, onRemoveItem, onCheckout }) {
  const total = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleImageError = (event) => {
    event.currentTarget.src =
      'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%2296%22 height%3D%2296%22 viewBox%3D%220 0 96 96%22%3E%3Crect width%3D%2296%22 height%3D%2296%22 rx%3D%2212%22 fill%3D%22%230f0f1a%22/%3E%3Ctext x%3D%2250%25%22 y%3D%2252%25%22 fill%3D%22%235a5a7a%22 font-family%3D%22Arial%2Csans-serif%22 font-size%3D%2211%22 text-anchor%3D%22middle%22 dominant-baseline%3D%22middle%22%3EN/A%3C/text%3E%3C/svg%3E';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 cursor-pointer"
            style={{ background: 'rgba(4,4,10,0.8)', backdropFilter: 'blur(4px)' }}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            aria-label="Carrinho de compras"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col"
            style={{
              background: 'rgba(10, 10, 20, 0.95)',
              backdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(99,102,241,0.15)',
              boxShadow: '-20px 0 60px rgba(4,4,10,0.6)',
            }}
          >
            {/* Top glow bar */}
            <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6), rgba(56,189,248,0.4), transparent)' }} />

            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-5" style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
                >
                  <svg className="h-5 w-5" style={{ color: '#818cf8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>Seu Carrinho</h2>
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {totalItems} {totalItems === 1 ? 'item' : 'itens'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-all"
                style={{
                  background: 'rgba(99,102,241,0.05)',
                  border: '1px solid rgba(99,102,241,0.1)',
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(248,113,113,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)';
                  e.currentTarget.style.color = '#f87171';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.1)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
                aria-label="Fechar carrinho"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                  <div
                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
                  >
                    <svg className="h-8 w-8" style={{ color: 'var(--text-dim)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9Z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white">Carrinho vazio</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Adicione produtos para continuar.</p>
                </div>
              ) : (
                cartItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.06 }}
                    className="flex items-center gap-3 rounded-2xl p-3"
                    style={{
                      background: 'rgba(15,15,26,0.8)',
                      border: '1px solid rgba(99,102,241,0.12)',
                    }}
                  >
                    <div
                      className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl p-1"
                      style={{ background: 'rgba(8,8,16,0.8)' }}
                    >
                      <img
                        src={item.imageUrl}
                        alt=""
                        onError={handleImageError}
                        className="h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="line-clamp-1 text-sm font-semibold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {item.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                        >
                          ×{item.quantity}
                        </span>
                        <span
                          className="text-sm font-bold"
                          style={{ fontFamily: "'JetBrains Mono', monospace", color: '#818cf8' }}
                        >
                          R$ {(Number(item.price) * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs transition-all"
                      style={{ color: 'var(--text-dim)', background: 'transparent' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(248,113,113,0.1)';
                        e.currentTarget.style.color = '#f87171';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-dim)';
                      }}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-5 space-y-4" style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}>
              <div
                className="flex items-center justify-between rounded-xl p-4"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}
              >
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Total à vista (Pix)</span>
                <span
                  className="text-xl font-black text-white"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <button
                type="button"
                disabled={cartItems.length === 0}
                onClick={onCheckout}
                className="w-full cursor-pointer py-3.5 text-sm font-bold rounded-xl transition-all"
                style={{
                  background: cartItems.length > 0
                    ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                    : 'rgba(99,102,241,0.05)',
                  color: cartItems.length > 0 ? '#fff' : 'var(--text-dim)',
                  border: cartItems.length > 0 ? 'none' : '1px solid rgba(99,102,241,0.1)',
                  boxShadow: cartItems.length > 0 ? '0 6px 24px rgba(99,102,241,0.35)' : 'none',
                  cursor: cartItems.length > 0 ? 'pointer' : 'not-allowed',
                  fontFamily: "'Outfit', sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (cartItems.length > 0) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.55)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (cartItems.length > 0) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.35)';
                  }
                }}
              >
                {cartItems.length > 0 ? '🔒 Finalizar Compra' : 'Carrinho vazio'}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
