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
    <header className="sticky top-0 z-40 border-b border-[#27272a] bg-[#121214] bg-opacity-80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <button type="button" onClick={() => onViewChange('shop')} className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-xl font-black text-black shadow-lg shadow-sky-500/30">
            {storeName ? storeName.charAt(0) : 'N'}
          </span>
          <span className="text-xl font-extrabold tracking-wider text-white uppercase">{storeName}</span>
        </button>

        <div className="relative hidden max-w-md flex-1 items-center md:flex">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar placas de vídeo, processadores, memórias..."
            aria-label="Buscar produtos"
            className="w-full rounded-xl border border-[#27272a] bg-[#0a0a0a] px-4 py-2 text-sm text-white placeholder-zinc-500 transition-colors focus:border-sky-400/50 focus:outline-none"
          />
          <svg className="absolute right-3 h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
          </svg>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onViewChange(currentView === 'shop' ? 'admin' : 'shop')}
            className="cursor-pointer rounded-xl border border-[#27272a] bg-[#0a0a0a] px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-sky-400/50 hover:text-white"
          >
            {currentView === 'shop' ? 'Painel Admin' : 'Ver Loja'}
          </button>

          {currentView === 'shop' && (
            <button
              type="button"
              onClick={onOpenCart}
              className="relative flex cursor-pointer items-center gap-3 rounded-xl border border-[#27272a] bg-[#0a0a0a] p-2.5 transition-colors hover:border-sky-400/50"
              aria-label={`Abrir carrinho com ${cartCount} itens`}
            >
              <svg className="h-5 w-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9Z" />
              </svg>
              <span className="hidden text-xs font-semibold text-white sm:inline">Carrinho</span>
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-xs font-extrabold text-black shadow-md">
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
