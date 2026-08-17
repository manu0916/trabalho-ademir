import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getProductImages } from '../utils/productImages';
import {
  ALL_CATEGORIES_ID,
  CATALOG_CATEGORIES,
  getCategoryId,
  getCategoryLabel,
} from '../utils/catalogCategories';

export default function ProductGrid({ products, onAddToCart, theme, searchQuery = '', onClearSearch }) {
  const [activeCategoryId, setActiveCategoryId] = useState(ALL_CATEGORIES_ID);
  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(CATALOG_CATEGORIES.map((category) => [category.id, 0]));
    counts[ALL_CATEGORIES_ID] = products.length;
    products.forEach((product) => {
      const categoryId = getCategoryId(product.category);
      if (categoryId) counts[categoryId] += 1;
    });
    return counts;
  }, [products]);
  const visibleProducts = useMemo(() => (
    activeCategoryId === ALL_CATEGORIES_ID
      ? products
      : products.filter((product) => getCategoryId(product.category) === activeCategoryId)
  ), [activeCategoryId, products]);
  const activeCategory = CATALOG_CATEGORIES.find((category) => category.id === activeCategoryId) ?? CATALOG_CATEGORIES[0];
  const hasSearch = searchQuery.trim().length > 0;
  const activeScope = activeCategoryId === ALL_CATEGORIES_ID ? 'no catálogo completo' : `em ${activeCategory.label}`;
  const resultSummary = `${visibleProducts.length} ${visibleProducts.length === 1 ? 'tênis encontrado' : 'tênis encontrados'} ${activeScope}${hasSearch ? ` para a busca “${searchQuery.trim()}”` : ''}.`;

  return (
    <section id="products" className="collection-section mx-auto max-w-[90rem] px-5 py-20 sm:px-8 sm:py-28">
      <div className="collection-heading mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="collection-title-group">
          <p className="section-kicker">{activeCategoryId === ALL_CATEGORIES_ID ? 'A vitrine da semana' : 'Modalidade selecionada'}</p>
          <h2 className="section-title">{activeCategoryId === ALL_CATEGORIES_ID ? theme.collectionLabel : `${activeCategory.label} em foco`}</h2>
        </div>
        <div className="collection-heading-side">
          <span className="collection-count">{String(visibleProducts.length).padStart(2, '0')} itens</span>
          <p className="collection-intro max-w-xs text-sm leading-6">{activeCategoryId === ALL_CATEGORIES_ID ? 'Todos os estilos, em uma única curadoria.' : activeCategory.description}</p>
        </div>
      </div>

      <div className="catalog-navigation">
        <div className="catalog-navigation-heading">
          <div>
            <span>Escolha seu jogo</span>
            <strong>Explore por modalidade</strong>
          </div>
          <p>Abra uma divisão por vez ou mantenha o catálogo completo.</p>
        </div>
        <nav className="catalog-category-nav" aria-label="Filtrar catálogo por modalidade">
          <div className="catalog-category-list">
            {CATALOG_CATEGORIES.map((category) => {
              const isActive = category.id === activeCategoryId;
              const count = categoryCounts[category.id] ?? 0;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`catalog-category-button ${isActive ? 'is-active' : ''}`}
                  aria-pressed={isActive}
                  aria-controls="catalog-products-grid"
                  aria-label={`${category.label}: ${count} ${count === 1 ? 'produto' : 'produtos'}`}
                  onClick={() => setActiveCategoryId(category.id)}
                >
                  <span className="catalog-category-index" aria-hidden="true">{category.index}</span>
                  <span className="catalog-category-copy">
                    <strong>{category.label}</strong>
                    <small>{category.description}</small>
                  </span>
                  <span className="catalog-category-total" aria-hidden="true">{String(count).padStart(2, '0')}</span>
                </button>
              );
            })}
          </div>
        </nav>
        <p className="catalog-results-status" role="status" aria-live="polite">
          <span aria-hidden="true" />{resultSummary}
        </p>
      </div>

      <div id="catalog-products-grid" className="product-grid" aria-label={`Produtos: ${activeCategory.label}`}>
        {visibleProducts.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            index={index}
            totalProducts={visibleProducts.length}
            onAddToCart={onAddToCart}
            theme={theme}
          />
        ))}
      </div>

      {visibleProducts.length === 0 && (
        <div className="catalog-empty" role="status">
          <span aria-hidden="true">—</span>
          <h3>{hasSearch ? 'Nenhum par por aqui ainda' : activeCategoryId === ALL_CATEGORIES_ID ? 'A vitrine está pronta para receber novidades' : `A divisão ${activeCategory.label} está pronta para receber novidades`}</h3>
          <p>
            {hasSearch
              ? `Não encontramos resultados${activeCategoryId === ALL_CATEGORIES_ID ? '' : ` em ${activeCategory.label}`} para “${searchQuery.trim()}”.`
              : activeCategoryId === ALL_CATEGORIES_ID
                ? 'Assim que novos tênis forem cadastrados, eles aparecerão nesta vitrine.'
                : 'Cadastre um tênis nessa modalidade ou volte ao catálogo completo.'}
          </p>
          <div className="catalog-empty-actions">
            {hasSearch && onClearSearch && <button type="button" onClick={onClearSearch}>Limpar busca</button>}
            {activeCategoryId !== ALL_CATEGORIES_ID && <button type="button" onClick={() => setActiveCategoryId(ALL_CATEGORIES_ID)}>Ver catálogo completo</button>}
          </div>
        </div>
      )}
    </section>
  );
}

function ProductMediaGallery({ product, productIndex, theme }) {
  const allImages = useMemo(() => getProductImages(product), [product]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImageKeys, setFailedImageKeys] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  const galleryRef = useRef(null);
  const images = allImages.filter((image) => !failedImageKeys.includes(image.key));
  const normalizedIndex = images.length > 0 ? activeIndex % images.length : 0;
  const activeImage = images[normalizedIndex];
  const hasGallery = images.length > 1;

  const selectImage = (nextIndex) => {
    setActiveIndex(nextIndex);
    setAnnouncement(`Foto ${nextIndex + 1} de ${images.length} de ${product.name}`);
  };

  const markImageAsFailed = () => {
    if (!activeImage) return;
    const shouldRestoreFocus = galleryRef.current?.contains(document.activeElement);
    const remainingCount = Math.max(0, images.length - 1);
    setFailedImageKeys((current) => current.includes(activeImage.key) ? current : [...current, activeImage.key]);
    setAnnouncement(remainingCount > 0
      ? `Uma foto não pôde ser carregada. Exibindo foto ${(activeIndex % remainingCount) + 1} de ${remainingCount} de ${product.name}.`
      : `As fotos de ${product.name} não puderam ser carregadas.`);
    if (shouldRestoreFocus) {
      window.requestAnimationFrame(() => galleryRef.current?.focus());
    }
  };

  return (
    <div
      ref={galleryRef}
      className={`product-image relative flex items-center justify-center overflow-hidden ${activeImage ? '' : 'image-unavailable'}`}
      role="group"
      aria-roledescription="carrossel"
      aria-label={`Galeria de fotos de ${product.name}`}
      tabIndex="-1"
    >
      {activeImage && (
        <img
          key={activeImage.key}
          src={activeImage.imageUrl}
          alt={activeImage.altText || (hasGallery ? `${product.name}, foto ${normalizedIndex + 1} de ${images.length}` : product.name)}
          onError={markImageAsFailed}
          loading="lazy"
          decoding="async"
          width="720"
          height="720"
          className="product-gallery-image h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      )}
      {hasGallery && (
        <>
          <button type="button" onClick={() => selectImage((normalizedIndex - 1 + images.length) % images.length)} className="product-gallery-arrow is-previous" aria-label={`Mostrar foto anterior de ${product.name}`}>←</button>
          <button type="button" onClick={() => selectImage((normalizedIndex + 1) % images.length)} className="product-gallery-arrow is-next" aria-label={`Mostrar próxima foto de ${product.name}`}>→</button>
          <span className="product-gallery-counter" aria-hidden="true">{normalizedIndex + 1}/{images.length}</span>
        </>
      )}
      <span className="sr-only" aria-live="polite">{announcement}</span>
      <span className="product-index absolute left-4 top-4" aria-hidden="true">{String(productIndex + 1).padStart(2, '0')}</span>
      <span className="product-badge absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs backdrop-blur-md">{theme.productLabel}</span>
      <span className="product-image-corner" aria-hidden="true">{theme.edition}</span>
    </div>
  );
}

function getCardVariant(index, total) {
  if (total >= 3 && index % 6 === 0) return 'featured';
  if (index % 6 === 3) return 'portrait';
  return 'standard';
}

const AVAILABLE_SIZES = ['37', '38', '39', '40', '41', '42', '43', '44'];

function getDefaultColors(product) {
  const stock = product.stockQuantity || 0;
  if (stock <= 0) return [{ name: 'Padrão', stock: 0, hex: '#222' }];

  const stock1 = Math.max(1, Math.ceil(stock * 0.5));
  const stock2 = Math.max(0, Math.floor(stock * 0.3));
  const stock3 = Math.max(0, stock - stock1 - stock2);

  return [
    { name: 'Original Edition', stock: stock1, hex: '#1e1e24' },
    ...(stock2 > 0 ? [{ name: 'Preto & Branco', stock: stock2, hex: '#000000' }] : []),
    ...(stock3 > 0 ? [{ name: 'Edição Especial', stock: stock3, hex: '#e64a19' }] : []),
  ];
}

function ProductCard({ product, index, totalProducts, onAddToCart, theme }) {
  const [selectedSize, setSelectedSize] = useState('40');
  const colors = useMemo(() => getDefaultColors(product), [product]);
  const [selectedColor, setSelectedColor] = useState(() => colors[0]?.name || 'Padrão');

  const activeColorObj = colors.find((c) => c.name === selectedColor) || colors[0];
  const colorStock = activeColorObj?.stock ?? product.stockQuantity;
  const isAvailable = colorStock > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.46, delay: Math.min(index * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className={`product-card product-card-${getCardVariant(index, totalProducts)} group flex flex-col justify-between overflow-hidden rounded-[1.35rem] transition-all duration-300`}
    >
      <ProductMediaGallery product={product} productIndex={index} theme={theme} />

      <div className="product-content flex flex-grow flex-col justify-between p-5">
        <div>
          <span className="product-category">{getCategoryLabel(product.category, theme.category)}</span>
          <h3 className="product-title mb-1 text-lg font-semibold transition-colors">{product.name}</h3>
          <p className="mb-3 line-clamp-2 text-xs text-[var(--muted)]">{product.description || 'Uma escolha especial para a sua coleção.'}</p>

          {/* Color Selector with individual stock */}
          <div className="product-variant-section mt-3 mb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[var(--muted)]">Cor: <b className="text-[var(--text)]">{selectedColor}</b></span>
              <span className={`text-[11px] font-medium ${colorStock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {colorStock > 0 ? `${colorStock} un. nesta cor` : 'Esgotado'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {colors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setSelectedColor(color.name)}
                  className={`color-pill flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${selectedColor === color.name ? 'border-[var(--accent)] bg-[var(--surface-solid)] text-[var(--text)] ring-1 ring-[var(--accent)]' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]'}`}
                  title={`${color.name} (${color.stock} em estoque)`}
                >
                  <span className="w-2.5 h-2.5 rounded-full inline-block border border-white/20" style={{ backgroundColor: color.hex }} />
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size Selector */}
          <div className="product-size-section mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[var(--muted)]">Tamanho: <b className="text-[var(--text)]">{selectedSize}</b></span>
              <span className="text-[11px] text-[var(--muted)]">Padrão BR</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {AVAILABLE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`size-pill min-w-[2.1rem] py-1 px-1.5 text-center text-xs font-semibold rounded-lg border transition-all ${selectedSize === size ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)] shadow-sm font-bold' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)]'}`}
                  aria-pressed={selectedSize === size}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="product-footer mt-auto flex items-center justify-between pt-3 border-t border-[var(--line)]">
          <div>
            <span className="block text-xs text-[var(--muted)]">Preço à vista</span>
            <span className="product-price text-xl font-bold">R$ {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => onAddToCart({ ...product, selectedSize, selectedColor })}
            disabled={!isAvailable}
            className="buy-button cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label={isAvailable ? `Adicionar ${product.name} (Tam ${selectedSize}, Cor ${selectedColor}) à sacola` : `${product.name} esgotado`}
          >
            <span>{isAvailable ? 'Comprar' : 'Esgotado'}</span><b aria-hidden="true">+</b>
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
