export default function EditorialLookbook() {
  return (
    <section className="editorial-section mx-auto max-w-[90rem] px-5 py-14 sm:px-8 sm:py-20 border-t-hairline">
      <div className="mx-auto max-w-2xl text-center">
        <p className="section-kicker text-xs font-black uppercase tracking-widest text-[var(--accent-strong)]">
          Espaço editorial
        </p>
        <h2 className="section-title mt-2 text-3xl font-black sm:text-4xl">
          Novos ensaios ainda não foram publicados.
        </h2>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Quando houver imagens e produtos editoriais cadastrados, as combinações aparecerão aqui sem preços ou itens fictícios.
        </p>
      </div>
    </section>
  );
}
