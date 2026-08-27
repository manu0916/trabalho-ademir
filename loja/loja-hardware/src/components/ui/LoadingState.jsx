import KicksSun from './KicksSun';

export function PageLoading({ label = 'Preparando a vitrine...' }) {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <KicksSun className="page-loading-sun" />
      <strong>{label}</strong>
      <span className="sr-only">Carregando</span>
    </div>
  );
}

export function ProductSkeletons({ count = 4 }) {
  return (
    <div className="product-skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="product-skeleton" key={index}>
          <span className="product-skeleton-media" />
          <span className="product-skeleton-line is-short" />
          <span className="product-skeleton-line" />
          <span className="product-skeleton-line is-price" />
        </div>
      ))}
    </div>
  );
}
