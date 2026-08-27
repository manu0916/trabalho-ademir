import { ArrowLeft, Footprints } from 'lucide-react';
import KicksSun from './ui/KicksSun';

export default function NotFoundPage({ onHome }) {
  const handleHomeClick = (event) => {
    if (
      !onHome
      || event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;

    event.preventDefault();
    onHome();
  };

  return (
    <main id="main-content" className="not-found-page" tabIndex={-1}>
      <div className="not-found-art" aria-hidden="true">
        <KicksSun className="not-found-sun" />
        <span className="not-found-number">404</span>
        <Footprints className="not-found-footprints" />
      </div>
      <p className="eyebrow">Esse caminho ficou para trás</p>
      <h1>Ops… esse sneaker saiu correndo.</h1>
      <p>A página que você procurou não está por aqui, mas a próxima boa descoberta está a um passo.</p>
      <a href="/" className="button button-primary" onClick={handleHomeClick}>
        <ArrowLeft size={18} aria-hidden="true" /> Voltar para a loja
      </a>
    </main>
  );
}
