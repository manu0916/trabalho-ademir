import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import StarRating from './StarRating';
import StoreReviewModal from './StoreReviewModal';
import { fetchStoreReviews } from '../services/api';

export default function StoreReviewsSection({ customerSession, onOpenLogin }) {
  const [reviewsData, setReviewsData] = useState({ reviews: [], averageRating: 5.0, totalCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadReviews = () => {
    fetchStoreReviews()
      .then((data) => {
        if (data) setReviewsData(data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const { reviews, averageRating, totalCount } = reviewsData;

  return (
    <section id="reviews" className="store-reviews-section mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-24 border-t border-[var(--line)]">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end mb-12">
        <div>
          <p className="section-kicker">Comunidade & Transparência</p>
          <h2 className="section-title mt-1">O que dizem sobre a Kicks Store</h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Avaliações 100% autênticas de clientes reais com compras verificadas e aprovadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-[var(--surface-solid)] px-5 py-3 rounded-2xl border border-[var(--line)] shadow-sm">
            <span className="text-3xl font-black text-[var(--text)]">{Number(averageRating).toFixed(1)}</span>
            <div>
              <StarRating rating={Math.round(averageRating)} readOnly size="sm" />
              <span className="text-[11px] text-[var(--muted)] block mt-0.5">
                {totalCount} {totalCount === 1 ? 'avaliação' : 'avaliações'}
              </span>
            </div>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setIsModalOpen(true)}
            className="buy-button cursor-pointer rounded-2xl px-5 py-3 text-sm font-bold shadow-lg"
          >
            ★ Avaliar a Loja
          </motion.button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-[var(--muted)]">
          <span className="inline-block animate-spin mr-2">◌</span>
          Carregando avaliações...
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-3xl bg-[var(--surface-solid)] p-12 text-center border border-[var(--line)]">
          <span className="text-4xl mb-3 block">⭐</span>
          <h3 className="text-lg font-bold text-[var(--text)]">Seja o primeiro a avaliar a Kicks Store!</h3>
          <p className="mt-1 max-w-md mx-auto text-xs text-[var(--muted)]">
            Se você já concluiu uma compra com pagamento aprovado, compartilhe sua experiência com a nossa comunidade.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="buy-button mt-5 inline-block px-6 py-2.5 rounded-xl text-xs font-bold"
          >
            Escrever Avaliação
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, idx) => (
            <motion.article
              key={review.id || idx}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.35, delay: Math.min(idx * 0.05, 0.25) }}
              className="flex flex-col justify-between rounded-2xl bg-[var(--surface-solid)] p-5 border border-[var(--line)] hover:border-[var(--accent)]/40 transition-colors shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <StarRating rating={review.rating} readOnly size="sm" />
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    ✓ Comprador Verificado
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--text)] whitespace-pre-line">
                  “{review.comment}”
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--muted)]">
                <span className="font-semibold text-[var(--text)]">{review.authorName}</span>
                <span>
                  {review.createdAt ? new Date(review.createdAt).toLocaleDateString('pt-BR') : 'Recente'}
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {/* Evaluation Modal */}
      <StoreReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onReviewSubmitted={loadReviews}
        customerSession={customerSession}
        onOpenLogin={onOpenLogin}
      />
    </section>
  );
}
