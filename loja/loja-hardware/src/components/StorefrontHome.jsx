import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CircleUserRound,
  CloudSun,
  Heart,
  Layers3,
  PackageCheck,
  Palette,
  Sparkles,
  Sun,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { getCategoryLabel, normalizeCatalogText } from '../utils/catalogCategories';
import ProductCard from './ProductCard';
import StoreHero from './StoreHero';
import '../styles/home.css';

const COLOR_MOODS = Object.freeze([
  { id: 'sun', label: 'Amarelo & dourado', tone: 'sun', terms: ['amarelo', 'yellow', 'dourado', 'gold'] },
  { id: 'sky', label: 'Azul', tone: 'sky', terms: ['azul', 'blue', 'marinho', 'navy'] },
  { id: 'rose', label: 'Rosa', tone: 'rose', terms: ['rosa', 'pink', 'rose'] },
  { id: 'mint', label: 'Verde', tone: 'mint', terms: ['verde', 'green', 'menta', 'mint', 'lima', 'lime'] },
  { id: 'coral', label: 'Laranja & coral', tone: 'coral', terms: ['laranja', 'orange', 'coral'] },
  { id: 'lavender', label: 'Roxo & lilás', tone: 'lavender', terms: ['roxo', 'purple', 'lilas', 'violeta', 'lavender'] },
  { id: 'cloud', label: 'Branco', tone: 'cloud', terms: ['branco', 'white', 'off white', 'creme'] },
  { id: 'ink', label: 'Preto', tone: 'ink', terms: ['preto', 'black', 'grafite'] },
]);

const MATCH_PROFILES = Object.freeze([
  {
    id: 'movimento',
    label: 'Movimento',
    Icon: Zap,
    terms: ['performance', 'corrida', 'run', 'basquete', 'volei', 'handball', 'handebol', 'futsal', 'futebol', 'tracao', 'estabilidade'],
  },
  {
    id: 'conforto',
    label: 'Conforto',
    Icon: CloudSun,
    terms: ['confort', 'amortecimento', 'leve', 'macio', 'casual', 'lifestyle'],
  },
  {
    id: 'cor',
    label: 'Quero cor',
    Icon: Palette,
    terms: COLOR_MOODS.flatMap((mood) => mood.terms),
  },
  {
    id: 'classico',
    label: 'Clássico',
    Icon: Layers3,
    terms: ['classico', 'retro', 'heritage', 'tradicional', 'iconico'],
  },
  {
    id: 'presenca',
    label: 'Mais presença',
    Icon: Sparkles,
    terms: ['street', 'especial', 'vibrante', 'colorido', 'ousad', 'edicao'],
  },
]);

const KICKS_STORIES = Object.freeze([
  {
    id: 'rotina',
    index: '01',
    title: 'O par certo começa na rotina',
    copy: 'Pense onde você mais vai usar o sneaker e escolha o equilíbrio entre movimento, conforto e expressão que faz sentido para o seu dia.',
    Icon: Sun,
  },
  {
    id: 'cor',
    index: '02',
    title: 'Cor muda o ritmo do look',
    copy: 'Um tom vibrante pode conduzir a composição; uma base neutra abre espaço para explorar texturas e proporções.',
    Icon: Palette,
  },
  {
    id: 'cuidado',
    index: '03',
    title: 'Cuidar também faz parte do caminho',
    copy: 'Ventilação, limpeza adequada ao material e armazenamento longe de umidade ajudam a manter cada par pronto para a próxima saída.',
    Icon: BookOpen,
  },
]);

function productText(product) {
  return normalizeCatalogText([
    product?.name,
    product?.category,
    product?.description,
  ].filter(Boolean).join(' '));
}

function includesAnyTerm(product, terms) {
  const searchableWords = productText(product).replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const searchableText = ` ${searchableWords.join(' ')} `;
  return terms.some((term) => {
    const normalizedTerm = normalizeCatalogText(term).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!normalizedTerm) return false;
    if (normalizedTerm.includes(' ')) return searchableText.includes(` ${normalizedTerm} `);
    return searchableWords.some((word) => word === normalizedTerm || word.startsWith(normalizedTerm));
  });
}

function includesAnyColorWord(product, terms) {
  const searchableWords = ` ${productText(product).replace(/[^a-z0-9]+/g, ' ')} `;
  return terms.some((term) => {
    const normalizedTerm = normalizeCatalogText(term).replace(/[^a-z0-9]+/g, ' ').trim();
    return normalizedTerm && searchableWords.includes(` ${normalizedTerm} `);
  });
}

function isProductInStock(product) {
  const stockQuantity = Number(product?.stockQuantity);
  return Number.isFinite(stockQuantity) && stockQuantity > 0;
}

function realCategories(products) {
  const categories = new Map();
  products.forEach((product) => {
    const rawCategory = String(product?.category || '').trim();
    const label = rawCategory ? getCategoryLabel(rawCategory, rawCategory) : '';
    const key = normalizeCatalogText(label);
    if (!key) return;
    const current = categories.get(key) || { id: key, label, products: [] };
    current.products.push(product);
    categories.set(key, current);
  });
  return Array.from(categories.values());
}

export default function StorefrontHome({
  products = [],
  isLoading = false,
  error = '',
  heroSettings,
  onExplore,
  onOpenProduct,
  onAddToCart,
  wishlistIds = [],
  onToggleWishlist,
  onOpenAccount,
  customerSession,
  onRetry,
}) {
  const catalogProducts = useMemo(() => (Array.isArray(products) ? products.filter(Boolean) : []), [products]);
  const availableProducts = useMemo(
    () => catalogProducts.filter(isProductInStock),
    [catalogProducts],
  );
  const categories = useMemo(() => realCategories(catalogProducts), [catalogProducts]);
  const colorMoods = useMemo(() => COLOR_MOODS.map((mood) => ({
    ...mood,
    products: catalogProducts.filter((product) => includesAnyColorWord(product, mood.terms)),
  })).filter((mood) => mood.products.length > 0), [catalogProducts]);
  const wishlistIdSet = useMemo(
    () => new Set((Array.isArray(wishlistIds) ? wishlistIds : []).map(String)),
    [wishlistIds],
  );
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMood, setSelectedMood] = useState('');
  const [selectedMatch, setSelectedMatch] = useState('movimento');

  const effectiveCategory = selectedCategory === 'all' || categories.some((category) => category.id === selectedCategory)
    ? selectedCategory
    : 'all';
  const energyProducts = effectiveCategory === 'all'
    ? catalogProducts.slice(0, 8)
    : categories.find((category) => category.id === effectiveCategory)?.products.slice(0, 8) || [];
  const effectiveMood = colorMoods.find((mood) => mood.id === selectedMood) || colorMoods[0];
  const activeMatchProfile = MATCH_PROFILES.find((profile) => profile.id === selectedMatch) || MATCH_PROFILES[0];
  const matchProducts = availableProducts.filter((product) => includesAnyTerm(product, activeMatchProfile.terms)).slice(0, 4);
  const arrivals = catalogProducts.slice(0, 4);
  const happyPicks = availableProducts.slice(0, 4);
  const editorialMatch = availableProducts[0] || null;

  const renderProductCard = (product, className = '') => (
    <ProductCard
      key={product.id ?? product.name}
      product={product}
      onOpenProduct={onOpenProduct}
      onAddToCart={onAddToCart}
      isWishlisted={wishlistIdSet.has(String(product.id))}
      onToggleWishlist={onToggleWishlist}
      className={className}
    />
  );

  return (
    <main id="main-content" className="storefront-home" tabIndex="-1">
      <StoreHero
        products={catalogProducts}
        heroSettings={heroSettings}
        onExplore={onExplore}
        onOpenProduct={onOpenProduct}
        onAddToCart={onAddToCart}
      />

      {error && (
        <div className="happy-catalog-alert" role="alert">
          <strong>A vitrine não conseguiu atualizar agora.</strong>
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <CatalogSkeleton />
      ) : error && catalogProducts.length === 0 ? (
        <section className="happy-empty-catalog" aria-labelledby="catalog-error-title" role="alert">
          <div className="happy-empty-catalog__mark" aria-hidden="true"><Sparkles /></div>
          <p className="happy-section-kicker">Vitrine indisponível</p>
          <h2 id="catalog-error-title">Não conseguimos buscar o catálogo agora.</h2>
          <p>Confira sua conexão e tente novamente. Nenhum produto de demonstração foi inserido.</p>
          <button
            type="button"
            className="happy-button happy-button--ink"
            onClick={onRetry || (() => window.location.reload())}
          >
            Tentar novamente
          </button>
        </section>
      ) : catalogProducts.length === 0 ? (
        <section className="happy-empty-catalog" aria-labelledby="empty-catalog-title">
          <div className="happy-empty-catalog__mark" aria-hidden="true"><Sparkles /></div>
          <p className="happy-section-kicker">Vitrine em preparação</p>
          <h2 id="empty-catalog-title">Os próximos favoritos ainda estão chegando.</h2>
          <p>Assim que houver produtos cadastrados, eles aparecerão aqui sem conteúdo de demonstração.</p>
        </section>
      ) : (
        <>
          <section className="happy-section happy-section--arrivals" aria-labelledby="arrivals-title">
            <SectionHeading
              kicker="Na ordem do catálogo"
              title="Acabaram de chegar"
              description="Os primeiros pares recebidos da API, apresentados sem alterar a ordem ou criar rótulos comerciais."
              id="arrivals-title"
            />
            <div className="happy-product-grid">
              {arrivals.map((product) => renderProductCard(product))}
            </div>
          </section>

          <section className="happy-section happy-section--energy" aria-labelledby="energy-title">
            <SectionHeading
              kicker="Explore o catálogo"
              title="Escolha sua energia"
              description="Cada opção abaixo vem das categorias cadastradas na loja."
              id="energy-title"
            />

            <div className="happy-filter-row" role="group" aria-label="Filtrar por categoria">
              <button
                type="button"
                className={effectiveCategory === 'all' ? 'is-active' : ''}
                onClick={() => setSelectedCategory('all')}
                aria-pressed={effectiveCategory === 'all'}
              >
                Todas
                <span>{catalogProducts.length}</span>
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={effectiveCategory === category.id ? 'is-active' : ''}
                  onClick={() => setSelectedCategory(category.id)}
                  aria-pressed={effectiveCategory === category.id}
                >
                  {category.label}
                  <span>{category.products.length}</span>
                </button>
              ))}
            </div>

            <div className="happy-product-grid happy-product-grid--energy">
              {energyProducts.map((product) => renderProductCard(product))}
            </div>
          </section>

          <section className="happy-section happy-section--picks" aria-labelledby="picks-title">
            <SectionHeading
              kicker="Curadoria editorial"
              title="Happy Picks"
              description="Uma seleção visual entre os produtos disponíveis. Não é ranking, tendência ou dado de popularidade."
              id="picks-title"
              icon={WandSparkles}
            />
            {happyPicks.length > 0 ? (
              <div className="happy-product-grid">
                {happyPicks.map((product) => renderProductCard(product))}
              </div>
            ) : (
              <HonestEmpty message="Ainda não há produtos disponíveis para esta curadoria." />
            )}
          </section>

          <section className="happy-section happy-section--mood" aria-labelledby="mood-title">
            <SectionHeading
              kicker="Color Mood"
              title="Qual cor combina com seu dia?"
              description="A seleção considera somente palavras de cor presentes no nome, categoria ou descrição dos produtos."
              id="mood-title"
              icon={Palette}
            />

            {colorMoods.length > 0 ? (
              <>
                <div className="happy-mood-row" role="group" aria-label="Filtrar por cor descrita no catálogo">
                  {colorMoods.map((mood) => (
                    <button
                      key={mood.id}
                      type="button"
                      className={`happy-mood-chip happy-mood-chip--${mood.tone} ${effectiveMood?.id === mood.id ? 'is-active' : ''}`.trim()}
                      onClick={() => setSelectedMood(mood.id)}
                      aria-pressed={effectiveMood?.id === mood.id}
                    >
                      <span aria-hidden="true" />
                      {mood.label}
                      <small>{mood.products.length}</small>
                    </button>
                  ))}
                </div>
                <div className="happy-product-grid">
                  {effectiveMood?.products.slice(0, 4).map((product) => renderProductCard(product))}
                </div>
              </>
            ) : (
              <HonestEmpty message="O catálogo ainda não descreve cores nos campos disponíveis. Quando esses dados existirem, os moods aparecerão aqui." />
            )}
          </section>

          <section className="happy-section happy-section--match" aria-labelledby="match-title">
            <SectionHeading
              kicker="Kicks Match"
              title="Qual é a vibe de hoje?"
              description="Escolha uma intenção. O resultado cruza termos reais das categorias e descrições do catálogo."
              id="match-title"
              icon={Sparkles}
            />

            <div className="happy-match-options" role="group" aria-label="Escolher intenção para o Kicks Match">
              {MATCH_PROFILES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={activeMatchProfile.id === id ? 'is-active' : ''}
                  onClick={() => setSelectedMatch(id)}
                  aria-pressed={activeMatchProfile.id === id}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {matchProducts.length > 0 ? (
              <div className="happy-product-grid">
                {matchProducts.map((product) => renderProductCard(product))}
              </div>
            ) : (
              <HonestEmpty message={`Nenhum produto disponível menciona os termos ligados a “${activeMatchProfile.label}” no catálogo atual.`} />
            )}
          </section>

          <section className="happy-section happy-section--daily" aria-labelledby="daily-title">
            <div className="happy-daily-copy">
              <p className="happy-section-kicker">Seleção editorial do dia</p>
              <h2 id="daily-title">Seu match de hoje</h2>
              <p>
                Esta escolha usa o primeiro produto disponível na ordem da API. É uma apresentação editorial, não uma recomendação personalizada.
              </p>
              {editorialMatch && onOpenProduct && (
                <button type="button" className="happy-button happy-button--ink" onClick={() => onOpenProduct(editorialMatch)}>
                  Conhecer este par
                  <ArrowRight aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="happy-daily-product">
              {editorialMatch
                ? renderProductCard(editorialMatch, 'happy-product-card--editorial')
                : <HonestEmpty message="Ainda não há um produto disponível para a seleção editorial." />}
            </div>
          </section>

          <section className="happy-section happy-section--stories" aria-labelledby="stories-title">
            <SectionHeading
              kicker="Kicks Stories"
              title="Ideias para caminhar do seu jeito"
              description="Notas editoriais para inspirar escolhas, combinações e cuidados."
              id="stories-title"
              icon={BookOpen}
            />
            <div className="happy-stories-grid">
              {KICKS_STORIES.map(({ id, index, title, copy, Icon }) => (
                <article key={id} className="happy-story-card">
                  <div className="happy-story-card__top">
                    <span>{index}</span>
                    <Icon aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="happy-section happy-section--club" aria-labelledby="club-title">
            <div className="happy-club__intro">
              <p className="happy-section-kicker">Kicks Club</p>
              <h2 id="club-title">Seu espaço para continuar a história.</h2>
              <p>
                {customerSession
                  ? `Olá, ${customerSession.username || 'você'}. Sua conta está conectada.`
                  : 'Entre para organizar seus dados e acessar com segurança o que estiver ligado à sua conta.'}
              </p>
              {onOpenAccount && (
                <button type="button" className="happy-button happy-button--primary" onClick={onOpenAccount}>
                  <CircleUserRound aria-hidden="true" />
                  {customerSession ? 'Abrir minha conta' : 'Entrar ou criar conta'}
                </button>
              )}
            </div>

            <div className="happy-club__benefits">
              <article>
                <CircleUserRound aria-hidden="true" />
                <div><h3>Conta</h3><p>Mantenha seus dados e endereços organizados.</p></div>
              </article>
              <article>
                <Heart aria-hidden="true" />
                <div><h3>Favoritos</h3><p>Salve pares neste dispositivo para rever depois.</p></div>
              </article>
              <article>
                <PackageCheck aria-hidden="true" />
                <div><h3>Pedidos</h3><p>Consulte com segurança pedidos associados à sua sessão.</p></div>
              </article>
            </div>
          </section>

          {onExplore && (
            <div className="happy-home-closer">
              <p>A vitrine continua.</p>
              <button type="button" className="happy-button happy-button--ink" onClick={onExplore}>
                Ver catálogo completo
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function SectionHeading({ kicker, title, description, id, icon: Icon = Sparkles }) {
  return (
    <header className="happy-section-heading">
      <div className="happy-section-heading__icon" aria-hidden="true"><Icon /></div>
      <div>
        <p className="happy-section-kicker">{kicker}</p>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  );
}

function HonestEmpty({ message }) {
  return (
    <div className="happy-honest-empty" role="status">
      <Sparkles aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <section className="happy-section happy-loading" aria-busy="true" aria-live="polite">
      <span className="happy-loading__sr">Carregando produtos do catálogo.</span>
      <div className="happy-loading__heading" aria-hidden="true" />
      <div className="happy-product-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => <div key={item} className="happy-loading__card" />)}
      </div>
    </section>
  );
}
