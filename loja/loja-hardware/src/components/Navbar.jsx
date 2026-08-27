import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import '../styles/navigation.css';
import SafeImage from './ui/SafeImage';

const BASE_NAV_LINKS = [
  { label: 'Novidades', target: 'new' },
  { label: 'Sneakers', target: 'catalog' },
  { label: 'Ofertas', target: 'offers', accent: true },
];

const NAV_HREFS = {
  home: '/',
  new: '/novidades',
  catalog: '/sneakers',
  offers: '/ofertas',
};

const PRICE_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function getProductImage(product) {
  if (typeof product?.imageUrl === 'string' && product.imageUrl) return product.imageUrl;
  if (!Array.isArray(product?.images)) return '';
  return [...product.images]
    .sort((first, second) => Number(first?.sortOrder || 0) - Number(second?.sortOrder || 0))
    .find((image) => image?.imageUrl)?.imageUrl || '';
}

function KicksSunMark() {
  return (
    <svg className="kicks-sun" viewBox="0 0 52 52" aria-hidden="true">
      <g className="kicks-sun__rays" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4">
        <path d="M26 2.8v5.1M26 44.1v5.1M2.8 26h5.1M44.1 26h5.1" />
        <path d="m9.6 9.6 3.6 3.6M38.8 38.8l3.6 3.6M9.6 42.4l3.6-3.6M38.8 13.2l3.6-3.6" />
      </g>
      <circle className="kicks-sun__disc" cx="26" cy="26" r="14.8" />
      <path
        className="kicks-sun__k"
        d="M20.5 17.8v16.4m.3-7.8 9.4-8.6m-7.5 6.9 9.1 9.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.4"
      />
    </svg>
  );
}

export default function Navbar({
  storeName,
  cartCount = 0,
  onOpenCart,
  currentView,
  searchQuery,
  onSearchChange,
  customerSession,
  onCustomerAccess,
  onCustomerAccount,
  onCustomerLogout,
  wishlistCount = 0,
  onOpenWishlist,
  onOpenSearch,
  onNavigate,
  onOpenProduct,
  categories = [],
  products = [],
  activeTarget = 'home',
}) {
  const [isCompact, setIsCompact] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMegaOpen, setIsMegaOpen] = useState(false);
  const mobileMenuId = useId();
  const megaMenuId = useId();
  const menuToggleRef = useRef(null);
  const megaToggleRef = useRef(null);
  const isShop = currentView !== 'admin';
  const customerName = customerSession?.username || customerSession?.name || 'Minha conta';
  const categoryLinks = [...new Set((Array.isArray(categories) ? categories : [])
    .map((category) => String(category || '').trim())
    .filter(Boolean))]
    .slice(0, 4)
    .map((category) => ({ label: category, target: 'catalog', query: category }));
  const navigationLinks = [BASE_NAV_LINKS[0], BASE_NAV_LINKS[1], ...categoryLinks, BASE_NAV_LINKS[2]];
  const featuredProducts = (Array.isArray(products) ? products : [])
    .filter((product) => product?.id && product?.name)
    .slice(0, 2);

  useEffect(() => {
    const updateHeader = () => setIsCompact(window.scrollY > 28);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        window.requestAnimationFrame(() => menuToggleRef.current?.focus());
      }
    };
    const closeOnDesktop = () => {
      if (window.matchMedia('(min-width: 70rem)').matches) setIsMenuOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnDesktop);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnDesktop);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMegaOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setIsMegaOpen(false);
      window.requestAnimationFrame(() => megaToggleRef.current?.focus());
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMegaOpen]);

  const fallbackNavigate = (target, options = {}) => {
    const base = NAV_HREFS[target] || NAV_HREFS.catalog;
    const query = String(options.query || '').trim();
    window.location.assign(query ? `${base}?busca=${encodeURIComponent(query)}` : base);
  };

  const navigate = (target, options = {}) => {
    setIsMenuOpen(false);
    setIsMegaOpen(false);
    if (onNavigate) onNavigate(target, options);
    else fallbackNavigate(target, options);
  };

  const linkHref = (item) => {
    const base = NAV_HREFS[item.target] || NAV_HREFS.catalog;
    return item.query ? `${base}?busca=${encodeURIComponent(item.query)}` : base;
  };

  const handleNavigationLink = (event, item) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(item.target, item.query ? { query: item.query } : {});
  };

  const openSearch = () => {
    setIsMenuOpen(false);
    setIsMegaOpen(false);
    if (onOpenSearch) {
      onOpenSearch();
      return;
    }

    if (typeof onSearchChange === 'function' && searchQuery) onSearchChange(searchQuery);
    fallbackNavigate('catalog');
  };

  const openCustomer = () => {
    setIsMenuOpen(false);
    setIsMegaOpen(false);
    if (customerSession) onCustomerAccount?.();
    else onCustomerAccess?.();
  };

  const openWishlist = () => {
    setIsMenuOpen(false);
    setIsMegaOpen(false);
    onOpenWishlist?.();
  };

  const openCart = () => {
    setIsMenuOpen(false);
    setIsMegaOpen(false);
    onOpenCart?.();
  };

  const logoutCustomer = () => {
    setIsMenuOpen(false);
    setIsMegaOpen(false);
    onCustomerLogout?.();
  };

  const handleProductLink = (event, product) => {
    if (
      !onOpenProduct
      || event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;
    event.preventDefault();
    setIsMegaOpen(false);
    onOpenProduct(product);
  };

  return (
    <header className={`kicks-navigation${isCompact ? ' kicks-navigation--compact' : ''}`}>
      <a className="kicks-navigation__skip" href="#main-content">Pular para o conteúdo</a>

      <div className="kicks-navigation__shell">
        <div className="kicks-navigation__row">
          <a
            href="/"
            className="kicks-brand"
            onClick={(event) => handleNavigationLink(event, { target: 'home' })}
            aria-label="Kicks Store — ir para o início"
          >
            <span className="kicks-brand__mark"><KicksSunMark /></span>
            <span className="kicks-brand__copy">
              <strong>{storeName || 'Kicks Store'}</strong>
              <small>Calce a felicidade</small>
            </span>
          </a>

          <div
            className="kicks-navigation__desktop-zone"
            onMouseLeave={() => setIsMegaOpen(false)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsMegaOpen(false);
            }}
          >
            <nav className="kicks-navigation__desktop-links" aria-label="Navegação principal">
              {navigationLinks.map((item) => {
                const link = (
                  <a
                    href={linkHref(item)}
                    key={`${item.target}-${item.label}`}
                    className={`kicks-navigation__link${item.accent ? ' kicks-navigation__link--accent' : ''}`}
                    onClick={(event) => handleNavigationLink(event, item)}
                    onMouseEnter={() => {
                      if (item.target === 'catalog' && !item.query) setIsMegaOpen(true);
                    }}
                    onFocus={() => {
                      if (item.target === 'catalog' && !item.query) setIsMegaOpen(true);
                    }}
                    aria-current={activeTarget === item.target && (!item.query || searchQuery === item.query) ? 'page' : undefined}
                  >
                    {item.label}
                  </a>
                );

                if (item.target !== 'catalog' || item.query) return link;
                return (
                  <span className="kicks-navigation__catalog-trigger" key={`${item.target}-${item.label}`}>
                    {link}
                    <button
                      ref={megaToggleRef}
                      type="button"
                      className="kicks-navigation__mega-toggle"
                      aria-label="Mostrar categorias e destaques de sneakers"
                      aria-expanded={isMegaOpen}
                      aria-controls={megaMenuId}
                      onMouseEnter={() => setIsMegaOpen(true)}
                      onFocus={() => setIsMegaOpen(true)}
                      onClick={() => setIsMegaOpen(true)}
                    >
                      <ChevronDown aria-hidden="true" />
                    </button>
                  </span>
                );
              })}
            </nav>

            <section
              id={megaMenuId}
              className={`kicks-mega-menu${isMegaOpen ? ' kicks-mega-menu--open' : ''}`}
              aria-label="Descobrir sneakers"
              aria-hidden={!isMegaOpen}
              onMouseEnter={() => setIsMegaOpen(true)}
            >
              <div className="kicks-mega-menu__intro">
                <span className="kicks-mega-menu__sun" aria-hidden="true"><KicksSunMark /></span>
                <p>Escolha seu caminho</p>
                <h2>Um catálogo, muitas energias.</h2>
                <a
                  href="/sneakers"
                  tabIndex={isMegaOpen ? 0 : -1}
                  onClick={(event) => handleNavigationLink(event, { target: 'catalog' })}
                >
                  Ver todos <ArrowRight aria-hidden="true" />
                </a>
              </div>

              <div className="kicks-mega-menu__categories">
                <p className="kicks-mega-menu__label">Categorias do catálogo</p>
                {categoryLinks.length > 0 ? (
                  <div className="kicks-mega-menu__category-grid">
                    {categoryLinks.map((item, index) => (
                      <a
                        key={item.label}
                        href={linkHref(item)}
                        className={`kicks-mega-menu__category kicks-mega-menu__category--${(index % 4) + 1}`}
                        tabIndex={isMegaOpen ? 0 : -1}
                        onClick={(event) => handleNavigationLink(event, item)}
                      >
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <strong>{item.label}</strong>
                        <ArrowRight aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="kicks-mega-menu__empty">As categorias aparecem aqui assim que o catálogo estiver disponível.</p>
                )}
                <a
                  className="kicks-mega-menu__arrival-link"
                  href="/novidades"
                  tabIndex={isMegaOpen ? 0 : -1}
                  onClick={(event) => handleNavigationLink(event, { target: 'new' })}
                >
                  Acabaram de chegar <ArrowRight aria-hidden="true" />
                </a>
              </div>

              <div className="kicks-mega-menu__products">
                <p className="kicks-mega-menu__label">Na vitrine agora</p>
                {featuredProducts.length > 0 ? featuredProducts.map((product) => {
                  const imageUrl = getProductImage(product);
                  const numericPrice = Number(product.price);
                  return (
                    <a
                      key={product.id}
                      href={`/produto/${encodeURIComponent(product.id)}`}
                      className="kicks-mega-product"
                      tabIndex={isMegaOpen ? 0 : -1}
                      onClick={(event) => handleProductLink(event, product)}
                    >
                      <span className="kicks-mega-product__image">
                        <SafeImage
                          src={imageUrl}
                          alt=""
                          loading="lazy"
                          fallback={<span className="kicks-mega-product__fallback"><KicksSunMark /></span>}
                        />
                      </span>
                      <span>
                        <small>{product.category || 'Sneaker'}</small>
                        <strong>{product.name}</strong>
                        <b>{Number.isFinite(numericPrice) ? PRICE_FORMATTER.format(numericPrice) : 'Ver detalhes'}</b>
                      </span>
                    </a>
                  );
                }) : (
                  <p className="kicks-mega-menu__empty">Os pares da vitrine aparecem aqui quando a API responder.</p>
                )}
              </div>
            </section>
          </div>

          <div className="kicks-navigation__actions" aria-label="Ações da loja">
            {isShop && (
              <>
                <button type="button" className="kicks-action" onClick={openSearch} aria-label="Abrir pesquisa">
                  <Search aria-hidden="true" />
                  <span className="kicks-action__label">Buscar</span>
                </button>

                <button
                  type="button"
                  className="kicks-action kicks-action--desktop"
                  onClick={openWishlist}
                  aria-label={`Abrir favoritos${wishlistCount ? `, ${wishlistCount} item${wishlistCount === 1 ? '' : 's'}` : ''}`}
                >
                  <Heart aria-hidden="true" />
                  <span className="kicks-action__label">Favoritos</span>
                  {wishlistCount > 0 && <span className="kicks-action__count">{wishlistCount > 99 ? '99+' : wishlistCount}</span>}
                </button>

                <button
                  type="button"
                  className="kicks-action kicks-action--desktop"
                  onClick={openCustomer}
                  aria-label={customerSession ? `Abrir conta de ${customerName}` : 'Entrar ou criar conta'}
                >
                  <User aria-hidden="true" />
                  <span className="kicks-action__label">{customerSession ? customerName : 'Conta'}</span>
                </button>

                <button
                  type="button"
                  className="kicks-action kicks-action--cart"
                  onClick={openCart}
                  aria-label={`Abrir sacola${cartCount ? `, ${cartCount} item${cartCount === 1 ? '' : 's'}` : ''}`}
                >
                  <ShoppingBag aria-hidden="true" />
                  <span className="kicks-action__label">Sacola</span>
                  <span className="kicks-action__count kicks-action__count--cart">{cartCount > 99 ? '99+' : cartCount}</span>
                </button>
              </>
            )}

            {!isShop && (
              <button
                type="button"
                className="kicks-action kicks-action--return kicks-action--desktop"
                onClick={() => navigate('home')}
                aria-label="Voltar para a loja"
              >
                <LayoutDashboard aria-hidden="true" />
                <span className="kicks-action__label">Loja</span>
              </button>
            )}

            <button
              ref={menuToggleRef}
              type="button"
              className="kicks-menu-toggle"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-expanded={isMenuOpen}
              aria-controls={mobileMenuId}
              aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div
          id={mobileMenuId}
          className={`kicks-mobile-menu${isMenuOpen ? ' kicks-mobile-menu--open' : ''}`}
          aria-hidden={!isMenuOpen}
        >
          <nav className="kicks-mobile-menu__links" aria-label="Navegação principal no celular">
            {navigationLinks.map((item) => (
              <a
                href={linkHref(item)}
                key={`${item.target}-${item.label}`}
                className={item.accent ? 'kicks-mobile-menu__link kicks-mobile-menu__link--accent' : 'kicks-mobile-menu__link'}
                onClick={(event) => handleNavigationLink(event, item)}
                tabIndex={isMenuOpen ? 0 : -1}
                aria-current={activeTarget === item.target && (!item.query || searchQuery === item.query) ? 'page' : undefined}
              >
                {item.label}
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </nav>

          <div className="kicks-mobile-menu__utilities">
            {isShop && (
              <>
                <button type="button" onClick={openWishlist} tabIndex={isMenuOpen ? 0 : -1}>
                  <Heart aria-hidden="true" /> Favoritos {wishlistCount > 0 && <span>{wishlistCount}</span>}
                </button>
                <button type="button" onClick={openCustomer} tabIndex={isMenuOpen ? 0 : -1}>
                  <User aria-hidden="true" /> {customerSession ? customerName : 'Entrar ou criar conta'}
                </button>
                {customerSession && onCustomerLogout && (
                  <button type="button" onClick={logoutCustomer} tabIndex={isMenuOpen ? 0 : -1}>
                    <LogOut aria-hidden="true" /> Sair da conta
                  </button>
                )}
              </>
            )}
            {!isShop && (
              <button type="button" onClick={() => navigate('home')} tabIndex={isMenuOpen ? 0 : -1}>
                <LayoutDashboard aria-hidden="true" /> Voltar para a loja
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
