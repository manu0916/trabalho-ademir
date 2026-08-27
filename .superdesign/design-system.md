# Design System — Kicks Store · Calce a felicidade

## Produto, dados e arquitetura

Kicks Store é um e-commerce React/Vite de sneakers com backend Spring Boot real. A experiência deve vender alegria com sofisticação: clara, vibrante, jovem, acolhedora, editorial e premium — nunca infantil, sombria, cyberpunk ou genérica.

A API é a fonte de verdade. O catálogo atual fornece apenas `id`, `name`, `category`, `price`, `stockQuantity`, `description`, `imageUrl` e `images`. Não inventar marca, SKU, desconto, popularidade, gênero, cor, tamanho, variante, estoque por variante, frete, parcelamento, avaliações, benefícios ou promessas comerciais. Filtros editoriais só podem usar palavras existentes no nome, categoria e descrição, explicando esse critério quando necessário.

Rotas existentes: home `/`, catálogo `/sneakers`, novidades `/novidades`, ofertas `/ofertas`, produto `/produto/:id`, admin `/admin`, estados de pagamento e 404. Shell compartilhado: header sticky, conteúdo, footer, overlays de busca/favoritos/sacola/conta/checkout. Autenticação, CSRF, pagamentos, estoque, pedidos, hero e footer continuam ligados às APIs existentes.

## Ideia central e personalidade

- Promessa: **Calce a felicidade.**
- Sensação: alegria, energia positiva, liberdade, expressão pessoal, conforto e desejo de explorar.
- Tom: otimista, direto, humano e elegante. Microcopy breve; poucos emojis e apenas quando agregam significado.
- Elemento proprietário: **Sol Kicks**, um disco amarelo com raios arredondados e a letra K. Reaparece no logo, loading, empty states, feedbacks e detalhes de campanha.
- Linguagem gráfica: verão + streetwear + editorial de moda + movimento; círculos, órbitas, sparks e ondas em baixa densidade.

## Paleta funcional

Base:

- Canvas quente `#FFF9EC` — fundo principal.
- Papel `#FFFFFF` — cards, formulários e superfícies elevadas.
- Nuvem `#F3F5F7` — superfícies neutras.
- Creme `#FFF1CF` — alternância quente de seção.
- Ink `#17223B` — texto e controles principais.
- Ink muted `#59647A` — texto secundário; nunca usar cinza mais claro para texto pequeno.

Acentos com função:

- Sunshine `#FFD84D` — CTA primário, marca e alegria.
- Sky `#69C8FF` — informação, navegação e superfícies frescas.
- Coral `#FF7C70` — destaque editorial e ofertas reais.
- Mint `#78E6BD` — sucesso e confirmação.
- Pink `#FF8EC8` — favoritos e personalidade.
- Lavender `#BDA7FF` — novidades e campanhas especiais.
- Lime `#C7F464` — energia pontual, nunca para texto.

Sem cores aleatórias. Em qualquer viewport, limitar uma composição a canvas/papel + ink + no máximo três acentos visíveis de uma vez. Gradientes permitidos apenas em grandes superfícies decorativas, sempre claros e com texto em Ink.

## Tipografia

- Display: **Bricolage Grotesque**, fallback Plus Jakarta Sans/Segoe UI. Pesos 700–800, tracking negativo suave.
- Corpo e interface: **DM Sans**, fallback Segoe UI. Pesos 400–800.
- Hero: `clamp(3.2rem, 7.5vw, 7.6rem)`, line-height `.88–.96`, máximo 10–12 caracteres por linha em desktop.
- Título de seção: `clamp(2rem, 4.5vw, 4.25rem)`, line-height `.95–1.04`.
- Kicker: `.68–.76rem`, peso 800+, uppercase, tracking `.10em`.
- Corpo: 1rem, line-height 1.55–1.7. Texto pequeno nunca abaixo de `.67rem` e somente para metadados não essenciais.

## Layout e ritmo

- Largura de conteúdo: `min(100% - 2rem, 88rem)`; manter respiro generoso até 1440px e centralizar em 1920px.
- Header: 78–88px, sticky, translúcido, blur leve; compacta ao rolar. Logo à esquerda, navegação central, ações à direita. Mobile usa menu claro, busca sempre acessível e touch targets ≥44px.
- Hero: duas colunas assimétricas no desktop; mensagem dominante à esquerda, composição do sneaker e card factual à direita. No mobile, texto primeiro e mídia compactada sem cobrir CTAs.
- Seções alternam Canvas, Creme, Sky-soft, Mint-soft, Pink-soft e Papel para criar ritmo, sem faixas arbitrárias.
- Grids: 4 colunas em desktop amplo, 3 em laptop, 2 em tablet, 1 em mobile. Cards mantêm alturas coerentes e ações não pulam entre linhas.
- PDP: galeria editorial grande + resumo sticky somente quando houver espaço; sem seletores de tamanho/cor porque o backend não fornece variantes.
- Checkout: composição calma e linear; decoração reduzida; prioridade a labels, erros, total autoritativo e próxima ação.
- Radius: 12–14px em inputs, 18–24px em cards, 28–42px em superfícies especiais, pill somente para chips e CTAs.

## Componentes

- Botão primário: pill Sunshine, texto Ink, peso 800, sombra âmbar difusa; hover translateY(-2px), active scale(.98).
- Botão secundário: Papel com borda Ink 10–20% e hover Sky-soft.
- ProductCard: fundo Papel, imagem `object-fit: contain`, badge factual, nome, categoria real, preço BRL, estoque real, favorito e ações. Sem “Pix”, desconto ou marca inventada.
- Chips/filtros: botão real com `aria-pressed`, estado ativo visível por preenchimento + borda + iconografia, nunca só cor.
- Overlays/drawers: scrim Ink 42%, blur 7–9px, superfície Canvas/Papel, foco preso e fechamento por Escape quando aplicável.
- Empty states: Sol Kicks + frase otimista + explicação factual + CTA útil.
- Toasts: curtos, `role=status`, sem bloquear interação; Mint para sucesso, Pink para favorito, Coral para erro.

## Imagens e assets

- Preservar imagens reais dos produtos e suas proporções; usar fallback somente quando ausentes/inválidas.
- Hero pode usar `src/assets/brand/kicks-happy-hero.png`, ilustração original e sem marca, como fallback/camada editorial. Produto real continua protagonista quando a API oferece imagem válida.
- Imagens de catálogo abaixo da dobra: `loading=lazy`, `decoding=async`; hero: prioridade alta.
- Não usar fotos externas adicionais, logos de terceiros ou imagens que sugiram produtos não cadastrados.

## Motion

- Motion comunica leveza, não espetáculo: opacity, translate e scale; 160ms rápido, 260ms padrão, 420–520ms editorial.
- Easing: `cubic-bezier(.2,.8,.2,1)` e spring leve `cubic-bezier(.22,1.3,.36,1)`.
- Header compacta; cards elevam 3–5px; favorito pulsa uma vez; toast entra suavemente; hero troca mídia em fade/translate curto.
- Nenhum confete contínuo, parallax de cursor ou loop decorativo obrigatório.
- `prefers-reduced-motion`: remover autoplay, smooth scroll e transforms não essenciais; preservar feedback instantâneo.

## Acessibilidade, SEO e performance

- WCAG AA; foco de 3px em azul `#096A9F`; labels explícitos; HTML semântico; heading hierarchy; regiões e estados anunciados.
- Touch targets ≥44px; teclado e Escape nos overlays; foco restaurado ao gatilho.
- `min-width: 320px`; não permitir overflow horizontal em 320–430px.
- Product schema e breadcrumbs somente com dados reais. Canonical e metas por rota.
- Preferir CSS para motion simples; lazy-load de páginas e overlays pesados; não adicionar bibliotecas decorativas.
- Fonte no máximo Bricolage Grotesque + DM Sans. Imagem hero otimizada e responsive antes do deploy.

## Restrições duras

1. Usar somente as fontes, cores, espaçamentos e estilos deste documento.
2. Não voltar a dark mode, neon, cyberpunk, estética agressiva ou visual infantil.
3. Não modificar contratos de autenticação, CSRF, checkout, estoque, pedidos, imagens ou proxy same-origin.
4. Não expor o painel admin na navegação pública principal.
5. Não mostrar benefícios, promoções, descontos, reviews ou categorias sem evidência real.
6. Preservar o Sol Kicks, a headline “Calce a felicidade.” e a identidade clara e premium.
