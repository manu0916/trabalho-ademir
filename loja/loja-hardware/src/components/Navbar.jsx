export default function Navbar({ storeName, cartCount, onOpenCart, currentView, onViewChange, searchQuery, onSearchChange }) {
  return (
    <header className="navbar sticky top-0 z-40">
      <div className="nav-shell mx-auto max-w-[90rem] px-4 sm:px-8">
        <div className="flex h-[4.75rem] items-center justify-between gap-3">
          <button type="button" onClick={() => onViewChange('shop')} className="nav-brand flex items-center gap-2.5" aria-label="Voltar para a loja">
            <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-xl text-xl font-black">{storeName ? storeName.charAt(0) : 'N'}</span>
            <span className="brand-copy hidden sm:block">
              <span className="brand-name block text-[.95rem] font-extrabold tracking-[.04em] uppercase">{storeName}</span>
              <small>curadoria independente</small>
            </span>
          </button>

          {currentView === 'shop' && <SearchField className="hidden max-w-md flex-1 md:flex" searchQuery={searchQuery} onSearchChange={onSearchChange} />}

          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => onViewChange(currentView === 'shop' ? 'admin' : 'shop')} className="nav-button cursor-pointer rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors">
              <span className="nav-button-dot" aria-hidden="true" />{currentView === 'shop' ? 'Painel' : 'Loja'}
            </button>
            {currentView === 'shop' && <button type="button" onClick={onOpenCart} className="nav-cart relative flex cursor-pointer items-center gap-2 rounded-xl p-2.5 transition-colors" aria-label={`Abrir carrinho com ${cartCount} itens`}>
              <svg className="nav-accent h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9Z" /></svg>
              <span className="hidden text-xs font-semibold sm:inline">Sacola</span>
              {cartCount > 0 && <span className="cart-count absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-extrabold shadow-md">{cartCount}</span>}
            </button>}
          </div>
        </div>

        {currentView === 'shop' && <SearchField className="flex pb-3 md:hidden" searchQuery={searchQuery} onSearchChange={onSearchChange} compact />}
      </div>
    </header>
  );
}

function SearchField({ className, searchQuery, onSearchChange, compact = false }) {
  return (
    <div className={`nav-search-wrap relative items-center ${className}`}>
      <input
        type="search"
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={compact ? 'Buscar na vitrine...' : 'Buscar produtos, novidades e favoritos...'}
        aria-label="Buscar produtos"
        className="nav-search w-full rounded-xl px-4 py-2.5 pr-10 text-sm transition-colors focus:outline-none"
      />
      <svg className="absolute right-3 h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
    </div>
  );
}
