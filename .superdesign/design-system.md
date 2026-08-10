# Design System — Loja mutável de três marcas

## Produto e arquitetura

Uma única loja React/Vite assume três identidades de marca sem mudar catálogo, autenticação ou fluxos: Nexus Atelier (objetos e tecnologia), Passo Livre (tênis) e Doce Pedaço (tortinhas). A home precisa parecer uma campanha editorial de marca real; painel, carrinho e checkout devem parecer parte do mesmo universo, porém priorizando clareza operacional.

Páginas/estados: vitrine, modal de acesso, sacola lateral, checkout, login admin e painel administrativo. Funções críticas: buscar, comprar, validar estoque, cadastrar produto, trocar tema, mudar nome da loja, ver pedidos e finalizar pagamento.

## Princípios obrigatórios

1. Artesanal, editorial e assimétrico; nunca dashboard/template genérico.
2. Hierarquia forte com respiro amplo, sobreposições controladas e ritmo variável.
3. Cada tema é uma marca distinta, mas compartilha componentes e acessibilidade.
4. Imagens contam a história; cards não podem parecer blocos repetidos de catálogo.
5. Movimento físico e elegante com `cubic-bezier(.87, 0, .13, 1)` para transições de marca e `[.22, 1, .36, 1]` para entradas.
6. Toda interação funciona com teclado, mobile e `prefers-reduced-motion`.

## Tipografia

- Corpo e UI: **DM Sans**, 400–800.
- Display Nexus + Passo Livre: **Space Grotesk**, 500–700; tracking negativo em títulos.
- Display Doce Pedaço: **Playfair Display**, 600–700; usar apenas títulos e citações curtas.
- Títulos hero: `clamp(3.5rem, 7vw, 7.4rem)`, line-height `.88–.96`, letter-spacing `-.065em`.
- Títulos de seção: `clamp(2.25rem, 4vw, 4.25rem)`.
- Kicker: `.66–.72rem`, 800, uppercase, tracking `.15em`.

## Identidade 01 — Nexus Atelier

Atmosfera: galeria noturna, precisão industrial, luz azul lunar, objetos de desejo. Fundo `#090b11`; superfícies `#121722` / `#1a2130`; texto `#f1f4fa`; mutado `#a3acbe`; accent `#c9e0ff`; accent forte `#7396ff`. Usar grid técnico fino, microcoordenadas, cantos diagonais e vidro escuro. Nunca neon cyberpunk roxo.

## Identidade 02 — Passo Livre

Atmosfera: editorial de rua, movimento, energia impressa, pista e cartaz. Fundo areia `#ebe7de`; papel `#fffdf7`; tinta `#17140f`; mutado `#71695f`; coral `#ff5c45`; lima `#d8ff54`. Usar barras inclinadas, números de drop grandes, recortes secos, pequenos deslocamentos/rotações. Nunca “loja esportiva azul” genérica.

## Identidade 03 — Doce Pedaço

Atmosfera: confeitaria autoral, cerâmica, fruta e papel de receita. Fundo baunilha `#fff8ee`; creme `#fffdf8`; cacau-vinho `#432c2e`; mutado `#896f67`; framboesa `#c84e58`; açafrão `#ffc665`. Formas orgânicas, selos manuscritos discretos, bordas suaves e composição de natureza-morta. Nunca rosa infantil.

## Layout

- Shell máximo: 1440px com margens fluidas.
- Navbar: 72–78px, translúcida e sticky, marca à esquerda, busca central, ações à direita; mobile reduz busca a ação compacta sem perder acesso.
- Hero desktop: composição editorial assimétrica em 12 colunas, texto 6–7 colunas e mídia 5–6, com título invadindo levemente a área visual. Mobile empilha texto e mídia sem recortar CTA.
- Vitrine: grid editorial responsivo; em desktop, variação controlada de spans/altura a cada 6 itens, sem comprometer leitura. Em telas estreitas, uma coluna; tablet, duas.
- Painel: bento operacional assimétrico, porém formulários mantêm ordem lógica e labels explícitos.
- Modais/drawers: contraste suficiente, foco visível e áreas de toque ≥44px.

## Superfícies e profundidade

- Bordas 1px com alpha baixo, highlights internos e sombra dupla difusa.
- Glassmorphism apenas sobre mídia/overlays; não borrar todos os cards.
- Noise tátil em pseudo-elemento global com opacidade ≤.04.
- Imagens com máscara específica por tema, `object-fit: cover`, zoom hover máximo 1.06 e fallback elegante.

## Motion

- Hero: stagger curto de 50–90ms; mídia entra com leve escala/rotação temática.
- Scroll reveal: opacity 0→1 e y 24→0, uma vez, duração 550–750ms.
- Botões: deslocamento magnético visual máximo 2–3px; tap scale .97.
- Cards: elevação 4–7px, imagem zoom e borda/accent; sem loop chamativo.
- Transição de tema: wipe/iris 600–800ms e troca coordenada de tokens.
- Reduced motion: remover parallax, rotações e deslocamentos; preservar mudança instantânea legível.

## Acessibilidade e performance

- Contraste WCAG AA para texto e controles.
- `:focus-visible` consistente e não dependente apenas de cor.
- Imagens de produto com `loading="lazy"` e `decoding="async"`; hero prioritário.
- Não adicionar bibliotecas além das já presentes (React, Tailwind, Framer Motion).
- Preservar `data-theme`, IDs dos temas, `id="products"`, props e contratos de API.

## Restrições de implementação

- Não alterar autenticação, Bearer, CSRF, payloads ou rewrites da API.
- Não criar router nem separar o catálogo por tema.
- Não remover modal obrigatório de cliente.
- Não transformar painel em dashboard corporativo genérico.
- Não usar novas cores, fontes ou estilos fora deste documento.
