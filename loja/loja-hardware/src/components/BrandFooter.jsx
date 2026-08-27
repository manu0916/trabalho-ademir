import { ArrowUp, AtSign, Heart, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import KicksSun from './ui/KicksSun';

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function text(value) {
  return hasText(value) ? value.trim() : '';
}

const FOOTER_LINKS = [
  { label: 'Início', target: 'home', href: '/' },
  { label: 'Novidades', target: 'new', href: '/novidades' },
  { label: 'Sneakers', target: 'catalog', href: '/sneakers' },
  { label: 'Ofertas', target: 'offers', href: '/ofertas' },
];

export default function BrandFooter({ storeName, footerSettings, onNavigate, onOpenAccount }) {
  const settings = footerSettings || {};
  const brandWordmark = text(settings.wordmark) || text(storeName) || 'KICKS STORE';
  const tagline = text(settings.brandTagline) || 'Calce a felicidade. Viva o seu ritmo.';
  const addressLine1 = text(settings.addressLine1);
  const addressLine2 = text(settings.addressLine2);
  const storeHoursLine1 = text(settings.storeHoursLine1);
  const storeHoursLine2 = text(settings.storeHoursLine2);
  const contactEmail = text(settings.contactEmail);
  const contactPhone = text(settings.contactPhone);
  const instagramHandle = text(settings.instagramHandle);
  const authBadgeTitle = text(settings.authBadgeTitle);
  const authBadgeDetail = text(settings.authBadgeDetail);
  const hasLocation = Boolean(addressLine1 || addressLine2);
  const hasHours = Boolean(storeHoursLine1 || storeHoursLine2);
  const hasContact = Boolean(contactEmail || contactPhone || instagramHandle);
  const hasAuthenticity = Boolean(authBadgeTitle || authBadgeDetail);
  const handleNavigation = (event, target) => {
    if (
      !onNavigate
      || event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;
    event.preventDefault();
    onNavigate(target);
  };

  const backToTop = () => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <footer className="brand-footer">
      <div className="footer-sunrise" aria-hidden="true"><KicksSun /></div>
      <div className="footer-shell">
        <div className="footer-lead">
          <div className="footer-brand">
            <KicksSun />
            <div><strong>{brandWordmark}</strong><span>{tagline}</span></div>
          </div>
          <div>
            <p className="eyebrow">Kicks Club</p>
            <h2>Mais Kicks. Mais favoritos. Mais alegria.</h2>
            <p>Entre na sua conta para salvar dados de entrega e deixar a próxima compra mais simples.</p>
            {onOpenAccount && <button type="button" className="button button-primary" onClick={onOpenAccount}>Abrir minha conta <Heart size={17} /></button>}
          </div>
        </div>

        <div className="footer-grid">
          <section>
            <h3>{text(settings.navTitle) || 'Explore'}</h3>
            {FOOTER_LINKS.map((item) => (
              <a key={item.target} href={item.href} onClick={(event) => handleNavigation(event, item.target)}>
                {item.label}
              </a>
            ))}
          </section>

          {hasLocation && (
            <section>
              <h3>{text(settings.locationTitle) || 'Loja'}</h3>
              <p>
                <MapPin size={16} />
                <span>{addressLine1}{addressLine2 && <small>{addressLine2}</small>}</span>
              </p>
            </section>
          )}

          {hasHours && (
            <section>
              <h3>{text(settings.hoursTitle) || 'Atendimento'}</h3>
              <p>
                <Sparkles size={16} />
                <span>{storeHoursLine1}{storeHoursLine2 && <small>{storeHoursLine2}</small>}</span>
              </p>
            </section>
          )}

          {hasContact && (
            <section>
              <h3>Fale com a Kicks</h3>
              {contactEmail && <a href={`mailto:${contactEmail}`}><Mail size={16} /> {contactEmail}</a>}
              {contactPhone && <a href={`tel:${contactPhone.replace(/\D/g, '')}`}><Phone size={16} /> {contactPhone}</a>}
              {instagramHandle && <span><AtSign size={16} /> {instagramHandle}</span>}
            </section>
          )}

          {hasAuthenticity && (
            <section className="footer-auth-card">
              <h3>{text(settings.authTitle) || 'Sobre os produtos'}</h3>
              {authBadgeTitle && <strong>{authBadgeTitle}</strong>}
              {authBadgeDetail && <p>{authBadgeDetail}</p>}
            </section>
          )}
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {brandWordmark}. {text(settings.copyrightText) || 'Todos os direitos reservados.'}</span>
          {text(settings.citiesRail) && <span>{text(settings.citiesRail)}</span>}
          {text(settings.cnpjText) && <span>{text(settings.cnpjText)}</span>}
          <button type="button" onClick={backToTop}>{text(settings.backToTopText) || 'Voltar ao topo'} <ArrowUp size={15} /></button>
        </div>

        <p className="footer-wordmark" aria-hidden="true">{brandWordmark}</p>
      </div>
    </footer>
  );
}
