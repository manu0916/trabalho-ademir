# Rotas e estados de navegação

O frontend é uma SPA React/Vite sem biblioteca de roteamento. `src/main.jsx` monta apenas `<App />`; a navegação é controlada em `src/App.jsx` pelo estado `currentView`.

| Estado lógico | Condição real | Árvore renderizada |
| --- | --- | --- |
| Loja | `currentView === 'shop'` | `Navbar` → `StoreHero` → loading/erro/`ProductGrid` → `CartDrawer` → `CustomerAccessModal` → `CheckoutDialog` condicional |
| Painel verificando | `currentView !== 'shop' && adminSession === undefined` | `Navbar` → texto “Verificando acesso...” |
| Painel autenticado | `currentView !== 'shop' && Boolean(adminSession)` | `Navbar` → `AdminPanel` |
| Login administrativo | `currentView !== 'shop' && adminSession === null` | `Navbar` → `AdminLogin` |

## Entrypoint completo

```jsx
// loja/loja-hardware/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

## Navegação e modais

- A marca no `Navbar` chama `onViewChange('shop')`.
- O botão `Painel/Loja` alterna `currentView`.
- A sacola só aparece em `shop`; `CartDrawer` é montado sempre e abre por estado.
- `CustomerAccessModal` abre quando `customerSession === null` e não pode ser dispensado sem autenticação.
- `CheckoutDialog` é montado somente quando `isCheckoutOpen` é verdadeiro.
- O Stripe retorna para `/pagamento/sucesso?session_id=...` ou `/pagamento/cancelado?order_id=...`; `/pagamento/pendente` e `/pagamento/falhou` permanecem como aliases de apresentação. O fallback da Vercel entrega `index.html` e a SPA interpreta o caminho.
- As páginas aceitam `session_id`/`sessionId` ou `order_id`/`orderId`; se o redirecionamento não trouxer um identificador, usam o último `orderId` salvo no início do checkout.
- A interface carrega os meios habilitados em `GET /api/payments/methods` e consulta periodicamente `GET /api/customer/payments/status?sessionId=...` ou `GET /api/customer/payments/orders/{orderId}/status`. Ela só reconcilia as quantidades do snapshot cujo `orderId` foi confirmado por `paymentVerified`; pendência, cancelamento, falha e expiração preservam os itens.
- Essas páginas apenas apresentam o estado consultado. Somente o webhook assinado em `POST /api/payments/stripe/webhook` confirma pagamento, falha, expiração, reembolso ou disputa.

## Rewrites de produção

```json
{
  "source": "/api/:path*",
  "destination": "https://trabalho-ademir-z2dy.onrender.com/api/:path*"
}
```

Todas as chamadas de produção usam `/api` same-origin, com cookies e cabeçalho Bearer preservados.
