import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getProductImages } from '../utils/productImages';
import { getCategoryLabel } from '../utils/catalogCategories';
import StarRating from './StarRating';
import SizeGuideModal from './SizeGuideModal';
import StockAlertModal from './StockAlertModal';
import ShippingCalculator from './ShippingCalculator';
import {
  fetchProductReviews,
  fetchProductReviewEligibility,
  submitProductReview,
} from '../services/api';

const AVAILABLE_SIZES = ['37', '38', '39', '40', '41', '42', '43', '44'];

function getProductColorVariants(product) {
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

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
  theme,
  customerSession,
  onOpenLogin,
  isWishlisted = false,
  onToggleWishlist,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  const colors = useMemo(() => (product ? getProductColorVariants(product) : []), [product]);
  const [selectedSize, setSelectedSize] = useState('40');
  const [selectedColor, setSelectedColor] = useState(() => colors[0]?.name || 'Padrão');

  const allImages = useMemo(() => (product ? getProductImages(product) : []), [product]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Modals state
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [isStockAlertOpen, setIsStockAlertOpen] = useState(false);

  // Reviews state
  const [activeTab, setActiveTab] = useState('specs'); // 'specs' | 'reviews'
  const [reviewsData, setReviewsData] = useState({ reviews: [], averageRating: 5.0, totalCount: 0 });
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const loadReviews = useCallback(() => {
    if (!product?.id) return;
    setIsLoadingReviews(true);
    fetchProductReviews(product.id)
      .then((data) => {
        if (data) setReviewsData(data);
      })
      .catch(() => {})
      .finally(() => setIsLoadingReviews(false));
  }, [product?.id]);

  // Reset selections when a new product is opened
  useEffect(() => {
    if (product) {
      const defaultColors = getProductColorVariants(product);
      setSelectedColor(defaultColors[0]?.name || 'Padrão');
      setSelectedSize('40');
      setActiveImageIndex(0);
      setActiveTab('specs');
      setShowReviewForm(false);
      setReviewError('');
      setNewComment('');
      setNewRating(5);
      setIsSizeGuideOpen(false);
      setIsStockAlertOpen(false);
      loadReviews();
    }
  }, [loadReviews, product]);

  // Modal accessibility
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleOpenReviewForm = async () => {
    setReviewError('');
    if (!customerSession) {
      setEligibility({ eligible: false, reason: 'Faça login com sua conta para avaliar este modelo.' });
      setShowReviewForm(true);
      return;
    }

    try {
      const result = await fetchProductReviewEligibility(product.id);
      setEligibility(result);
      setShowReviewForm(true);
    } catch (err) {
      setEligibility({ eligible: false, reason: err.message || 'Erro ao verificar elegibilidade.' });
      setShowReviewForm(true);
    }
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    setReviewError('');
    const cleanComment = newComment.trim();
    if (!cleanComment) {
      setReviewError('Escreva um comentário para sua avaliação.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      await submitProductReview(product.id, { rating: newRating, comment: cleanComment });
      setNewComment('');
      setNewRating(5);
      setShowReviewForm(false);
      loadReviews();
    } catch (err) {
      setReviewError(err.message || 'Não foi possível enviar sua avaliação.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (!isOpen || !product) return null;

  const activeColorObj = colors.find((c) => c.name === selectedColor) || colors[0];
  const colorStock = activeColorObj?.stock ?? product.stockQuantity;
  const isAvailable = colorStock > 0;
  const activeImage = allImages[activeImageIndex] || { imageUrl: product.imageUrl, altText: product.name };

  const handleAdd = () => {
    if (!isAvailable) return;
    onAddToCart({
      ...product,
      selectedSize,
      selectedColor,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        className="product-detail-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 py-6 sm:p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          aria-hidden="true"
        />

        <motion.section
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-detail-title"
          className="product-detail-card relative z-10 w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-[1.85rem] bg-[var(--surface-solid)] p-6 shadow-2xl border border-[var(--line)] sm:p-8"
        >
          {/* Action Header: Wishlist & Close */}
          <div className="absolute right-5 top-5 z-20 flex items-center gap-2">
            {onToggleWishlist && (
              <button
                type="button"
                onClick={() => onToggleWishlist(product.id)}
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg)]/80 text-base backdrop-blur-md transition-transform hover:scale-110 border border-[var(--line)] ${isWishlisted ? 'text-rose-500' : 'text-[var(--muted)] hover:text-rose-500'}`}
                aria-label={isWishlisted ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                {isWishlisted ? '❤️' : '🤍'}
              </button>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg)]/80 text-xl font-bold text-[var(--text)] backdrop-blur-md transition-transform hover:scale-110 border border-[var(--line)]"
              aria-label="Fechar detalhes do produto"
            >
              ×
            </button>
          </div>

          <div className="grid gap-8 md:grid-cols-12 md:items-start">
            {/* Gallery Column (Left) */}
            <div className="md:col-span-6 flex flex-col gap-4">
              <div className="product-detail-main-image relative aspect-square w-full overflow-hidden rounded-2xl bg-[var(--bg)] border border-[var(--line)]">
                <img
                  src={activeImage.imageUrl}
                  alt={activeImage.altText || product.name}
                  className="h-full w-full object-cover transition-all duration-300"
                />
                <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  {getCategoryLabel(product.category, theme?.category || 'Kicks')}
                </span>

                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-emerald-400 backdrop-blur-md border border-emerald-500/30">
                  <span>🛡️</span> Legit Check 100% Autêntico
                </div>
              </div>

              {/* Thumbnails */}
              {allImages.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {allImages.map((img, idx) => (
                    <button
                      key={img.key || idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${activeImageIndex === idx ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30' : 'border-[var(--line)] opacity-60 hover:opacity-100'}`}
                      aria-label={`Ver foto ${idx + 1} de ${product.name}`}
                    >
                      <img src={img.imageUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details & Purchase Controls (Right) */}
            <div className="md:col-span-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 pr-16">
                  <p className="section-kicker">{theme?.edition || 'Sneakers & Streetwear'}</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reviews')}
                    className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                  >
                    <StarRating rating={Math.round(reviewsData.averageRating || 5)} readOnly size="sm" />
                    <span className="font-bold text-[var(--text)]">
                      {Number(reviewsData.averageRating || 5).toFixed(1)}
                    </span>
                    <span>({reviewsData.totalCount})</span>
                  </button>
                </div>

                <h1 id="product-detail-title" className="mt-1 text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
                  {product.name}
                </h1>

                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-3xl font-black text-[var(--text)]">
                    R$ {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-[var(--muted)]">em até 12x no cartão</span>
                </div>

                {/* Tabs */}
                <div className="mt-5 flex gap-2 border-b border-[var(--line)] pb-2 text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('specs')}
                    className={`pb-1 transition-colors ${activeTab === 'specs' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                  >
                    Comprar &amp; Detalhes
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reviews')}
                    className={`pb-1 transition-colors flex items-center gap-1.5 ${activeTab === 'reviews' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                  >
                    Avaliações
                    <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs font-bold">
                      {reviewsData.totalCount}
                    </span>
                  </button>
                </div>

                {activeTab === 'specs' ? (
                  <div className="mt-4 space-y-4">
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      {product.description || 'Modelo de alta performance com design exclusivo, amortecimento de ponta e materiais premium para máxima tração e estilo.'}
                    </p>

                    <hr className="my-4 border-[var(--line)]" />

                    {/* Color Variations with Stock */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-semibold text-[var(--text)]">
                          Cor: <span className="text-[var(--accent)]">{selectedColor}</span>
                        </span>
                        <span className={`text-xs font-bold ${colorStock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {colorStock > 0 ? `✓ ${colorStock} pares disponíveis` : '✕ Esgotado'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((color) => {
                          const isSelected = selectedColor === color.name;
                          return (
                            <button
                              key={color.name}
                              type="button"
                              onClick={() => setSelectedColor(color.name)}
                              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${isSelected ? 'border-[var(--accent)] bg-[var(--surface)] text-[var(--text)] ring-2 ring-[var(--accent)]/30' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--accent)]'}`}
                            >
                              <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: color.hex }} />
                              <span>{color.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Size (Numeração) Selector with Size Guide Button */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-semibold text-[var(--text)]">
                          Tamanho (BR): <span className="text-[var(--accent)] font-bold">{selectedSize}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsSizeGuideOpen(true)}
                          className="text-xs text-[var(--accent)] font-bold hover:underline flex items-center gap-1"
                        >
                          📏 Guia de Medidas (cm)
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                        {AVAILABLE_SIZES.map((size) => {
                          const isSelected = selectedSize === size;
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setSelectedSize(size)}
                              className={`flex h-10 items-center justify-center rounded-xl text-sm font-bold border transition-all ${isSelected ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)] shadow-md scale-105' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)]'}`}
                              aria-pressed={isSelected}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Add to Cart CTA & Back-in-stock alert */}
                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!isAvailable}
                        className="buy-button w-full cursor-pointer rounded-2xl py-3.5 text-base font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 shadow-xl"
                      >
                        {isAvailable ? `Adicionar à Sacola (Tam ${selectedSize} • ${selectedColor})` : 'Esgotado nesta variação'}
                      </button>

                      {!isAvailable && (
                        <button
                          type="button"
                          onClick={() => setIsStockAlertOpen(true)}
                          className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                        >
                          🔔 Avise-me quando este tamanho/cor chegar
                        </button>
                      )}

                      <p className="text-center text-xs text-[var(--muted)]">
                        ⚡ Envio rápido para todo o Brasil • Pagamento 100% seguro
                      </p>
                    </div>

                    {/* Shipping Calculator */}
                    <div className="pt-2">
                      <ShippingCalculator orderAmount={product.price} />
                    </div>
                  </div>
                ) : (
                  /* Reviews Tab */
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between bg-[var(--bg)] p-4 rounded-2xl border border-[var(--line)]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black text-[var(--text)]">
                            {Number(reviewsData.averageRating || 5).toFixed(1)}
                          </span>
                          <StarRating rating={Math.round(reviewsData.averageRating || 5)} readOnly size="sm" />
                        </div>
                        <span className="text-xs text-[var(--muted)]">
                          {reviewsData.totalCount} {reviewsData.totalCount === 1 ? 'avaliação de comprador' : 'avaliações de compradores'}
                        </span>
                      </div>

                      {!showReviewForm && (
                        <button
                          type="button"
                          onClick={handleOpenReviewForm}
                          className="buy-button px-4 py-2 rounded-xl text-xs font-bold"
                        >
                          ★ Avaliar este par
                        </button>
                      )}
                    </div>

                    {/* Review Submission Form / Eligibility Notice */}
                    {showReviewForm && (
                      <div className="rounded-2xl bg-[var(--bg)] p-5 border border-[var(--line)]">
                        {!eligibility?.eligible ? (
                          <div className="text-center py-3">
                            <div className="text-2xl mb-1.5">🔒</div>
                            <h4 className="text-sm font-bold text-[var(--text)]">
                              {eligibility?.alreadyReviewed ? 'Você já avaliou este par' : 'Apenas Compradores Deste Modelo'}
                            </h4>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {eligibility?.reason || 'Apenas clientes que compraram este tênis podem avaliá-lo.'}
                            </p>
                            {!customerSession ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenLogin?.();
                                }}
                                className="buy-button mt-3 px-4 py-2 rounded-xl text-xs font-bold"
                              >
                                Entrar na minha conta
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowReviewForm(false)}
                                className="mt-3 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--line)] text-[var(--text)]"
                              >
                                Fechar
                              </button>
                            )}
                          </div>
                        ) : (
                          <form onSubmit={handleSubmitReview} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wide">
                                Sua Avaliação Verificada
                              </h4>
                              <button
                                type="button"
                                onClick={() => setShowReviewForm(false)}
                                className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
                              >
                                Cancelar
                              </button>
                            </div>

                            {reviewError && (
                              <div className="rounded-lg bg-rose-500/10 p-2 text-xs font-semibold text-rose-500 border border-rose-500/20">
                                {reviewError}
                              </div>
                            )}

                            <div>
                              <label className="block text-xs text-[var(--muted)] mb-1">Nota em estrelas:</label>
                              <StarRating rating={newRating} onChange={setNewRating} size="md" />
                            </div>

                            <div>
                              <label htmlFor="sneaker-review-comment" className="block text-xs text-[var(--muted)] mb-1">
                                Comentário sobre o conforto, tamanho e visual:
                              </label>
                              <textarea
                                id="sneaker-review-comment"
                                rows={3}
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Ex: Tamanho serviu perfeitamente (forma padrão), amortecimento impecável..."
                                maxLength={4000}
                                className="w-full rounded-xl bg-[var(--surface-solid)] p-3 text-xs text-[var(--text)] border border-[var(--line)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                                required
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={isSubmittingReview || !newComment.trim()}
                              className="buy-button w-full py-2.5 rounded-xl text-xs font-bold"
                            >
                              {isSubmittingReview ? 'Enviando...' : 'Publicar Avaliação do Tênis'}
                            </button>
                          </form>
                        )}
                      </div>
                    )}

                    {/* Reviews List */}
                    {isLoadingReviews ? (
                      <div className="py-8 text-center text-xs text-[var(--muted)]">
                        Carregando avaliações...
                      </div>
                    ) : reviewsData.reviews.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[var(--muted)]">
                        Nenhuma avaliação registrada ainda para este modelo. Seja o primeiro comprador a avaliar!
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {reviewsData.reviews.map((r, idx) => (
                          <div key={r.id || idx} className="rounded-xl bg-[var(--bg)] p-3.5 border border-[var(--line)] text-xs">
                            <div className="flex items-center justify-between mb-1.5">
                              <StarRating rating={r.rating} readOnly size="sm" />
                              <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                ✓ Comprador Verificado
                              </span>
                            </div>
                            <p className="text-[var(--text)] whitespace-pre-line leading-relaxed">
                              “{r.comment}”
                            </p>
                            <div className="mt-2 pt-2 border-t border-[var(--line)]/50 flex justify-between text-[11px] text-[var(--muted)]">
                              <span className="font-semibold text-[var(--text)]">{r.authorName}</span>
                              <span>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : 'Recente'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sub-modals */}
          <SizeGuideModal
            isOpen={isSizeGuideOpen}
            onClose={() => setIsSizeGuideOpen(false)}
            selectedSize={selectedSize}
          />

          <StockAlertModal
            isOpen={isStockAlertOpen}
            onClose={() => setIsStockAlertOpen(false)}
            product={product}
            selectedSize={selectedSize}
            selectedColor={selectedColor}
            customerSession={customerSession}
          />
        </motion.section>
      </div>
    </AnimatePresence>
  );
}
