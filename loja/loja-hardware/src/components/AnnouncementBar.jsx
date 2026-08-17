import { useState } from 'react';

export default function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="announcement-bar relative z-50 bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-bold shadow-md">
      <div className="mx-auto max-w-[90rem] flex items-center justify-between gap-3">
        <div className="flex-1 text-center flex items-center justify-center gap-2 flex-wrap sm:gap-4">
          <span className="inline-flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider">
            ⚡ Promoção Kicks
          </span>
          <span>
            FRETE GRÁTIS PARA TODO O BRASIL ACIMA DE R$ 499 • CUPOM: <span className="underline decoration-2 font-black cursor-pointer" onClick={() => navigator.clipboard?.writeText('KICKS10')}>KICKS10 (10% OFF)</span>
          </span>
          <span className="hidden md:inline text-[11px] opacity-85">
            • 12x no cartão • 1ª Troca Grátis
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="opacity-70 hover:opacity-100 transition-opacity p-0.5 font-black text-sm"
          aria-label="Fechar anúncio"
        >
          ×
        </button>
      </div>
    </div>
  );
}
