import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, ShoppingBag, Sparkles } from 'lucide-react';
import happyHeroAsset from '../assets/brand/kicks-happy-hero.webp';
import { getProductImages } from '../utils/productImages';
import '../styles/home.css';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function isUsableImageUrl(value) {
  const url = String(value || '').trim();
  return Boolean(url) && (/^https:\/\//i.test(url) || /^\/(?!\/)/.test(url) || /^data:image\//i.test(url));
}

function isProductInStock(product) {
  const stockQuantity = Number(product?.stockQuantity);
  return Number.isFinite(stockQuantity) && stockQuantity > 0;
}

function normalizeHeroSettings(settings) {
  const intervalSeconds = Number(settings?.intervalSeconds);
  return {
    mode: settings?.mode === 'MANUAL' ? 'MANUAL' : 'PRODUCTS',
    intervalSeconds: Number.isInteger(intervalSeconds) && intervalSeconds >= 3 && intervalSeconds <= 30
      ? intervalSeconds
      : 6,
    manualImages: Array.isArray(settings?.manualImages) ? settings.manualImages : [],
  };
}

function createManualSlides(manualImages, failedImageUrls) {
  return manualImages
    .filter((image) => image && isUsableImageUrl(image.imageUrl))
    .map((image, index) => ({
      kind: 'manual',
      key: `manual-${image.id ?? index}`,
      imageUrl: failedImageUrls.has(image.imageUrl) ? happyHeroAsset : image.imageUrl.trim(),
      sourceImageUrl: image.imageUrl.trim(),
      altText: String(image.altText || '').trim() || 'Campanha editorial da Kicks Store',
      sortOrder: Number.isInteger(image.sortOrder) ? image.sortOrder : index,
      isFallbackImage: failedImageUrls.has(image.imageUrl),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function createProductSlides(products, failedImageUrls) {
  return products
    .filter(isProductInStock)
    .map((product, index) => {
      const image = getProductImages(product).find((candidate) => (
        isUsableImageUrl(candidate.imageUrl) && !failedImageUrls.has(candidate.imageUrl)
      ));
      return image ? {
        kind: 'product',
        key: `product-${product.id ?? index}`,
        imageUrl: image.imageUrl,
        sourceImageUrl: image.imageUrl,
        altText: image.altText || String(product.name || 'Produto do catálogo'),
        product,
      } : null;
    })
    .filter(Boolean)
    .slice(0, 6);
}

export default function StoreHero({
  products = [],
  heroSettings,
  onExplore,
  onOpenProduct,
  onAddToCart,
}) {
  const settings = useMemo(() => normalizeHeroSettings(heroSettings), [heroSettings]);
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [isInteractionPaused, setIsInteractionPaused] = useState(false);
  const [isDocumentHidden, setIsDocumentHidden] = useState(false);
  const [failedProductImageUrls, setFailedProductImageUrls] = useState(() => new Set());
  const [failedManualImageUrls, setFailedManualImageUrls] = useState(() => new Set());

  const productSlides = useMemo(
    () => createProductSlides(Array.isArray(products) ? products : [], failedProductImageUrls),
    [failedProductImageUrls, products],
  );
  const manualSlides = useMemo(
    () => createManualSlides(settings.manualImages, failedManualImageUrls),
    [failedManualImageUrls, settings.manualImages],
  );
  const configuredSlides = settings.mode === 'MANUAL' ? manualSlides : productSlides;
  const slides = configuredSlides.length > 0 ? configuredSlides : [{
    kind: 'fallback',
    key: `${settings.mode.toLowerCase()}-fallback`,
    imageUrl: happyHeroAsset,
    altText: 'Tênis colorido em composição editorial da Kicks Store',
  }];
  const currentSlide = slides[activeIndex % slides.length];
  const currentProduct = currentSlide.kind === 'product' ? currentSlide.product : null;
  const isPaused = shouldReduceMotion || isUserPaused || isInteractionPaused || isDocumentHidden;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setShouldReduceMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener?.('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener?.('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setIsDocumentHidden(document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, slides.length - 1)));
  }, [settings.mode, slides.length]);

  useEffect(() => {
    if (isPaused || slides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, settings.intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [isPaused, settings.intervalSeconds, slides.length]);

  const showPrevious = () => {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % slides.length);
  };

  const handleImageError = () => {
    if (currentSlide.kind === 'product') {
      setFailedProductImageUrls((current) => new Set(current).add(currentSlide.sourceImageUrl));
      return;
    }
    if (currentSlide.kind === 'manual' && !currentSlide.isFallbackImage) {
      setFailedManualImageUrls((current) => new Set(current).add(currentSlide.sourceImageUrl));
    }
  };

  const hasCurrentPrice = currentProduct?.price !== null
    && currentProduct?.price !== undefined
    && String(currentProduct.price).trim() !== '';
  const numericPrice = hasCurrentPrice ? Number(currentProduct.price) : Number.NaN;

  return (
    <section
      className="happy-hero"
      aria-labelledby="happy-hero-title"
      onMouseEnter={() => setIsInteractionPaused(true)}
      onMouseLeave={() => setIsInteractionPaused(false)}
      onFocusCapture={() => setIsInteractionPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsInteractionPaused(false);
      }}
    >
      <div className="happy-hero__orb happy-hero__orb--sun" aria-hidden="true" />
      <div className="happy-hero__orb happy-hero__orb--sky" aria-hidden="true" />
      <div className="happy-hero__spark happy-hero__spark--one" aria-hidden="true" />
      <div className="happy-hero__spark happy-hero__spark--two" aria-hidden="true" />

      <div className="happy-hero__inner">
        <div className="happy-hero__copy">
          <p className="happy-hero__eyebrow">
            <Sparkles aria-hidden="true" />
            Kicks Store · alegria em movimento
          </p>
          <h1 id="happy-hero-title">Calce a felicidade.</h1>
          <p className="happy-hero__lead">
            Sneakers para acompanhar o seu ritmo, sua personalidade e os dias que pedem um pouco mais de cor.
          </p>

          <div className="happy-hero__actions">
            {onExplore && (
              <button type="button" className="happy-button happy-button--primary" onClick={onExplore}>
                Explorar coleção
                <ArrowRight aria-hidden="true" />
              </button>
            )}
            {currentProduct && onOpenProduct && (
              <button
                type="button"
                className="happy-button happy-button--secondary"
                onClick={() => onOpenProduct(currentProduct)}
              >
                Ver este par
              </button>
            )}
          </div>

          <div className="happy-hero__notes" aria-label="Sobre esta seleção">
            <span>Catálogo real</span>
            <span>Curadoria editorial</span>
            <span>Experiência leve</span>
          </div>
        </div>

        <div className="happy-hero__stage">
          <div className="happy-hero__sun-mark" aria-hidden="true">
            <span />
          </div>
          <img className="happy-hero__campaign-art" src={happyHeroAsset} alt="" aria-hidden="true" />

          <div className="happy-hero__visual" aria-live={isPaused ? 'polite' : 'off'}>
            <img
              key={currentSlide.key}
              className={`happy-hero__main-image ${currentSlide.kind === 'fallback' || currentSlide.isFallbackImage ? 'happy-hero__main-image--campaign' : ''}`.trim()}
              src={currentSlide.kind === 'fallback' ? happyHeroAsset : currentSlide.imageUrl}
              alt={currentSlide.altText}
              onError={currentSlide.kind === 'fallback' ? undefined : handleImageError}
              fetchPriority="high"
            />
          </div>

          <div className="happy-hero__feature-card">
            <p className="happy-hero__feature-label">
              {currentProduct ? 'Da vitrine agora' : settings.mode === 'MANUAL' ? 'Campanha Kicks' : 'Universo Kicks'}
            </p>
            <h2>{currentProduct?.name || 'Seu próximo favorito começa por aqui.'}</h2>
            {currentProduct ? (
              <div className="happy-hero__feature-meta">
                {currentProduct.category && <span>{currentProduct.category}</span>}
                {Number.isFinite(numericPrice) && <strong>{currencyFormatter.format(numericPrice)}</strong>}
              </div>
            ) : (
              <p className="happy-hero__feature-description">
                {configuredSlides.length > 0
                  ? 'Uma composição visual escolhida para a campanha atual.'
                  : 'A seleção da vitrine está sendo preparada.'}
              </p>
            )}

            {currentProduct && onAddToCart && (
              <button
                type="button"
                className="happy-hero__quick-add"
                onClick={() => onAddToCart(currentProduct)}
              >
                <ShoppingBag aria-hidden="true" />
                Adicionar à sacola
              </button>
            )}
          </div>

          {slides.length > 1 && (
            <div className="happy-hero__carousel-controls" aria-label="Controles do destaque">
              <button type="button" onClick={showPrevious} aria-label="Destaque anterior">
                <ChevronLeft aria-hidden="true" />
              </button>
              <div className="happy-hero__dots" role="group" aria-label="Escolher destaque">
                {slides.map((slide, index) => (
                  <button
                    key={slide.key}
                    type="button"
                    className={index === activeIndex % slides.length ? 'is-active' : ''}
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Mostrar destaque ${index + 1} de ${slides.length}`}
                    aria-pressed={index === activeIndex % slides.length}
                  />
                ))}
              </div>
              <button type="button" onClick={showNext} aria-label="Próximo destaque">
                <ChevronRight aria-hidden="true" />
              </button>
              <button
                type="button"
                className="happy-hero__pause"
                onClick={() => setIsUserPaused((paused) => !paused)}
                aria-label={isUserPaused ? 'Retomar troca automática dos destaques' : 'Pausar troca automática dos destaques'}
                aria-pressed={isUserPaused}
              >
                {isUserPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
