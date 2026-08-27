import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { getProductImages } from '../utils/productImages';
import { getCategoryLabel } from '../utils/catalogCategories';
import {
  fetchProductReviews,
  fetchProductReviewEligibility,
  createStockAlert,
  submitProductReview,
} from '../services/api';
import ProductCard from './ProductCard';
import '../styles/product-page.css';

function formatPrice(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function colorStoryClass(product) {
  const source = `${product?.name || ''} ${product?.category || ''} ${product?.description || ''}`.toLocaleLowerCase('pt-BR');
  if (/azul|blue|volei|vôlei/.test(source)) return 'story-sky';
  if (/verde|green|mint|futebol/.test(source)) return 'story-mint';
  if (/rosa|pink|coral|futsal/.test(source)) return 'story-coral';
  if (/roxo|purple|lil[aá]s|handball/.test(source)) return 'story-lavender';
  return 'story-sun';
}

function handleSpaLink(event, callback) {
  if (
    !callback
    || event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) return;

  event.preventDefault();
  callback();
}

function RatingStars({ rating }) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
  return (
    <span className="rating-stars" role="img" aria-label={`${rounded} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, index) => <span key={index} className={index < rounded ? 'is-filled' : ''}>★</span>)}
    </span>
  );
}

export default function ProductPage({
  product,
  relatedProducts = [],
  isLoading,
  error,
  onBack,
  onAddToCart,
  onOpenProduct,
  isWishlisted,
  onToggleWishlist,
  wishlistIds = [],
  customerSession,
  onOpenLogin,
  onRetry,
}) {
  const images = useMemo(() => getProductImages(product), [product]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImageKeys, setFailedImageKeys] = useState([]);
  const [reviewsData, setReviewsData] = useState({ reviews: [], averageRating: 0, totalCount: 0 });
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const reviewRequestRef = useRef(0);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [stockAlertOpen, setStockAlertOpen] = useState(false);
  const [stockAlertEmail, setStockAlertEmail] = useState('');
  const [stockAlertWhatsapp, setStockAlertWhatsapp] = useState('');
  const [stockAlertError, setStockAlertError] = useState('');
  const [stockAlertSuccess, setStockAlertSuccess] = useState('');
  const [isSubmittingStockAlert, setIsSubmittingStockAlert] = useState(false);

  const visibleImages = images.filter((image) => !failedImageKeys.includes(image.key));
  const normalizedIndex = visibleImages.length ? activeImageIndex % visibleImages.length : 0;
  const activeImage = visibleImages[normalizedIndex];

  const loadReviews = useCallback(() => {
    if (!product?.id) return;
    const requestId = reviewRequestRef.current + 1;
    reviewRequestRef.current = requestId;
    setIsLoadingReviews(true);
    setReviewsError('');
    fetchProductReviews(product.id)
      .then((data) => {
        if (reviewRequestRef.current !== requestId) return;
        if (!data || !Array.isArray(data.reviews)) return;
        setReviewsData({
          reviews: data.reviews,
          averageRating: data.totalCount > 0 ? Number(data.averageRating || 0) : 0,
          totalCount: Number(data.totalCount || 0),
        });
      })
      .catch((requestError) => {
        if (reviewRequestRef.current !== requestId) return;
        setReviewsError(requestError.message || 'Não foi possível buscar as avaliações agora.');
      })
      .finally(() => {
        if (reviewRequestRef.current === requestId) setIsLoadingReviews(false);
      });
  }, [product?.id]);

  useEffect(() => {
    setActiveImageIndex(0);
    setFailedImageKeys([]);
    setReviewFormOpen(false);
    setEligibility(null);
    setReviewError('');
    setComment('');
    setStockAlertOpen(false);
    setStockAlertError('');
    setStockAlertSuccess('');
    loadReviews();
    return () => { reviewRequestRef.current += 1; };
  }, [loadReviews, product?.id]);

  const showPrevious = () => setActiveImageIndex((current) => (
    visibleImages.length ? (current - 1 + visibleImages.length) % visibleImages.length : 0
  ));
  const showNext = () => setActiveImageIndex((current) => (
    visibleImages.length ? (current + 1) % visibleImages.length : 0
  ));

  const handleReviewIntent = async () => {
    setReviewFormOpen(true);
    setReviewError('');
    if (!customerSession) {
      setEligibility({ eligible: false, reason: 'Entre na sua conta para avaliar um par comprado.' });
      return;
    }
    try {
      setEligibility(await fetchProductReviewEligibility(product.id));
    } catch (requestError) {
      setEligibility({ eligible: false, reason: requestError.message || 'Não foi possível verificar sua compra.' });
    }
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    const cleanComment = comment.trim();
    if (!cleanComment) {
      setReviewError('Conte em poucas palavras como foi sua experiência.');
      return;
    }
    setIsSubmittingReview(true);
    setReviewError('');
    try {
      await submitProductReview(product.id, { rating, comment: cleanComment });
      setComment('');
      setReviewFormOpen(false);
      setEligibility(null);
      loadReviews();
    } catch (requestError) {
      setReviewError(requestError.message || 'Não foi possível publicar sua avaliação.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleStockAlertSubmit = async (event) => {
    event.preventDefault();
    const email = stockAlertEmail.trim();
    const whatsapp = stockAlertWhatsapp.trim();
    if (!email && !whatsapp) {
      setStockAlertError('Informe um e-mail ou WhatsApp para receber o aviso.');
      return;
    }
    setIsSubmittingStockAlert(true);
    setStockAlertError('');
    setStockAlertSuccess('');
    try {
      await createStockAlert({
        productId: product.id,
        productName: product.name,
        size: '',
        color: '',
        email,
        whatsapp,
      });
      setStockAlertSuccess('Aviso criado. A loja poderá entrar em contato quando houver atualização de estoque.');
      setStockAlertEmail('');
      setStockAlertWhatsapp('');
    } catch (requestError) {
      setStockAlertError(requestError.message || 'Não foi possível criar o aviso agora.');
    } finally {
      setIsSubmittingStockAlert(false);
    }
  };

  if (isLoading) {
    return (
      <main id="main-content" className="product-page product-page-loading" tabIndex={-1} aria-busy="true">
        <span className="product-page-loading-media" />
        <div><span /><span /><span /></div>
        <span className="sr-only">Carregando produto</span>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main id="main-content" className="product-page product-page-error" tabIndex={-1} role="alert">
        <Sparkles aria-hidden="true" />
        <p className="eyebrow">Produto indisponível</p>
        <h1>Não conseguimos abrir este par agora.</h1>
        <p>{error || 'O produto não foi encontrado no catálogo carregado.'}</p>
        <div>
          <button type="button" className="button button-primary" onClick={onRetry || (() => window.location.reload())}>Tentar novamente</button>
          <a className="button button-secondary" href="/sneakers" onClick={(event) => handleSpaLink(event, onBack)}>Voltar ao catálogo</a>
        </div>
      </main>
    );
  }

  const isAvailable = Number(product.stockQuantity) > 0;
  const numericPrice = Number(product.price);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    image: images.map((image) => image.imageUrl),
    category: getCategoryLabel(product.category),
    sku: String(product.id),
    ...(Number.isFinite(numericPrice) ? { offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: numericPrice.toFixed(2),
      availability: isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: window.location.href,
    } } : {}),
    ...(reviewsData.totalCount > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: reviewsData.averageRating,
        reviewCount: reviewsData.totalCount,
      },
    } : {}),
  };

  return (
    <main id="main-content" className={`product-page ${colorStoryClass(product)}`} tabIndex={-1}>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
      <div className="product-page-shell">
        <nav className="product-breadcrumbs" aria-label="Navegação estrutural">
          <a href="/sneakers" onClick={(event) => handleSpaLink(event, onBack)}><ArrowLeft size={16} /> Sneakers</a>
          <span aria-hidden="true">/</span>
          <span>{getCategoryLabel(product.category)}</span>
          <span aria-hidden="true">/</span>
          <strong>{product.name}</strong>
        </nav>

        <section className="product-editorial" aria-labelledby="product-page-title">
          <div className="product-gallery-panel">
            <div className="product-gallery-blob" aria-hidden="true" />
            <div className="product-gallery-main">
              {activeImage ? (
                <img
                  src={activeImage.imageUrl}
                  alt={activeImage.altText || `${product.name}, foto ${normalizedIndex + 1}`}
                  width="760"
                  height="760"
                  decoding="async"
                  onError={() => setFailedImageKeys((current) => [...current, activeImage.key])}
                />
              ) : (
                <div className="product-image-empty" role="img" aria-label={`Imagem indisponível para ${product.name}`}>
                  <Sparkles aria-hidden="true" />
                  <span>Foto a caminho</span>
                </div>
              )}
              {visibleImages.length > 1 && (
                <div className="product-gallery-arrows">
                  <button type="button" onClick={showPrevious} aria-label="Foto anterior"><ChevronLeft /></button>
                  <span>{normalizedIndex + 1} / {visibleImages.length}</span>
                  <button type="button" onClick={showNext} aria-label="Próxima foto"><ChevronRight /></button>
                </div>
              )}
            </div>
            {visibleImages.length > 1 && (
              <div className="product-thumbnails" aria-label="Escolher foto">
                {visibleImages.map((image, index) => (
                  <button
                    key={image.key}
                    type="button"
                    className={index === normalizedIndex ? 'is-active' : ''}
                    onClick={() => setActiveImageIndex(index)}
                    aria-label={`Ver foto ${index + 1}`}
                    aria-current={index === normalizedIndex ? 'true' : undefined}
                  >
                    <img src={image.imageUrl} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="product-purchase-panel">
            <div className="product-heading-row">
              <div>
                <p className="eyebrow">{getCategoryLabel(product.category)}</p>
                <h1 id="product-page-title">{product.name}</h1>
              </div>
              <button
                type="button"
                className={`favorite-button ${isWishlisted ? 'is-active' : ''}`}
                onClick={() => onToggleWishlist?.(product.id)}
                aria-label={isWishlisted ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                aria-pressed={isWishlisted}
              >
                <Heart fill={isWishlisted ? 'currentColor' : 'none'} />
              </button>
            </div>

            {reviewsData.totalCount > 0 ? (
              <a className="product-rating-link" href="#avaliacoes">
                <RatingStars rating={reviewsData.averageRating} />
                <span>{reviewsData.averageRating.toFixed(1)} · {reviewsData.totalCount} {reviewsData.totalCount === 1 ? 'avaliação' : 'avaliações'}</span>
              </a>
            ) : <span className="product-rating-empty">Este par ainda não recebeu avaliações.</span>}

            <p className="product-price">{formatPrice(product.price)}</p>
            {product.description && <p className="product-description">{product.description}</p>}

            <div className={`stock-panel ${isAvailable ? 'is-available' : 'is-unavailable'}`}>
              {isAvailable ? <PackageCheck aria-hidden="true" /> : <Bell aria-hidden="true" />}
              <div>
                <strong>{isAvailable ? 'Disponível para escolher' : 'Este par está esgotado agora'}</strong>
                <span>{isAvailable ? `${product.stockQuantity} ${Number(product.stockQuantity) === 1 ? 'unidade cadastrada' : 'unidades cadastradas'} no estoque geral.` : 'Você pode cadastrar um contato para receber uma atualização da loja.'}</span>
              </div>
            </div>

            <div className="variant-transparency">
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>Compra sem informação inventada</strong>
                <p>O catálogo ainda não registra estoque por numeração ou cor, então esta página não exibe seletores ou disponibilidade por variante.</p>
              </div>
            </div>

            {isAvailable ? (
              <button
                type="button"
                className="button button-primary product-add-button"
                onClick={() => onAddToCart?.(product)}
              >
                <ShoppingBag size={19} aria-hidden="true" />
                Quero esse
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="button button-secondary product-add-button"
                  onClick={() => setStockAlertOpen((open) => !open)}
                  aria-expanded={stockAlertOpen}
                  aria-controls="product-stock-alert"
                >
                  <Bell size={19} aria-hidden="true" />
                  Avise-me sobre o estoque
                </button>
                {stockAlertOpen && (
                  <form id="product-stock-alert" className="stock-alert-form" onSubmit={handleStockAlertSubmit}>
                    <p>Informe ao menos um canal. O aviso registra seu interesse; não garante reposição.</p>
                    <label htmlFor="stock-alert-email">E-mail</label>
                    <input
                      id="stock-alert-email"
                      type="email"
                      value={stockAlertEmail}
                      onChange={(event) => setStockAlertEmail(event.target.value)}
                      autoComplete="email"
                      placeholder="voce@exemplo.com"
                    />
                    <label htmlFor="stock-alert-whatsapp">WhatsApp</label>
                    <input
                      id="stock-alert-whatsapp"
                      type="tel"
                      value={stockAlertWhatsapp}
                      onChange={(event) => setStockAlertWhatsapp(event.target.value)}
                      autoComplete="tel"
                      placeholder="(00) 00000-0000"
                    />
                    {stockAlertError && <p className="form-error" role="alert">{stockAlertError}</p>}
                    {stockAlertSuccess && <p className="form-success" role="status">{stockAlertSuccess}</p>}
                    <button type="submit" className="button button-primary" disabled={isSubmittingStockAlert || Boolean(stockAlertSuccess)}>
                      {isSubmittingStockAlert ? 'Criando aviso...' : stockAlertSuccess ? 'Aviso criado' : 'Criar aviso'}
                    </button>
                  </form>
                )}
              </>
            )}
            <p className="purchase-note"><Check size={15} aria-hidden="true" /> Preço e estoque validados pelo servidor no checkout.</p>
          </div>
        </section>

        <section id="sneaker-dna" className="sneaker-dna" aria-labelledby="sneaker-dna-title">
          <div>
            <p className="eyebrow">Detalhes reais do cadastro</p>
            <h2 id="sneaker-dna-title">Sneaker DNA</h2>
          </div>
          <dl>
            <div><dt>Categoria</dt><dd>{getCategoryLabel(product.category)}</dd></div>
            <div><dt>Disponibilidade</dt><dd>{isAvailable ? 'Em estoque' : 'Esgotado'}</dd></div>
            <div><dt>ID do cadastro</dt><dd>{String(product.id)}</dd></div>
            <div><dt>Galeria</dt><dd>{images.length} {images.length === 1 ? 'imagem cadastrada' : 'imagens cadastradas'}</dd></div>
          </dl>
        </section>

        <section id="avaliacoes" className="product-reviews" aria-labelledby="product-reviews-title">
          <div className="product-reviews-heading">
            <div>
              <p className="eyebrow">Experiências verificadas</p>
              <h2 id="product-reviews-title">Quem calçou, conta.</h2>
            </div>
            <button type="button" className="button button-secondary" onClick={handleReviewIntent}>Avaliar este par</button>
          </div>

          {reviewFormOpen && (
            <div className="review-form-shell">
              {!customerSession ? (
                <div className="review-gate">
                  <p>{eligibility?.reason}</p>
                  <button type="button" className="button button-primary" onClick={onOpenLogin}>Entrar na conta</button>
                </div>
              ) : eligibility?.eligible ? (
                <form onSubmit={handleReviewSubmit} className="review-form">
                  <fieldset>
                    <legend>Sua nota</legend>
                    <div className="review-rating-buttons">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <label key={value} className={value <= rating ? 'is-active' : ''}>
                          <input
                            type="radio"
                            name="product-review-rating"
                            value={value}
                            checked={rating === value}
                            onChange={() => setRating(value)}
                          />
                          <span aria-hidden="true">★</span>
                          <span className="sr-only">{value} {value === 1 ? 'estrela' : 'estrelas'}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label htmlFor="product-review-comment">Como foi sua experiência?</label>
                  <textarea id="product-review-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength="1000" rows="4" required />
                  {reviewError && <p className="form-error" role="alert">{reviewError}</p>}
                  <div className="review-form-actions">
                    <button type="button" className="button button-ghost" onClick={() => setReviewFormOpen(false)}>Cancelar</button>
                    <button type="submit" className="button button-primary" disabled={isSubmittingReview}>{isSubmittingReview ? 'Publicando...' : 'Publicar avaliação'}</button>
                  </div>
                </form>
              ) : eligibility ? (
                <div className="review-gate"><p>{eligibility.reason || 'A avaliação fica disponível após uma compra confirmada.'}</p></div>
              ) : <p className="review-loading">Verificando sua compra...</p>}
            </div>
          )}

          {isLoadingReviews ? (
            <p className="review-loading">Buscando avaliações verificadas...</p>
          ) : reviewsError ? (
            <div className="reviews-error" role="alert">
              <p>{reviewsError}</p>
              <button type="button" className="button button-secondary" onClick={loadReviews}>Tentar novamente</button>
            </div>
          ) : reviewsData.reviews.length > 0 ? (
            <div className="review-grid">
              {reviewsData.reviews.map((review) => (
                <article key={review.id} className="review-card">
                  <div><RatingStars rating={review.rating} /><span><Check size={13} /> Compra verificada</span></div>
                  <p>“{review.comment}”</p>
                  <footer><strong>{review.authorName}</strong><time>{review.createdAt ? new Date(review.createdAt).toLocaleDateString('pt-BR') : ''}</time></footer>
                </article>
              ))}
            </div>
          ) : (
            <div className="reviews-empty"><Sparkles aria-hidden="true" /><h3>Primeira impressão ainda a caminho.</h3><p>Quando um comprador avaliar este par, a experiência aparecerá aqui.</p></div>
          )}
        </section>

        {relatedProducts.length > 0 && (
          <section className="related-products" aria-labelledby="related-title">
            <div><p className="eyebrow">Continue explorando</p><h2 id="related-title">Talvez role outro match.</h2></div>
            <div className="related-products-grid">
              {relatedProducts.slice(0, 3).map((related) => (
                <ProductCard
                  key={related.id}
                  product={related}
                  onOpenProduct={onOpenProduct}
                  onAddToCart={onAddToCart}
                  isWishlisted={wishlistIds.includes(related.id)}
                  onToggleWishlist={onToggleWishlist}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
