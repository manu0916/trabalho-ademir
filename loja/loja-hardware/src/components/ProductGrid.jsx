import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, RotateCcw, SearchX, SlidersHorizontal, Sparkles } from 'lucide-react';
import { normalizeCatalogText } from '../utils/catalogCategories';
import ProductCard from './ProductCard';
import KicksSun from './ui/KicksSun';
import { ProductSkeletons } from './ui/LoadingState';
import '../styles/catalog.css';

const SORT_OPTIONS = [
  { value: 'featured', label: 'Ordem da vitrine' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'name', label: 'Nome A–Z' },
];

function getCategory(product) {
  return String(product?.category || 'Outros').trim() || 'Outros';
}

export default function ProductGrid({
  products = [],
  onAddToCart,
  searchQuery = '',
  onClearSearch,
  wishlistIds = [],
  onToggleWishlist,
  onOpenProduct,
  isLoading = false,
  error = '',
  mode = 'catalog',
}) {
  const sectionRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const routeMain = sectionRef.current?.closest('main#main-content');
    routeMain?.setAttribute('tabindex', '-1');
  }, []);

  const categories = useMemo(() => {
    const counts = new Map();
    products.forEach((product) => {
      const category = getCategory(product);
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (mode === 'offers') return [];
    const normalizedQuery = normalizeCatalogText(searchQuery);
    const next = products.filter((product) => {
      if (activeCategory !== 'all' && getCategory(product) !== activeCategory) return false;
      if (onlyAvailable && Number(product.stockQuantity) <= 0) return false;
      if (!normalizedQuery) return true;
      return [product.name, product.category, product.description]
        .filter(Boolean)
        .some((value) => normalizeCatalogText(value).includes(normalizedQuery));
    });

    if (sortBy === 'price-asc') return next.sort((a, b) => Number(a.price) - Number(b.price));
    if (sortBy === 'price-desc') return next.sort((a, b) => Number(b.price) - Number(a.price));
    if (sortBy === 'name') return next.sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    return next;
  }, [activeCategory, mode, onlyAvailable, products, searchQuery, sortBy]);

  const hasFilters = activeCategory !== 'all' || onlyAvailable || Boolean(searchQuery.trim());
  const resetFilters = () => {
    setActiveCategory('all');
    setOnlyAvailable(false);
    onClearSearch?.();
  };

  const heading = mode === 'new'
    ? { eyebrow: 'Últimos cadastros', title: 'Acabaram de chegar', description: 'Os pares aparecem na mesma ordem atualizada pela loja.' }
    : mode === 'offers'
      ? { eyebrow: 'Transparência primeiro', title: 'Ofertas', description: 'O catálogo atual não fornece preço anterior ou desconto, então esta página não cria promoções por conta própria.' }
      : { eyebrow: 'Todos os caminhos levam ao seu par', title: 'Explore os sneakers', description: 'Filtre o catálogo real e encontre o que combina com o seu momento.' };

  return (
    <section ref={sectionRef} id="products" className="catalog-page-section" aria-labelledby="catalog-title">
      <div className="catalog-heading">
        <div>
          <p className="eyebrow">{heading.eyebrow}</p>
          <h1 id="catalog-title">{heading.title}</h1>
          <p>{heading.description}</p>
        </div>
        {!isLoading && !error && (
          <div className="catalog-total" role="status" aria-live="polite">
            <strong>{String(visibleProducts.length).padStart(2, '0')}</strong>
            <span>{visibleProducts.length === 1 ? 'par encontrado' : 'pares encontrados'}</span>
          </div>
        )}
      </div>

      {mode !== 'offers' && (
        <div className={`catalog-tools ${filtersOpen ? 'is-open' : ''}`}>
          <button
            type="button"
            className="catalog-filter-toggle button button-secondary"
            onClick={() => setFiltersOpen((current) => !current)}
            aria-expanded={filtersOpen}
            aria-controls="catalog-filters"
          >
            <SlidersHorizontal size={17} aria-hidden="true" /> Filtros
          </button>

          <div id="catalog-filters" className="catalog-filters">
            <div className="catalog-category-list" aria-label="Filtrar por categoria">
              <button type="button" className={activeCategory === 'all' ? 'is-active' : ''} onClick={() => setActiveCategory('all')} aria-pressed={activeCategory === 'all'}>
                Todos <span>{products.length}</span>
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={category.label}
                  className={activeCategory === category.label ? 'is-active' : ''}
                  onClick={() => setActiveCategory(category.label)}
                  aria-pressed={activeCategory === category.label}
                >
                  {category.label} <span>{category.count}</span>
                </button>
              ))}
            </div>

            <div className="catalog-filter-actions">
              <label className="available-switch">
                <input type="checkbox" checked={onlyAvailable} onChange={(event) => setOnlyAvailable(event.target.checked)} />
                <span aria-hidden="true" />
                Somente em estoque
              </label>
              <label className="catalog-sort">
                <ArrowDownUp size={16} aria-hidden="true" />
                <span className="sr-only">Ordenar catálogo</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <ProductSkeletons count={8} />
      ) : error ? (
        <div className="catalog-state catalog-state-error" role="alert">
          <KicksSun />
          <p className="eyebrow">A vitrine fez uma pausa</p>
          <h2>Não conseguimos trazer o catálogo agora.</h2>
          <p>{error}</p>
          <button type="button" className="button button-secondary" onClick={() => window.location.reload()}><RotateCcw size={17} /> Tentar de novo</button>
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="catalog-state" role="status">
          {mode === 'offers' ? <Sparkles aria-hidden="true" /> : <SearchX aria-hidden="true" />}
          <p className="eyebrow">{mode === 'offers' ? 'Transparência primeiro' : 'Ainda não rolou match'}</p>
          <h2>{mode === 'offers' ? 'Nenhuma oferta oficial cadastrada agora.' : 'Nenhum par apareceu com esses filtros.'}</h2>
          <p>{mode === 'offers' ? 'Nenhum desconto pode ser confirmado com os campos disponíveis hoje. O catálogo completo continua acessível em Sneakers.' : 'Tente outra categoria ou limpe os filtros para voltar ao catálogo completo.'}</p>
          {hasFilters && <button type="button" className="button button-primary" onClick={resetFilters}><RotateCcw size={17} /> Limpar filtros</button>}
        </div>
      ) : (
        <div className="catalog-product-grid">
          {visibleProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              onOpenProduct={onOpenProduct}
              onAddToCart={onAddToCart}
              isWishlisted={wishlistIds.includes(product.id)}
              onToggleWishlist={onToggleWishlist}
            />
          ))}
        </div>
      )}
    </section>
  );
}
