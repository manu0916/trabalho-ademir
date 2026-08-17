import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const SIZE_TABLE = [
  { br: '37', us: '5.5', eur: '38', cm: '24.0' },
  { br: '38', us: '6.0', eur: '39', cm: '24.5' },
  { br: '39', us: '7.0', eur: '40', cm: '25.5' },
  { br: '40', us: '8.0', eur: '41', cm: '26.0' },
  { br: '41', us: '8.5', eur: '42', cm: '26.5' },
  { br: '42', us: '9.5', eur: '43', cm: '27.5' },
  { br: '43', us: '10.5', eur: '44', cm: '28.0' },
  { br: '44', us: '11.5', eur: '45', cm: '29.0' },
];

export default function SizeGuideModal({ isOpen, onClose, selectedSize }) {
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 py-6 sm:p-6"
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
          aria-labelledby="size-guide-title"
          className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[1.85rem] bg-[var(--surface-solid)] p-6 shadow-2xl border border-[var(--line)] sm:p-8"
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg)]/80 text-xl font-bold text-[var(--text)] backdrop-blur-md transition-transform hover:scale-110 border border-[var(--line)]"
            aria-label="Fechar guia de medidas"
          >
            ×
          </button>

          <div>
            <p className="section-kicker">Guia de Caimento &amp; Medidas</p>
            <h2 id="size-guide-title" className="mt-1 text-2xl font-extrabold text-[var(--text)]">
              Tabela de Medidas de Tênis
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Forma padrão (True to Size). Recomendamos escolher o número que você costuma calçar.
            </p>
          </div>

          {/* Size Conversion Table */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface)] text-[var(--text)] font-bold border-b border-[var(--line)]">
                <tr>
                  <th className="py-3 px-3 text-center">BR</th>
                  <th className="py-3 px-3 text-center">US (Masc)</th>
                  <th className="py-3 px-3 text-center">EUR</th>
                  <th className="py-3 px-3 text-center">Centímetros (cm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] text-[var(--text)]">
                {SIZE_TABLE.map((row) => {
                  const isCurrent = String(row.br) === String(selectedSize);
                  return (
                    <tr
                      key={row.br}
                      className={`transition-colors ${isCurrent ? 'bg-[var(--accent)]/15 font-bold text-[var(--accent)]' : 'hover:bg-[var(--surface)]/50'}`}
                    >
                      <td className="py-2.5 px-3 text-center font-bold">
                        {row.br} {isCurrent && '★'}
                      </td>
                      <td className="py-2.5 px-3 text-center">{row.us}</td>
                      <td className="py-2.5 px-3 text-center">{row.eur}</td>
                      <td className="py-2.5 px-3 text-center">{row.cm} cm</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* How to Measure */}
          <div className="mt-6 rounded-2xl bg-[var(--bg)] p-5 border border-[var(--line)] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              📐 Como medir o seu pé corretamente:
            </h3>
            <ol className="space-y-2 text-xs text-[var(--muted)] list-decimal pl-4 leading-relaxed">
              <li>Pise sobre uma folha de papel encostando o calcanhar na parede.</li>
              <li>Faça um traço no papel exatamente onde termina o seu dedo mais longo.</li>
              <li>Meça a distância entre a borda da folha e o traço com uma régua em centímetros.</li>
              <li>Compare a medida em <strong>cm</strong> com a tabela acima para encontrar o seu tamanho BR ideal.</li>
            </ol>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="buy-button px-6 py-2.5 rounded-xl text-xs font-bold"
            >
              Entendido
            </button>
          </div>
        </motion.section>
      </div>
    </AnimatePresence>
  );
}
