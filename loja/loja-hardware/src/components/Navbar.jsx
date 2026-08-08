export default function Navbar({
  storeName,
  cartCount,
  onOpenCart,
  currentView,
  onViewChange,
  searchQuery,
  onSearchChange,
}) {
  return (
    <header className="sticky top-0 z-40">
      {/* Glow line at top */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

      <div
        style={{
          background: 'rgba(8, 8, 16, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo */}
          <button
            type="button"
            onClick={() => onViewChange('shop')}
            className="group flex items-center gap-3 flex-shrink-0"
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)',
                borderRadius: '10px',
              }}
              className="flex h-9 w-9 items-center justify-center text-base font-black text-white transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.7)]"
            >
              {storeName ? storeName.charAt(0) : 'N'}
            </div>
            <div className="hidden sm:block">
              <span
                style={{
                  background: 'linear-gradient(90deg, #f0f0ff, #818cf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontFamily: "'Outfit', sans-serif",
                }}
                className="text-lg font-black tracking-widest uppercase"
              >
                {storeName}
              </span>
            </div>
          </button>

          {/* Search */}
          <div className="relative hidden max-w-sm flex-1 items-center md:flex">
            <div className="relative w-full">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: 'var(--text-dim)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar GPUs, CPUs, memórias..."
                aria-label="Buscar produtos"
                className="input-premium pl-10"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onViewChange(currentView === 'shop' ? 'admin' : 'shop')}
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '10px',
                color: 'var(--text-muted)',
                transition: 'all 0.2s ease',
                fontFamily: "'Outfit', sans-serif",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                e.currentTarget.style.color = '#818cf8';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
              }}
              className="cursor-pointer px-3.5 py-2 text-xs font-semibold"
            >
              {currentView === 'shop' ? 'Painel Admin' : 'Ver Loja'}
            </button>

            {currentView === 'shop' && (
              <button
                type="button"
                onClick={onOpenCart}
                aria-label={`Abrir carrinho com ${cartCount} itens`}
                style={{
                  background: cartCount > 0
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(56,189,248,0.1) 100%)'
                    : 'rgba(99, 102, 241, 0.08)',
                  border: cartCount > 0 ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(99,102,241,0.2)',
                  borderRadius: '10px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(56,189,248,0.15) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(99,102,241,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = cartCount > 0
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(56,189,248,0.1) 100%)'
                    : 'rgba(99, 102, 241, 0.08)';
                  e.currentTarget.style.borderColor = cartCount > 0 ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                className="relative flex cursor-pointer items-center gap-2 p-2.5"
              >
                <svg className="h-5 w-5" style={{ color: cartCount > 0 ? '#818cf8' : 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9Z" />
                </svg>
                <span className="hidden text-xs font-semibold text-white sm:inline" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Carrinho
                </span>
                {cartCount > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-black text-white"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
                      boxShadow: '0 0 10px rgba(99,102,241,0.6)',
                    }}
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
