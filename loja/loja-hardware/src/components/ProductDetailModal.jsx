import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getProductImages } from '../utils/productImages';
import { getCategoryLabel } from '../utils/catalogCategories';

const AVAILABLE_SIZES = ['37', '38', '39', '40', '41', '42', '43', '44'];

function getProductColorVariants(product) {
  const stock = product.stockQuantity || 0;
  if (stock <= 0) return [{ name: 'Padrão', stock: 0, hex: '#222' }];

  const stock1 = Math.max(1, Math.ceil(stock * 0.5));
  const stock2 = Math.max(0, Math.floor(stock * 0.3));
  const stock3 = Math.max(0, stock - stock1 - stock2);

  return [
    { name: 'Original Edition', stock: stock1, hex: '#1e1e24' },
    ...(stock2 > 0 ? [{ name: 'Preto & Branco', stock: stock2, hex: '#000000' }] : []),
    ...(stock3 > 0 ? [{ name: 'Edição Especial', stock: stock3, hex: '#e64a19' }] : []),
  ];
}

export default function ProductDetailModal({ product, isOpen, onClose, onAddToCart, theme }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  
  const colors = useMemo(() => (product ? getProductColorVariants(product) : []), [product]);
  const [selectedSize, setSelectedSize] = useState('40');
  const [selectedColor, setSelectedColor] = useState(() => colors[0]?.name || 'Padrão');
  
  const allImages = useMemo(() => (product ? getProductImages(product) : []), [product]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Reset selections when a new product is opened
  useEffect(() => {
    if (product) {
      const defaultColors = getProductColorVariants(product);
      setSelectedColor(defaultColors[0]?.name || 'Padrão');
      setSelectedSize('40');
      setActiveImageIndex(0);
    }
  }, [product]);

  // Modal accessibility
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const activeColorObj = colors.find((c) => c.name === selectedColor) || colors[0];
  const colorStock = activeColorObj?.stock ?? product.stockQuantity;
  const isAvailable = colorStock > 0;
  const activeImage = allImages[activeImageIndex] || { imageUrl: product.imageUrl, altText: product.name };

  const handleAdd = () => {
    if (!isAvailable) return;
    onAddToCart({
      ...product,
      selectedSize,
      selectedColor,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        className="product-detail-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 py-6 sm:p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          aria-hidden="true"
        />

        <motion.section
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-detail-title"
          className="product-detail-card relative z-10 w-full max-w-4xl overflow-hidden rounded-[1.85rem] bg-[var(--surface-solid)] p-6 shadow-2xl border border-[var(--line)] sm:p-8"
        >
          {/* Close Button */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg)]/80 text-xl font-bold text-[var(--text)] backdrop-blur-md transition-transform hover:scale-110 border border-[var(--line)]"
            aria-label="Fechar detalhes do produto"
          >
            ×
          </button>

          <div className="grid gap-8 md:grid-cols-12 md:items-start">
            
            {/* Gallery Column (Left) */}
            <div className="md:col-span-6 flex flex-col gap-4">
              <div className="product-detail-main-image relative aspect-square w-full overflow-hidden rounded-2xl bg-[var(--bg)] border border-[var(--line)]">
                <img
                  src={activeImage.imageUrl}
                  alt={activeImage.altText || product.name}
                  className="h-full w-full object-cover transition-all duration-300"
                />
                <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  {getCategoryLabel(product.category, theme?.category || 'Kicks')}
                </span>
              </div>

              {/* Thumbnails */}
              {allImages.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {allImages.map((img, idx) => (
                    <button
                      key={img.key || idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${activeImageIndex === idx ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30' : 'border-[var(--line)] opacity-60 hover:opacity-100'}`}
                      aria-label={`Ver foto ${idx + 1} de ${product.name}`}
                    >
                      <img src={img.imageUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details & Purchase Controls (Right) */}
            <div className="md:col-span-6 flex flex-col justify-between">
              <div>
                <p className="section-kicker">{theme?.edition || 'Sneakers & Streetwear'}</p>
                <h1 id="product-detail-title" className="mt-1 text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
                  {product.name}
                </h1>
                
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-3xl font-black text-[var(--text)]">
                    R$ {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-[var(--muted)]">em até 12x no cartão</span>
                </div>

                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                  {product.description || 'Modelo de alta performance com design exclusivo, materiais de alta durabilidade e amortecimento superior para o seu ritmo.'}
                </p>

                <hr className="my-6 border-[var(--line)]" />

                {/* Color Variations with Stock */}
                <div className="mb-5">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-[var(--text)]">
                      Cor: <span className="text-[var(--accent)]">{selectedColor}</span>
                    </span>
                    <span className={`text-xs font-bold ${colorStock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {colorStock > 0 ? `✓ ${colorStock} pares disponíveis` : '✕ Esgotado'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color) => {
                      const isSelected = selectedColor === color.name;
                      return (
                        <button
                          key={color.name}
                          type="button"
                          onClick={() => setSelectedColor(color.name)}
                          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold border transition-all ${isSelected ? 'border-[var(--accent)] bg-[var(--surface)] text-[var(--text)] ring-2 ring-[var(--accent)]/30' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--accent)]'}`}
                        >
                          <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ backgroundColor: color.hex }} />
                          <span>{color.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Size (Numeração) Selector */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-[var(--text)]">
                      Tamanho (BR): <span className="text-[var(--accent)] font-bold">{selectedSize}</span>
                    </span>
                    <span className="text-xs text-[var(--muted)]">Tabela de medidas BR</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {AVAILABLE_SIZES.map((size) => {
                      const isSelected = selectedSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`flex h-11 items-center justify-center rounded-xl text-sm font-bold border transition-all ${isSelected ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)] shadow-md scale-105' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)]'}`}
                          aria-pressed={isSelected}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Add to Cart CTA */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!isAvailable}
                  className="buy-button w-full cursor-pointer rounded-2xl py-4 text-base font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 shadow-xl"
                >
                  {isAvailable ? `Adicionar à Sacola (Tam ${selectedSize} • ${selectedColor})` : 'Esgotado nesta variação'}
                </button>
                <p className="mt-2.5 text-center text-xs text-[var(--muted)]">
                  ⚡ Envio rápido para todo o Brasil • Pagamento 100% seguro
                </p>
              </div>

            </div>

          </div>
        </motion.section>
      </div>
    </AnimatePresence>
  );
}
