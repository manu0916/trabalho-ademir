import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import StarRating from './StarRating';
import { fetchStoreReviewEligibility, submitStoreReview } from '../services/api';

export default function StoreReviewModal({ isOpen, onClose, onReviewSubmitted, customerSession, onOpenLogin }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [eligibility, setEligibility] = useState(null);
  const [isLoadingEligibility, setIsLoadingEligibility] = useState(true);

  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

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

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setIsLoadingEligibility(true);
    setEligibility(null);

    if (!customerSession) {
      setIsLoadingEligibility(false);
      setEligibility({ eligible: false, reason: 'Faça login com sua conta para avaliar a loja.' });
      return;
    }

    const controller = new AbortController();
    fetchStoreReviewEligibility({ signal: controller.signal })
      .then((data) => setEligibility(data))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setEligibility({ eligible: false, reason: err.message || 'Erro ao verificar elegibilidade.' });
        }
      })
      .finally(() => setIsLoadingEligibility(false));

    return () => controller.abort();
  }, [isOpen, customerSession]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const cleanComment = comment.trim();
    if (!cleanComment) {
      setError('Por favor, escreva um comentário sobre sua experiência.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitStoreReview({ rating, comment: cleanComment });
      setComment('');
      setRating(5);
      onReviewSubmitted?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Não foi possível enviar sua avaliação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 py-6 sm:p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSubmitting) onClose();
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
          aria-labelledby="store-review-title"
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-[1.85rem] bg-[var(--surface-solid)] p-6 shadow-2xl border border-[var(--line)] sm:p-8"
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg)]/80 text-xl font-bold text-[var(--text)] backdrop-blur-md transition-transform hover:scale-110 border border-[var(--line)]"
            aria-label="Fechar avaliação"
          >
            ×
          </button>

          <div>
            <p className="section-kicker">Comprador Verificado</p>
            <h2 id="store-review-title" className="mt-1 text-2xl font-extrabold text-[var(--text)]">
              Avaliar a Kicks Store
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Sua opinião ajuda outros sneakerheads a comprarem com confiança.
            </p>
          </div>

          {isLoadingEligibility ? (
            <div className="py-12 text-center text-sm text-[var(--muted)]">
              <span className="inline-block animate-spin mr-2">◌</span>
              Verificando histórico de compras aprovadas...
            </div>
          ) : !eligibility?.eligible ? (
            <div className="mt-6 rounded-2xl bg-[var(--bg)] p-5 border border-[var(--line)] text-center">
              <div className="text-3xl mb-2">🔒</div>
              <h3 className="text-base font-bold text-[var(--text)]">
                {eligibility?.alreadyReviewed ? 'Avaliação Já Registrada' : 'Apenas Compradores Verificados'}
              </h3>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                {eligibility?.reason || 'Apenas contas com compras aprovadas podem avaliar a loja.'}
              </p>
              {!customerSession ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLogin?.();
                  }}
                  className="buy-button mt-4 inline-block px-5 py-2.5 rounded-xl text-xs font-bold"
                >
                  Entrar na minha conta
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface)]"
                >
                  Entendido
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {error && (
                <div className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-500 border border-rose-500/20">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text)] mb-2">
                  Sua nota geral para a loja:
                </label>
                <div className="flex items-center gap-3 bg-[var(--bg)] p-3.5 rounded-xl border border-[var(--line)]">
                  <StarRating rating={rating} onChange={setRating} size="lg" />
                  <span className="text-sm font-bold text-[var(--accent)]">
                    {rating} de 5 estrelas
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text)] mb-2">
                  <label htmlFor="store-review-comment">Seu relato / comentário:</label>
                  <span className="text-[11px] text-[var(--muted)]">{comment.length}/4000 carac.</span>
                </div>
                <textarea
                  id="store-review-comment"
                  rows={5}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Conte sobre o atendimento, rapidez na entrega, qualidade dos tênis e experiência geral na Kicks Store..."
                  maxLength={4000}
                  className="w-full rounded-xl bg-[var(--bg)] p-3.5 text-sm text-[var(--text)] border border-[var(--line)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !comment.trim()}
                  className="buy-button w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitting ? 'Publicando avaliação...' : 'Publicar Avaliação Verificada'}
                </button>
              </div>
            </form>
          )}
        </motion.section>
      </div>
    </AnimatePresence>
  );
}
