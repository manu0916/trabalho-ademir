import { useRef } from 'react';
import { ArrowRight, Minus, Plus, ShieldCheck, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react';
import useModalAccessibility from '../hooks/useModalAccessibility';
import KicksSun from './ui/KicksSun';
import SafeImage from './ui/SafeImage';

function formatPrice(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems = [],
  onRemoveItem,
  onChangeQuantity,
  onCheckout,
  onExplore,
}) {
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  useModalAccessibility({
    isOpen,
    dialogRef: drawerRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  if (!isOpen) return null;

  const totalItems = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);

  return (
    <div data-modal-root="true" className="drawer-root">
      <button type="button" className="drawer-scrim" onClick={onClose} aria-label="Fechar sacola" />
      <aside
        ref={drawerRef}
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="cart-drawer"
      >
        <header className="cart-drawer-header">
          <div>
            <p className="eyebrow">Sua seleção feliz</p>
            <h2 id="cart-title">Sacola <span>{totalItems}</span></h2>
          </div>
          <button ref={closeButtonRef} type="button" className="icon-button" onClick={onClose} aria-label="Fechar sacola"><X /></button>
        </header>

        {cartItems.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-art" aria-hidden="true"><KicksSun /><ShoppingBag /></div>
            <p className="eyebrow">Espaço para um novo favorito</p>
            <h3>Seu próximo par ainda está por aí.</h3>
            <p>Explore a vitrine e, quando rolar o match, ele aparece aqui.</p>
            <button type="button" className="button button-primary" onClick={onExplore || onClose}>Explorar sneakers <ArrowRight size={17} /></button>
          </div>
        ) : (
          <>
            <div className="cart-celebration" role="status">
              <Sparkles aria-hidden="true" />
              <div><strong>Boa escolha.</strong><span>Seu par está guardado nesta sacola.</span></div>
            </div>

            <div className="cart-items">
              {cartItems.map((item) => {
                const itemKey = item.cartKey || item.id;
                const quantity = Number(item.quantity || 1);
                const stock = Number(item.stockQuantity || 0);
                const canIncrease = stock > 0 && quantity < stock;
                return (
                  <article key={itemKey} className="cart-item">
                    <div className="cart-item-media">
                      <SafeImage
                        src={item.imageUrl}
                        alt=""
                        width="104"
                        height="104"
                        loading="lazy"
                        decoding="async"
                        fallback={<ShoppingBag aria-hidden="true" />}
                      />
                    </div>
                    <div className="cart-item-content">
                      <span>{item.category || 'Sneaker'}</span>
                      <h3>{item.name}</h3>
                      <p>{formatPrice(item.price)} cada</p>
                      {(item.selectedSize || item.selectedColor) && (
                        <small>{[item.selectedSize, item.selectedColor].filter(Boolean).join(' · ')}</small>
                      )}
                      <div className="cart-item-actions">
                        <div className="quantity-stepper" aria-label={`Quantidade de ${item.name}`}>
                          <button type="button" onClick={() => onChangeQuantity?.(itemKey, quantity - 1)} aria-label={`Diminuir quantidade de ${item.name}`}><Minus /></button>
                          <output aria-live="polite">{quantity}</output>
                          <button type="button" disabled={!canIncrease} onClick={() => onChangeQuantity?.(itemKey, quantity + 1)} aria-label={`Aumentar quantidade de ${item.name}`}><Plus /></button>
                        </div>
                        <button type="button" className="cart-remove" onClick={() => onRemoveItem?.(itemKey)} aria-label={`Remover ${item.name}`}><Trash2 /><span>Remover</span></button>
                      </div>
                    </div>
                    <strong className="cart-item-total">{formatPrice(Number(item.price) * quantity)}</strong>
                  </article>
                );
              })}
            </div>

            <footer className="cart-summary">
              <div className="cart-summary-row"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
              <p>O preço e o estoque são confirmados novamente pelo servidor antes de criar o pedido.</p>
              <button type="button" className="button button-primary" onClick={onCheckout}>Continuar para entrega <ArrowRight size={18} /></button>
              <span className="cart-security"><ShieldCheck size={16} /> Checkout conectado à sua conta e ao estoque real.</span>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
