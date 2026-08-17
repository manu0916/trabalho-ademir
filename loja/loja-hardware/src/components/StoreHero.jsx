import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getProductImages } from '../utils/productImages';

const HERO_MOTIF = ['↗', '⌁', '✦'];

export default function StoreHero({ theme, products = [], heroSettings, onExplore }) {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedSlideKeys, setFailedSlideKeys] = useState([]);
  const [isInteractionPaused, setIsInteractionPaused] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [slideAnnouncement, setSlideAnnouncement] = useState('');
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => document.visibilityState === 'visible');
  const mode = heroSettings?.mode === 'MANUAL' ? 'MANUAL' : 'PRODUCTS';

  const manualSlides = useMemo(() => (heroSettings?.manualImages || []).map((image) => ({
    key: `manual-${image.id}`,
    src: image.imageUrl,
    alt: image.altText || 'Tênis em destaque na Kicks Store',
  })), [heroSettings?.manualImages]);

  const productSlides = useMemo(() => {
    const seenUrls = new Set();
    const productGalleries = products
      .filter((product) => product.stockQuantity > 0)
      .map((product) => ({ product, images: getProductImages(product) }))
      .filter((entry) => entry.images.length > 0);
    const slides = [];
    const greatestGallerySize = Math.max(0, ...productGalleries.map((entry) => entry.images.length));

    // Interleave each product's first photo, then each second photo, so one
    // product with a large gallery never dominates the automatic showcase.
    for (let imageIndex = 0; imageIndex < greatestGallerySize && slides.length < 12; imageIndex++) {
      for (const { product, images } of productGalleries) {
        const image = images[imageIndex];
        if (!image || seenUrls.has(image.imageUrl)) continue;
        seenUrls.add(image.imageUrl);
        slides.push({
          key: `product-${product.id}-${image.key}`,
          src: image.imageUrl,
          alt: image.altText || (images.length > 1
            ? `${product.name || 'Tênis disponível na Kicks Store'}, foto ${imageIndex + 1}`
            : product.name || 'Tênis disponível na Kicks Store'),
        });
        if (slides.length >= 12) break;
      }
    }
    return slides;
  }, [products]);

  const { slides, sourceKind } = useMemo(() => {
    const availableManual = manualSlides.filter((slide) => !failedSlideKeys.includes(slide.key));
    const availableProducts = productSlides.filter((slide) => !failedSlideKeys.includes(slide.key));
    if (mode === 'MANUAL' && availableManual.length > 0) return { slides: availableManual, sourceKind: 'manual' };
    if (mode === 'PRODUCTS' && availableProducts.length > 0) return { slides: availableProducts, sourceKind: 'products' };
    return {
      sourceKind: 'default',
      slides: [{ key: 'default-hero', src: theme.image, alt: theme.imageAlt }],
    };
  }, [failedSlideKeys, manualSlides, mode, productSlides, theme.image, theme.imageAlt]);

  const slideSignature = slides.map((slide) => slide.key).join('|');
  const normalizedActiveIndex = activeIndex % slides.length;
  const activeSlide = slides[normalizedActiveIndex];
  const hasMultipleSlides = slides.length > 1;
  const shouldAutoPlay = sourceKind === 'products'
    && hasMultipleSlides
    && !prefersReducedMotion
    && !isInteractionPaused
    && !isUserPaused
    && isDocumentVisible;

  useEffect(() => {
    setActiveIndex(0);
    setIsUserPaused(false);
    setSlideAnnouncement('');
  }, [mode, slideSignature]);

  useEffect(() => {
    const handleVisibilityChange = () => setIsDocumentVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!shouldAutoPlay) return undefined;
    const intervalSeconds = Math.min(30, Math.max(3, Number(heroSettings?.intervalSeconds) || 5));
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % slides.length), intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [activeIndex, heroSettings?.intervalSeconds, shouldAutoPlay, slides.length]);

  const selectSlide = (index) => {
    setActiveIndex(index);
    setSlideAnnouncement(`Foto ${index + 1} de ${slides.length}: ${slides[index].alt}`);
  };
  const showPrevious = () => selectSlide((normalizedActiveIndex - 1 + slides.length) % slides.length);
  const showNext = () => selectSlide((normalizedActiveIndex + 1) % slides.length);
  const handleImageError = () => {
    if (activeSlide.key === 'default-hero') return;
    setFailedSlideKeys((current) => current.includes(activeSlide.key) ? current : [...current, activeSlide.key]);
  };

  return (
    <section className="hero-section overflow-hidden">
      <div className="hero-texture" aria-hidden="true" />
      <div className="hero-orb hero-orb-one" aria-hidden="true" />
      <div className="hero-orb hero-orb-two" aria-hidden="true" />
      <div className="hero-doodles" aria-hidden="true">
        {HERO_MOTIF.map((mark, index) => <span key={`${mark}-${index}`} className={`hero-doodle hero-doodle-${index + 1}`}>{mark}</span>)}
      </div>

      <div className="hero-rail" aria-hidden="true">
        <span>{theme.edition}</span>
        <i />
        <span>{theme.rail}</span>
      </div>

      <div className="hero-layout mx-auto grid max-w-[90rem] items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-12 lg:gap-8 lg:py-24">
        <motion.div
          key={`${theme.id}-copy`}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
          className="hero-copy relative z-10 lg:col-span-7"
        >
          <p className="hero-eyebrow">{theme.eyebrow}</p>
          <h1 className="hero-title">
            <span>{theme.titleLead}</span>
            <em>{theme.titleAccent}</em>
          </h1>
          <p className="hero-description mt-6 max-w-xl text-base leading-7 sm:text-lg">{theme.description}</p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <button type="button" onClick={onExplore} className="hero-cta">
              {theme.cta}
              <span aria-hidden="true" className="hero-cta-arrow">→</span>
            </button>
            <span className="hero-stat"><span className="hero-stat-dot" />{theme.stat}</span>
          </div>
          <div className="mt-10 flex flex-wrap gap-2.5">
            {theme.chips.map((chip) => <span className="hero-chip" key={chip}>{chip}</span>)}
          </div>
        </motion.div>

        <motion.div
          key={`${theme.id}-image`}
          initial={{ opacity: 0, scale: 0.96, rotate: -1.5 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.82, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="hero-image-wrap lg:col-span-5"
          role="region"
          aria-roledescription="carrossel"
          aria-label="Fotos em destaque da Kicks Store"
          onMouseEnter={() => setIsInteractionPaused(true)}
          onMouseLeave={() => setIsInteractionPaused(false)}
          onFocusCapture={() => setIsInteractionPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsInteractionPaused(false);
          }}
        >
          <div className="hero-image-halo" aria-hidden="true" />
          <div className="hero-image-shape" aria-hidden="true" />
          <div className="hero-image-frame">
            <AnimatePresence initial={false}>
              <motion.img
                key={activeSlide.key}
                src={activeSlide.src}
                alt={activeSlide.alt}
                className="hero-image hero-carousel-image"
                width="1400"
                height="1050"
                decoding="async"
                fetchPriority={normalizedActiveIndex === 0 ? 'high' : 'auto'}
                onError={handleImageError}
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
              />
            </AnimatePresence>
          </div>
          {hasMultipleSlides && (
            <>
              <button type="button" onClick={showPrevious} className="hero-carousel-arrow is-previous" aria-label="Mostrar foto anterior">←</button>
              <button type="button" onClick={showNext} className="hero-carousel-arrow is-next" aria-label="Mostrar próxima foto">→</button>
              <div className="hero-carousel-toolbar">
                <div className="hero-carousel-dots" aria-label="Escolher foto">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.key}
                      type="button"
                      onClick={() => selectSlide(index)}
                      className={`hero-carousel-dot ${index === normalizedActiveIndex ? 'is-active' : ''}`}
                      aria-label={`Mostrar foto ${index + 1} de ${slides.length}`}
                      aria-current={index === normalizedActiveIndex ? 'true' : undefined}
                    />
                  ))}
                </div>
                {sourceKind === 'products' && !prefersReducedMotion && (
                  <button type="button" onClick={() => setIsUserPaused((current) => !current)} className="hero-carousel-toggle" aria-label={isUserPaused ? 'Retomar troca automática' : 'Pausar troca automática'}>{isUserPaused ? '▶' : 'Ⅱ'}</button>
                )}
              </div>
            </>
          )}
          <span className="sr-only" aria-live="polite">{slideAnnouncement}</span>
          <div className="hero-sticker"><span>{theme.stickerLabel}</span></div>
          <div className="hero-card">
            <div className="hero-card-topline"><span className="hero-card-mark" aria-hidden="true">{HERO_MOTIF[0]}</span><small>{theme.edition}</small></div>
            <strong>{theme.heroNote}</strong>
            <p>{theme.heroDetail}</p>
          </div>
          <span className="hero-figure-index" aria-hidden="true">{String(normalizedActiveIndex + 1).padStart(2, '0')}—{String(slides.length).padStart(2, '0')}</span>
        </motion.div>
      </div>

      <div className="hero-proof-shell mx-auto max-w-7xl px-5 sm:px-8">
        <div className="hero-proof-band">
          {theme.proofs.map((proof) => (
            <div className="hero-proof" key={proof.label}>
              <span aria-hidden="true">{proof.mark}</span>
              <div><strong>{proof.label}</strong><small>{proof.detail}</small></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
