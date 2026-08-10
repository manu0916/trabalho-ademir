# Layouts compartilhados

Não há um componente `Layout` separado. O shell real está no retorno de `src/App.jsx`; ele não deve ser substituído por um router ou por páginas independentes durante o redesign.

```jsx
<div className="app-shell min-h-screen" data-theme={theme.id}>
  <AnimatePresence>
    {themeTransition && (
      <motion.div
        key={themeTransition}
        aria-hidden="true"
        className="theme-sweep"
        initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
        animate={{ opacity: 1, clipPath: 'circle(82% at 50% 50%)' }}
        exit={{ opacity: 0, transition: { duration: 0.28 } }}
        transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      />
    )}
  </AnimatePresence>

  <Navbar
    storeName={storeName}
    cartCount={cart.reduce((total, item) => total + item.quantity, 0)}
    onOpenCart={() => setIsCartOpen(true)}
    currentView={currentView}
    onViewChange={setCurrentView}
    searchQuery={searchQuery}
    onSearchChange={setSearchQuery}
  />

  <main className={currentView === 'shop' ? '' : 'py-6'}>
    {currentView === 'shop' ? (
      <>
        <StoreHero theme={theme} onExplore={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })} />
        {isLoadingProducts ? loadingState : productsError ? errorState : (
          <ProductGrid products={filteredProducts} onAddToCart={handleAddToCart} theme={theme} />
        )}
      </>
    ) : adminSession === undefined ? checkingState : adminSession ? (
      <AdminPanel {...adminPanelProps} />
    ) : (
      <AdminLogin onAuthenticated={handleAdminLogin} storeName={storeName} theme={theme} />
    )}
  </main>

  <CartDrawer {...cartDrawerProps} />
  <CustomerAccessModal {...customerAccessProps} />
  {isCheckoutOpen && <CheckoutDialog {...checkoutProps} />}
</div>
```

## Camadas reais

- Conteúdo: fluxo normal.
- Navbar sticky: `z-40`.
- Transição de tema: `z-45`, sem eventos de ponteiro.
- Carrinho: `z-50`.
- Acesso do cliente: `z-70`.
- Checkout: `z-80`.

## Contêineres

- Home: `max-w-7xl`, padding horizontal `px-5 sm:px-8`.
- Painel: `max-w-5xl`, `px-4 py-8`.
- Login: `max-w-md`.
- Checkout: `max-w-2xl`.
