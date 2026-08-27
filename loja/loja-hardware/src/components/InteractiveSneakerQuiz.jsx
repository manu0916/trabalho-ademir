import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getProductImages } from '../utils/productImages';

const QUIZ_QUESTIONS = [
  {
    id: 'category',
    title: 'Qual parte do catálogo você quer explorar?',
    subtitle: 'A sugestão usa somente a categoria cadastrada em cada produto.',
    options: [
      { id: 'all', label: 'Catálogo completo', icon: '✨' },
      { id: 'basketball', label: 'Basquete', icon: '🏀', category: 'Basquete' },
      { id: 'futsal', label: 'Futsal', icon: '⚽', category: 'Futsal' },
      { id: 'football', label: 'Futebol', icon: '🥅', category: 'Futebol' },
    ],
  },
  {
    id: 'budget',
    title: 'Qual faixa de preço você quer consultar?',
    subtitle: 'A comparação considera o preço atual recebido do catálogo.',
    options: [
      { id: 'any', label: 'Qualquer faixa', icon: '↔️' },
      { id: 'up-to-900', label: 'Até R$ 900', icon: '🏷️', min: 0, max: 900 },
      { id: '900-to-1800', label: 'De R$ 900 a R$ 1.800', icon: '📌', min: 900, max: 1800 },
      { id: 'above-1800', label: 'Acima de R$ 1.800', icon: '⬆️', min: 1800 },
    ],
  },
];

function matchesCategory(product, option) {
  if (!option?.category) return true;
  return String(product?.category || '').trim().toLocaleLowerCase('pt-BR')
    === option.category.toLocaleLowerCase('pt-BR');
}

function matchesPrice(product, option) {
  if (!option || option.id === 'any') return true;
  const price = Number(product?.price);
  if (!Number.isFinite(price)) return false;
  if (option.min !== undefined && price < option.min) return false;
  if (option.max !== undefined && price > option.max) return false;
  return true;
}

export default function InteractiveSneakerQuiz({ isOpen, onClose, products = [], onSelectProduct }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isCompleted, setIsCompleted] = useState(false);

  const matchedProducts = useMemo(() => products
    .filter((product) => matchesCategory(product, answers.category))
    .filter((product) => matchesPrice(product, answers.budget))
    .slice(0, 3), [answers, products]);

  if (!isOpen) return null;

  const currentQuestion = QUIZ_QUESTIONS[step];

  const handleSelectOption = (questionId, option) => {
    setAnswers((current) => ({ ...current, [questionId]: option }));
    if (step < QUIZ_QUESTIONS.length - 1) {
      setStep((current) => current + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handleReset = () => {
    setStep(0);
    setAnswers({});
    setIsCompleted(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-preferences-title"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface-solid)] p-6 shadow-2xl sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-[var(--accent)]">
              Preferências do catálogo
            </span>
            <h3 id="catalog-preferences-title" className="text-xl font-black tracking-tight text-[var(--text)] sm:text-2xl">
              {isCompleted ? 'Sugestões com os dados disponíveis' : `Passo ${step + 1} de ${QUIZ_QUESTIONS.length}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-lg font-bold text-[var(--muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--text)]"
            aria-label="Fechar preferências"
          >
            ×
          </button>
        </div>

        {!isCompleted ? (
          <div>
            <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]" aria-hidden="true">
              <motion.div
                className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)]"
                initial={{ width: '0%' }}
                animate={{ width: `${((step + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="mb-6">
              <h4 className="text-lg font-bold text-[var(--text)] sm:text-xl">{currentQuestion.title}</h4>
              <p className="mt-1 text-xs text-[var(--muted)]">{currentQuestion.subtitle}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {currentQuestion.options.map((option) => (
                <motion.button
                  key={option.id}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectOption(currentQuestion.id, option)}
                  className="group flex cursor-pointer items-start gap-3.5 rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] p-4 text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-solid)]"
                >
                  <span className="rounded-xl bg-[var(--soft)] p-2 text-2xl" aria-hidden="true">{option.icon}</span>
                  <strong className="block text-sm font-extrabold text-[var(--text)]">{option.label}</strong>
                </motion.button>
              ))}
            </div>
            {step > 0 && (
              <button type="button" onClick={() => setStep((current) => current - 1)} className="mt-6 text-xs font-bold text-[var(--muted)] hover:text-[var(--text)]">
                ← Voltar pergunta
              </button>
            )}
          </div>
        ) : (
          <div>
            <p className="mb-5 text-sm leading-relaxed text-[var(--muted)]">
              Os resultados abaixo usam somente categoria e preço cadastrados. Eles não representam popularidade, avaliação ou recomendação personalizada.
            </p>

            {matchedProducts.length > 0 ? (
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                {matchedProducts.map((product) => {
                  const image = getProductImages(product)[0];
                  const numericPrice = Number(product.price);
                  return (
                    <article key={product.id} className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] p-3 text-left">
                      <div className="mb-2 aspect-square overflow-hidden rounded-xl bg-black/10">
                        {image ? <img src={image.imageUrl} alt={image.altText || product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center p-3 text-center text-xs text-[var(--muted)]">Imagem não cadastrada</div>}
                      </div>
                      <strong className="line-clamp-2 text-xs font-black leading-tight text-[var(--text)]">{product.name}</strong>
                      <span className="mt-2 text-xs font-extrabold text-[var(--accent)]">
                        {Number.isFinite(numericPrice) ? numericPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Preço não informado'}
                      </span>
                      {onSelectProduct && (
                        <button type="button" onClick={() => { onSelectProduct(product); onClose?.(); }} className="mt-3 text-left text-[11px] font-black text-[var(--text)] underline hover:text-[var(--accent)]">
                          Ver produto →
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mb-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] p-6 text-center" role="status">
                <strong className="text-sm text-[var(--text)]">Nenhum produto corresponde aos critérios atuais.</strong>
                <p className="mt-1 text-xs text-[var(--muted)]">Refaça a seleção ou explore o catálogo completo.</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] pt-4">
              <button type="button" onClick={handleReset} className="text-xs font-bold text-[var(--muted)] hover:text-[var(--text)]">↻ Refazer seleção</button>
              <button type="button" onClick={onClose} className="buy-button rounded-xl px-6 py-2.5 text-xs font-bold">Fechar</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
