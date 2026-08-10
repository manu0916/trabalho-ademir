export default function BrandFooter({ storeName, theme }) {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="brand-footer">
      <div className="brand-footer-inner mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="brand-footer-top">
          <div>
            <p className="section-kicker">{theme.edition}</p>
            <p className="brand-footer-statement">{theme.footerStatement}</p>
          </div>
          <button type="button" onClick={scrollToTop} className="back-to-top">
            Voltar ao topo <span aria-hidden="true">↑</span>
          </button>
        </div>

        <div className="brand-footer-wordmark" aria-label={storeName}>{storeName}</div>

        <div className="brand-footer-meta">
          <span>{theme.rail}</span>
          <span>Compra segura · Atendimento humano</span>
          <span>© {new Date().getFullYear()} {storeName}</span>
        </div>
      </div>
    </footer>
  );
}
