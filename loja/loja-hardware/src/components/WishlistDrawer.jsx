import { useRef } from 'react';
import { ArrowRight, Heart, Sparkles, X } from 'lucide-react';
import useModalAccessibility from '../hooks/useModalAccessibility';
import { getProductImages } from '../utils/productImages';
import KicksSun from './ui/KicksSun';
import SafeImage from './ui/SafeImage';

function formatPrice(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function WishlistDrawer({
  isOpen,
  onClose,
  wishlistIds = [],
  products = [],
  onToggleWishlist,
  onOpenProductDetail,
  onExplore,
}) {
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  useModalAccessibility({ isOpen, dialogRef: drawerRef, initialFocusRef: closeButtonRef, onClose });
  if (!isOpen) return null;

  const wishlistProducts = products.filter((product) => wishlistIds.includes(product.id));

  return (
    <div data-modal-root="true" className="drawer-root">
      <button type="button" className="drawer-scrim" onClick={onClose} aria-label="Fechar favoritos" />
      <aside ref={drawerRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="wishlist-title" className="wishlist-drawer">
        <header className="cart-drawer-header">
          <div><p className="eyebrow">Pares que fizeram seu olho brilhar</p><h2 id="wishlist-title">Favoritos <span>{wishlistProducts.length}</span></h2></div>
          <button ref={closeButtonRef} type="button" className="icon-button" onClick={onClose} aria-label="Fechar favoritos"><X /></button>
        </header>

        {wishlistProducts.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-art wishlist-empty-art" aria-hidden="true"><KicksSun /><Heart /></div>
            <p className="eyebrow">Ainda não rolou match</p>
            <h3>Seu coração está livre para escolher.</h3>
            <p>Quando encontrar aquele sneaker, toque no coração para guardar aqui.</p>
            <button type="button" className="button button-primary" onClick={onExplore || onClose}>Descobrir meu par <ArrowRight size={17} /></button>
          </div>
        ) : (
          <div className="wishlist-content">
            <div className="wishlist-note"><Sparkles aria-hidden="true" /> Seus favoritos ficam salvos neste navegador.</div>
            <div className="wishlist-list">
              {wishlistProducts.map((product) => {
                const image = getProductImages(product)[0];
                return (
                  <article key={product.id} className="wishlist-item">
                    <button type="button" className="wishlist-item-main" onClick={() => onOpenProductDetail?.(product)}>
                      <span className="wishlist-item-media">
                        <SafeImage
                          src={image?.imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fallback={<Heart aria-hidden="true" />}
                        />
                      </span>
                      <span className="wishlist-item-copy">
                        <small>{product.category || 'Sneaker'}</small>
                        <strong>{product.name}</strong>
                        <b>{formatPrice(product.price)}</b>
                      </span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                    <button type="button" className="wishlist-remove" onClick={() => onToggleWishlist?.(product.id)} aria-label={`Remover ${product.name} dos favoritos`}><Heart fill="currentColor" /></button>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
