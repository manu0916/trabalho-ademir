import { useMemo, useRef } from 'react';
import { ArrowRight, Search, Sparkles, X } from 'lucide-react';
import useModalAccessibility from '../hooks/useModalAccessibility';
import SafeImage from './ui/SafeImage';
import '../styles/navigation.css';

const PRICE_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const EMPTY_PRODUCTS = [];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function productImage(product) {
  if (product?.imageUrl) return product.imageUrl;
  if (!Array.isArray(product?.images)) return '';

  const image = [...product.images]
    .sort((first, second) => Number(first?.sortOrder || 0) - Number(second?.sortOrder || 0))
    .find((item) => item?.imageUrl || item?.url);
  return image?.imageUrl || image?.url || '';
}

function catalogTrends(products) {
  const counts = new Map();

  products.forEach((product) => {
    [product?.brand, product?.category].filter(Boolean).forEach((label) => {
      const normalized = normalizeText(label);
      if (!normalized) return;
      const previous = counts.get(normalized);
      counts.set(normalized, {
        label: previous?.label || String(label).trim(),
        count: (previous?.count || 0) + 1,
      });
    });
  });

  return [...counts.values()]
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, 'pt-BR'))
    .slice(0, 6);
}

export default function SearchOverlay({
  isOpen,
  onClose,
  products = EMPTY_PRODUCTS,
  query = '',
  onQueryChange,
  onSelectProduct,
  onViewCatalog,
}) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const resultRefs = useRef([]);
  const safeProducts = useMemo(
    () => (Array.isArray(products) ? products.filter(Boolean) : EMPTY_PRODUCTS),
    [products],
  );
  const normalizedQuery = normalizeText(query);

  const results = useMemo(() => {
    if (!normalizedQuery) return safeProducts.slice(0, 6);

    return safeProducts
      .filter((product) => (
        [product.name, product.brand, product.category, product.description]
          .filter(Boolean)
          .some((value) => normalizeText(value).includes(normalizedQuery))
      ))
      .slice(0, 8);
  }, [normalizedQuery, safeProducts]);

  const trends = useMemo(() => catalogTrends(safeProducts), [safeProducts]);

  useModalAccessibility({
    isOpen,
    dialogRef,
    initialFocusRef: inputRef,
    onClose,
  });

  if (!isOpen) return null;

  const chooseProduct = (product) => {
    onSelectProduct?.(product);
    onClose?.();
  };

  const handleProductClick = (event, product) => {
    if (
      !onSelectProduct
      || event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;
    event.preventDefault();
    chooseProduct(product);
  };

  const viewCatalog = () => {
    onViewCatalog?.();
    onClose?.();
  };

  const focusResult = (index) => {
    const total = results.length;
    if (!total) return;
    resultRefs.current[(index + total) % total]?.focus();
  };

  const handleInputKeyDown = (event) => {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      focusResult(0);
    } else if (event.key === 'Enter' && results[0]) {
      event.preventDefault();
      chooseProduct(results[0]);
    }
  };

  const handleResultKeyDown = (event, index) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusResult(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index === 0) inputRef.current?.focus();
      else focusResult(index - 1);
    }
  };

  return (
    <div
      className="search-overlay"
      data-modal-root="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        className="search-overlay__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-overlay-title"
        aria-describedby="search-overlay-description"
        tabIndex={-1}
      >
        <header className="search-overlay__header">
          <div>
            <span className="search-overlay__eyebrow"><Sparkles aria-hidden="true" /> Encontre seu próximo favorito</span>
            <h2 id="search-overlay-title">Qual vai ser seu próximo par?</h2>
            <p id="search-overlay-description">Busque por nome, categoria ou descrição no catálogo real da Kicks Store.</p>
          </div>
          <button type="button" className="search-overlay__close" onClick={onClose} aria-label="Fechar pesquisa">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="search-overlay__field-wrap">
          <Search aria-hidden="true" />
          <label className="search-overlay__sr-only" htmlFor="kicks-search-input">Pesquisar produtos</label>
          <input
            ref={inputRef}
            id="kicks-search-input"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => onQueryChange?.(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ex.: tênis, basquete, performance..."
          />
          {query && (
            <button
              type="button"
              className="search-overlay__clear"
              onClick={() => {
                onQueryChange?.('');
                inputRef.current?.focus();
              }}
              aria-label="Limpar pesquisa"
            >
              Limpar
            </button>
          )}
        </div>

        {!normalizedQuery && trends.length > 0 && (
          <section className="search-overlay__trends" aria-labelledby="search-trends-title">
            <h3 id="search-trends-title">Categorias no catálogo</h3>
            <div className="search-overlay__chips">
              {trends.map((trend) => (
                <button
                  type="button"
                  key={normalizeText(trend.label)}
                  onClick={() => {
                    onQueryChange?.(trend.label);
                    inputRef.current?.focus();
                  }}
                >
                  {trend.label}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="search-overlay__results-heading">
          <h3>{normalizedQuery ? 'Sugestões para você' : 'Explore o catálogo'}</h3>
          <span aria-live="polite">
            {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>

        {results.length > 0 ? (
          <ul className="search-overlay__results" aria-label="Resultados da pesquisa">
            {results.map((product, index) => {
              const imageUrl = productImage(product);
              const stock = Number(product.stockQuantity);
              const isUnavailable = Number.isFinite(stock) && stock <= 0;

              return (
                <li key={product.id ?? `${product.name}-${index}`}>
                  <a
                    ref={(element) => { resultRefs.current[index] = element; }}
                    href={`/produto/${encodeURIComponent(product.id)}`}
                    className="search-result"
                    onClick={(event) => handleProductClick(event, product)}
                    onKeyDown={(event) => handleResultKeyDown(event, index)}
                  >
                    <span className="search-result__image" aria-hidden="true">
                      <SafeImage src={imageUrl} alt="" loading="lazy" fallback={<Sparkles />} />
                    </span>
                    <span className="search-result__copy">
                      <small>{product.brand || product.category || 'Sneaker'}</small>
                      <strong>{product.name || 'Produto sem nome'}</strong>
                      <span>{Number.isFinite(Number(product.price)) ? PRICE_FORMATTER.format(Number(product.price)) : 'Ver detalhes'}</span>
                    </span>
                    {isUnavailable && <span className="search-result__status">Esgotado</span>}
                    <ArrowRight className="search-result__arrow" aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="search-overlay__empty" role="status">
            <span aria-hidden="true"><Search /></span>
            <h3>{safeProducts.length ? 'Ainda não rolou match.' : 'O catálogo está se preparando.'}</h3>
            <p>
              {safeProducts.length
                ? 'Tente outro nome, categoria ou descrição — seu próximo favorito pode estar bem perto.'
                : 'Assim que os produtos estiverem disponíveis, eles aparecerão por aqui.'}
            </p>
            {normalizedQuery && safeProducts.length > 0 && (
              <button type="button" onClick={() => onQueryChange?.('')}>Ver todos os produtos</button>
            )}
          </div>
        )}

        <footer className="search-overlay__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> para navegar · <kbd>Esc</kbd> para fechar</span>
          <a
            href="/sneakers"
            onClick={(event) => {
              if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              viewCatalog();
            }}
          >
            Ver coleção completa <ArrowRight aria-hidden="true" />
          </a>
        </footer>
      </section>
    </div>
  );
}
