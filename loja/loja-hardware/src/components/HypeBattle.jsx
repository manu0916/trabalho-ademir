export default function HypeBattle() {
  return (
    <section className="hype-battle-section mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-24 border-t border-[var(--line)]">
      <div className="mx-auto max-w-2xl text-center">
        <p className="section-kicker text-xs font-black uppercase tracking-widest text-[var(--accent-strong)]">
          Votação da comunidade
        </p>
        <h2 className="section-title mt-2 text-3xl font-black sm:text-4xl">
          Nenhuma batalha publicada agora.
        </h2>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Este espaço só exibirá opções e resultados quando houver uma votação registrada pela loja.
        </p>
      </div>
    </section>
  );
}
