# Tema atual — tokens e configuração

## Stack visual

- Tailwind CSS v4 via `@import "tailwindcss"` e classes utilitárias no JSX.
- CSS autoral em `src/index.css` (303 linhas), único stylesheet importado.
- Fontes Google: DM Sans (corpo), Space Grotesk (display Nexus/Passo Livre), Playfair Display (display Doce Pedaço).
- Motion: Framer Motion + CSS keyframes; easing principal `[0.22, 1, 0.36, 1]`.

## Tokens base — Nexus Atelier

```css
.app-shell {
  --font-display: "Space Grotesk", "DM Sans", sans-serif;
  --font-body: "DM Sans", ui-sans-serif, sans-serif;
  --bg: #090b11;
  --surface: rgba(18, 23, 34, .72);
  --surface-solid: #141a25;
  --surface-raised: #1a2130;
  --text: #f1f4fa;
  --muted: #a3acbe;
  --line: rgba(194, 212, 242, .14);
  --accent: #c9e0ff;
  --accent-strong: #7396ff;
  --accent-ink: #080a10;
  --soft: rgba(114, 150, 255, .16);
  --shadow-color: rgba(0, 0, 0, .34);
}
```

## Tokens — Passo Livre

```css
.app-shell[data-theme="sneakers"] {
  --bg: #ebe7de;
  --surface: rgba(255, 253, 247, .78);
  --surface-solid: #fffdf7;
  --surface-raised: #ffffff;
  --text: #17140f;
  --muted: #71695f;
  --line: rgba(23, 20, 15, .15);
  --accent: #ff5c45;
  --accent-strong: #d8ff54;
  --accent-ink: #16130d;
  --soft: rgba(255, 92, 69, .13);
  --shadow-color: rgba(41, 35, 27, .16);
}
```

## Tokens — Doce Pedaço

```css
.app-shell[data-theme="tarts"] {
  --font-display: "Playfair Display", Georgia, serif;
  --bg: #fff8ee;
  --surface: rgba(255, 253, 248, .82);
  --surface-solid: #fffdf8;
  --surface-raised: #fffaf3;
  --text: #432c2e;
  --muted: #896f67;
  --line: rgba(104, 62, 58, .14);
  --accent: #c84e58;
  --accent-strong: #ffc665;
  --accent-ink: #3b2928;
  --soft: rgba(200, 78, 88, .11);
  --shadow-color: rgba(92, 56, 46, .13);
}
```

## Configuração completa dos três temas

```js
hardware: { name: 'Nexus Atelier', category: 'Objetos e tecnologia', motif: 'grid', image: nexusObjectsHero }
sneakers: { name: 'Passo Livre', category: 'Tênis', motif: 'motion', image: 'Unsplash sneaker red' }
tarts: { name: 'Doce Pedaço', category: 'Tortinha', motif: 'petals', image: 'Unsplash pastries' }
```

Cada tema também define `eyebrow`, `title`, `description`, `collectionLabel`, `productLabel`, `cta`, `stat`, `stickerLabel`, `heroNote`, `heroDetail`, `chips`, `imageAlt`.

## Geometria existente

- Nexus: cantos diagonais alternados, fundo dark grid, brilho frio.
- Passo Livre: cantos mais secos, listras diagonais, coral + lima, leve rotação em hover.
- Doce Pedaço: formas orgânicas e arredondadas, pontos delicados, vinho + açafrão, display serifado.
- `prefers-reduced-motion` reduz animações e transições globalmente.
