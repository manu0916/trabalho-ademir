import { motion } from 'framer-motion';

const HERO_MOTIFS = {
  grid: ['✦', '◌', '✳'],
  motion: ['↗', '⌁', '✦'],
  petals: ['✿', '❋', '◦'],
};

export default function StoreHero({ theme, onExplore }) {
  const motif = HERO_MOTIFS[theme.motif] || HERO_MOTIFS.grid;

  return (
    <section className="hero-section overflow-hidden">
      <div className="hero-texture" aria-hidden="true" />
      <div className="hero-orb hero-orb-one" aria-hidden="true" />
      <div className="hero-orb hero-orb-two" aria-hidden="true" />
      <div className="hero-doodles" aria-hidden="true">
        {motif.map((mark, index) => <span key={`${mark}-${index}`} className={`hero-doodle hero-doodle-${index + 1}`}>{mark}</span>)}
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
        >
          <div className="hero-image-halo" aria-hidden="true" />
          <div className="hero-image-shape" aria-hidden="true" />
          <div className="hero-image-frame">
            <img
              src={theme.image}
              alt={theme.imageAlt}
              className="hero-image"
              width="1400"
              height="1050"
              decoding="async"
              fetchPriority="high"
            />
          </div>
          <div className="hero-sticker"><span>{theme.stickerLabel}</span></div>
          <div className="hero-card">
            <div className="hero-card-topline"><span className="hero-card-mark" aria-hidden="true">{motif[0]}</span><small>{theme.edition}</small></div>
            <strong>{theme.heroNote}</strong>
            <p>{theme.heroDetail}</p>
          </div>
          <span className="hero-figure-index" aria-hidden="true">{theme.id === 'hardware' ? '01—03' : theme.id === 'sneakers' ? '07—24' : 'HOJE'}</span>
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
