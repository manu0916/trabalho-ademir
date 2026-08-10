# Componentes visuais compartilhados

Todos os componentes abaixo usam classes de `src/index.css` e utilitários Tailwind v4. Os contratos de props/eventos devem permanecer estáveis.

## Navbar — fonte completa

```jsx
export default function Navbar({ storeName, cartCount, onOpenCart, currentView, onViewChange, searchQuery, onSearchChange }) {
  return (
    <header className="navbar sticky top-0 z-40">
      <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
        <button type="button" onClick={() => onViewChange('shop')} className="nav-brand flex items-center gap-2.5" aria-label="Voltar para a loja">
          <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-xl text-xl font-black">{storeName ? storeName.charAt(0) : 'N'}</span>
          <span className="brand-name hidden text-[.95rem] font-extrabold tracking-[.04em] uppercase sm:inline">{storeName}</span>
        </button>
        <div className="relative hidden max-w-md flex-1 items-center md:flex">
          <input type="search" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar produtos, novidades e favoritos..." aria-label="Buscar produtos" className="nav-search w-full rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none" />
          <svg className="absolute right-3 h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button type="button" onClick={() => onViewChange(currentView === 'shop' ? 'admin' : 'shop')} className="nav-button cursor-pointer rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors">{currentView === 'shop' ? 'Painel' : 'Loja'}</button>
          {currentView === 'shop' && <button type="button" onClick={onOpenCart} className="nav-cart relative flex cursor-pointer items-center gap-2 rounded-xl p-2.5 transition-colors" aria-label={`Abrir carrinho com ${cartCount} itens`}><svg className="nav-accent h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9Z" /></svg><span className="hidden text-xs font-semibold sm:inline">Sacola</span>{cartCount > 0 && <span className="cart-count absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-extrabold shadow-md">{cartCount}</span>}</button>}
        </div>
      </div>
    </header>
  );
}
```

## StoreHero — estrutura completa

```jsx
<section className="hero-section overflow-hidden">
  <div className="hero-texture" aria-hidden="true" />
  <div className="hero-orb hero-orb-one" aria-hidden="true" />
  <div className="hero-orb hero-orb-two" aria-hidden="true" />
  <div className="hero-doodles" aria-hidden="true">{motif.map((mark, index) => <span key={`${mark}-${index}`} className={`hero-doodle hero-doodle-${index + 1}`}>{mark}</span>)}</div>
  <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.04fr_.96fr] lg:gap-16 lg:py-24">
    <motion.div key={`${theme.id}-copy`} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .68, ease: [.22, 1, .36, 1] }} className="relative z-10">
      <p className="hero-eyebrow">{theme.eyebrow}</p>
      <h1 className="hero-title">{theme.title}</h1>
      <p className="hero-description mt-6 max-w-xl text-base leading-7 sm:text-lg">{theme.description}</p>
      <div className="mt-9 flex flex-wrap items-center gap-4"><button type="button" onClick={onExplore} className="hero-cta">{theme.cta}<span aria-hidden="true" className="hero-cta-arrow">→</span></button><span className="hero-stat"><span className="hero-stat-dot" />{theme.stat}</span></div>
      <div className="mt-10 flex flex-wrap gap-2.5">{theme.chips.map((chip) => <span className="hero-chip" key={chip}>{chip}</span>)}</div>
    </motion.div>
    <motion.div key={`${theme.id}-image`} initial={{ opacity: 0, scale: .96, rotate: -1.5 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: .82, delay: .08, ease: [.22, 1, .36, 1] }} className="hero-image-wrap">
      <div className="hero-image-halo" aria-hidden="true" /><div className="hero-image-shape" aria-hidden="true" />
      <img src={theme.image} alt={theme.imageAlt} className="hero-image" />
      <div className="hero-sticker"><span>{theme.stickerLabel}</span></div>
      <div className="hero-card"><span className="hero-card-mark" aria-hidden="true">{motif[0]}</span><strong>{theme.heroNote}</strong><small>{theme.heroDetail}</small></div>
    </motion.div>
  </div>
</section>
```

## ProductGrid — estrutura completa

```jsx
<section id="products" className="collection-section mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
  <header className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="section-kicker">A vitrine da semana</p><h2 className="section-title">{theme.collectionLabel}</h2></div><p className="collection-intro max-w-xs text-sm leading-6">Produtos especiais para você encontrar o que combina com seu momento.</p></header>
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
    {products.map((product, index) => <motion.article key={product.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .1 }} className="product-card group flex flex-col justify-between overflow-hidden rounded-[1.35rem]">
      <div className="product-image relative flex h-56 items-center justify-center overflow-hidden p-4"><img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full object-cover" /><span className="product-index absolute left-4 top-4">{String(index + 1).padStart(2, '0')}</span><span className="product-badge absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs">{theme.productLabel}</span></div>
      <div className="flex flex-grow flex-col justify-between p-5"><div><h3 className="product-title mb-1 text-lg font-semibold">{product.name}</h3><p className="mb-4 line-clamp-2 text-xs text-[var(--muted)]">{product.description}</p></div><div className="product-footer mt-auto flex items-center justify-between pt-4"><div><span className="block text-xs text-[var(--muted)]">À vista no Pix</span><span className="product-price text-xl font-bold">R$ {product.price}</span><span className="mt-1 block text-xs">{product.stockQuantity} em estoque</span></div><motion.button type="button" onClick={() => onAddToCart(product)} className="buy-button">Comprar</motion.button></div></div>
    </motion.article>)}
  </div>
</section>
```

## Superfícies compartilhadas

- `.admin-card`, `.stat-card`, `.product-card`: borda `var(--line)`, fundo translúcido `var(--surface)`, blur e sombra.
- `.admin-input`, `.checkout-input`, `.customer-input`: campos adaptados aos tokens do tema.
- `.admin-primary`, `.customer-submit`, `.cart-checkout`, `.buy-button`: gradiente `accent → accent-strong`.
- `.section-kicker` e `.section-title`: hierarquia tipográfica comum.
