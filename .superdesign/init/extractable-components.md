# Componentes extraíveis para Superdesign

## Prioridade alta

### Navbar
- Fonte: `loja/loja-hardware/src/components/Navbar.jsx`
- Tipo: shell/layout compartilhado.
- Props visuais úteis: `storeName: string`, `cartCount: number`, `currentView: 'shop' | 'admin'`, `searchQuery: string`.
- Eventos: `onOpenCart`, `onViewChange`, `onSearchChange`.
- Motivo: aparece na loja, login e painel e define a identidade da marca.

### StoreHero
- Fonte: `loja/loja-hardware/src/components/StoreHero.jsx`
- Tipo: feature hero reutilizado pelos três temas.
- Props visuais: `theme` com `id`, `eyebrow`, `title`, `description`, `cta`, `stat`, `image`, `imageAlt`, `stickerLabel`, `heroNote`, `heroDetail`, `chips`, `motif`.
- Evento: `onExplore`.
- Motivo: mesma composição base com identidade variável.

## Prioridade média

### ProductGrid
- Fonte: `loja/loja-hardware/src/components/ProductGrid.jsx`
- Props: `products`, `theme`, `onAddToCart`.
- É uma seção de página, não um primitivo. Útil somente para reproduzir a home completa.

### CartDrawer
- Fonte: `loja/loja-hardware/src/components/CartDrawer.jsx`
- Props: `isOpen`, `cartItems`, `onClose`, `onRemoveItem`, `onCheckout`.
- Deve ser extraído apenas ao desenhar o fluxo de compra.

## Não extrair

- Botões, inputs, cards e labels simples: permanecem inline.
- `AdminPanel`: componente de página extenso e altamente dependente de dados.
- `CheckoutDialog`: formulário de fluxo, melhor representado como página/modal completo.
