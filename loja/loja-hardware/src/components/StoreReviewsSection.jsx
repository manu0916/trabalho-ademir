import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import StarRating from './StarRating';
import StoreReviewModal from './StoreReviewModal';
import { fetchStoreReviews } from '../services/api';

const EMPTY_REVIEWS = {
  reviews: [],
  averageRating: 0,
  totalCount: 0,
};

function normalizeReviews(data) {
  const reviews = Array.isArray(data?.reviews) ? data.reviews : [];
  const averageRating = Number(data?.averageRating);
  const totalCount = Number(data?.totalCount);

  return {
    reviews,
    averageRating: Number.isFinite(averageRating) ? averageRating : 0,
    totalCount: Number.isFinite(totalCount) ? totalCount : reviews.length,
  };
}

export default function StoreReviewsSection({ customerSession, onOpenLogin }) {
  const [reviewsData, setReviewsData] = useState(EMPTY_REVIEWS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadReviews = useCallback(() => {
    setIsLoading(true);
    setError('');

    return fetchStoreReviews()
      .then((data) => setReviewsData(normalizeReviews(data)))
      .catch((requestError) => {
        setReviewsData(EMPTY_REVIEWS);
        setError(requestError.message || 'Não foi possível carregar as avaliações agora.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const { reviews, averageRating, totalCount } = reviewsData;

  return (
    <section id="reviews" className="store-reviews-section mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-24 border-t border-[var(--line)]">
      <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="section-kicker text-xs font-black uppercase tracking-widest text-[var(--accent-strong)]">
            Avaliações da loja
          </p>
          <h2 className="section-title mt-1 text-3xl font-black sm:text-4xl lg:text-5xl">
            Experiências publicadas
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Esta área mostra somente as avaliações retornadas pelo serviço da loja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {totalCount > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)] px-5 py-3 shadow-xl">
              <span className="text-3xl font-black text-[var(--text)]">{averageRating.toFixed(1)}</span>
              <div>
                <StarRating rating={Math.round(averageRating)} readOnly size="sm" />
                <span className="mt-0.5 block text-[11px] font-bold text-[var(--muted)]">
                  {totalCount} {totalCount === 1 ? 'avaliação publicada' : 'avaliações publicadas'}
                </span>
              </div>
            </div>
          )}

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setIsModalOpen(true)}
            className="buy-button cursor-pointer rounded-2xl px-6 py-3.5 text-xs font-black uppercase tracking-wider shadow-xl"
          >
            Escrever avaliação
          </motion.button>
        </div>
      </div>

      {isLoading ? (
        <p className="rounded-3xl border border-[var(--line)] bg-[var(--surface-solid)] p-8 text-center text-sm text-[var(--muted)]" role="status">
          Carregando avaliações…
        </p>
      ) : error ? (
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-solid)] p-8 text-center" role="alert">
          <p className="text-sm text-[var(--muted)]">{error}</p>
          <button type="button" className="button button-secondary mt-4" onClick={loadReviews}>Tentar novamente</button>
        </div>
      ) : reviews.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <motion.article
              key={review.id || index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
              className="flex flex-col justify-between rounded-3xl border border-[var(--line)] bg-[var(--surface-solid)] p-6 shadow-xl transition-all hover:-translate-y-1 hover:border-[var(--accent-strong)]/40"
            >
              <div>
                <StarRating rating={review.rating} readOnly size="sm" />
                {review.productBought && (
                  <p className="mt-3 inline-block rounded-lg bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-strong)]">
                    Produto informado: {review.productBought}
                  </p>
                )}
                <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-[var(--text)] sm:text-sm">
                  “{review.comment}”
                </p>
              </div>

              <footer className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
                <div>
                  <strong className="block font-black text-[var(--text)]">{review.customerName || 'Cliente'}</strong>
                  {review.city && <span className="text-[11px]">{review.city}</span>}
                </div>
                {review.date && <time className="text-[10px] font-mono opacity-60">{review.date}</time>}
              </footer>
            </motion.article>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-solid)] p-8 text-center" role="status">
          <h3 className="text-xl font-black text-[var(--text)]">Nenhuma avaliação publicada ainda.</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">Quando o serviço retornar uma avaliação, ela aparecerá aqui.</p>
        </div>
      )}

      <StoreReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customerSession={customerSession}
        onOpenLogin={onOpenLogin}
        onReviewSubmitted={loadReviews}
      />
    </section>
  );
}
