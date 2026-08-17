export default function Navbar({
  storeName,
  cartCount,
  onOpenCart,
  currentView,
  onViewChange,
  searchQuery,
  onSearchChange,
  customerSession,
  onCustomerAccess,
  onCustomerAccount,
  onCustomerLogout,
}) {
  return (
    <header className="navbar sticky top-0 z-40">
      <div className="nav-shell mx-auto max-w-[90rem] px-4 sm:px-8">
        <div className="flex h-[4.75rem] items-center justify-between gap-3">
          <button type="button" onClick={() => onViewChange('shop')} className="nav-brand flex items-center gap-2.5" aria-label="Voltar para a loja">
            <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-xl text-xl font-black">{storeName ? storeName.charAt(0) : 'K'}</span>
            <span className="brand-copy hidden sm:block">
              <span className="brand-name block text-[.95rem] font-extrabold tracking-[.04em] uppercase">{storeName}</span>
              <small>sneakers &amp; streetwear</small>
            </span>
          </button>

          {currentView === 'shop' && <SearchField className="hidden max-w-md flex-1 md:flex" searchQuery={searchQuery} onSearchChange={onSearchChange} />}

          <div className="flex items-center gap-2 sm:gap-3">
            {currentView === 'shop' && (customerSession ? (
              <div className="nav-account-actions flex items-center gap-1.5">
                <button type="button" onClick={onCustomerAccount} className="nav-button cursor-pointer rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors" title={`Conta de ${customerSession.username}`}>
                  <span className="nav-account-avatar" aria-hidden="true">{customerSession.username?.charAt(0)?.toUpperCase() || 'C'}</span>
                  <span className="hidden lg:inline">{customerSession.username}</span>
                  <span className="hidden sm:inline">Minha conta</span>
                  <span className="sr-only sm:hidden">Abrir minha conta</span>
                </button>
                <button type="button" onClick={onCustomerLogout} className="nav-button nav-logout-button cursor-pointer rounded-xl p-2.5 text-xs font-semibold transition-colors" aria-label={`Sair da conta ${customerSession.username}`} title="Sair da conta">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 17l5-5-5-5m5 5H3m12-8h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" /></svg>
                </button>
              </div>
            ) : (
              <button type="button" onClick={onCustomerAccess} className="nav-button cursor-pointer rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors">
                <span className="nav-button-dot" aria-hidden="true" />Entrar
              </button>
            ))}
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
