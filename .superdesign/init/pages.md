# Páginas e árvores de dependência

## Loja / vitrine principal

```text
src/main.jsx
└── src/App.jsx [branch currentView === 'shop']
    ├── src/components/Navbar.jsx
    ├── src/components/StoreHero.jsx
    │   └── framer-motion
    ├── src/components/ProductGrid.jsx
    │   └── framer-motion
    ├── src/components/CartDrawer.jsx
    │   └── framer-motion
    ├── src/components/CustomerAccessModal.jsx
    ├── src/components/CheckoutDialog.jsx
    ├── src/themes.js
    ├── src/services/api.js
    └── src/index.css
```

Branch real: `App.jsx` linhas 225–242. O CTA do herói depende de `id="products"` em `ProductGrid`.

## Painel administrativo

```text
src/App.jsx [branch currentView !== 'shop']
├── src/components/Navbar.jsx
├── src/components/AdminLogin.jsx [adminSession === null]
├── src/components/AdminPanel.jsx [adminSession truthy]
│   ├── src/themes.js
│   └── handlers de criação, estoque, nome, tema e logout recebidos por props
├── src/services/api.js
└── src/index.css
```

`dashboard` pode estar `null` durante o carregamento. `AdminPanel` já usa fallbacks opcionais e deve continuar tolerando esse estado.

## Carrinho e checkout

```text
src/App.jsx
├── src/components/CartDrawer.jsx
└── src/components/CheckoutDialog.jsx
    └── src/services/api.js#createPaymentCheckout
```

Contrato de checkout: `{ fullName, email, cpf, paymentMethod, postalCode, state, city, neighborhood, street, addressNumber, items: [{ productId, quantity }] }`.

## Acesso do cliente

```text
src/App.jsx
└── src/components/CustomerAccessModal.jsx
    ├── loginCustomer
    └── registerCustomer
```

O modal é bloqueante enquanto `customerSession === null`.
