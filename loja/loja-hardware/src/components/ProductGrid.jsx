import { motion } from 'framer-motion';

export default function ProductGrid({ products, onAddToCart, theme }) {
  const handleImageError = (event) => {
    event.currentTarget.style.display = 'none';
    event.currentTarget.parentElement.classList.add('image-unavailable');
  };

  return (
    <section id="products" className="collection-section mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="section-kicker">A vitrine da semana</p>
          <h2 className="section-title">{theme.collectionLabel}</h2>
        </div>
        <p className="collection-intro max-w-xs text-sm leading-6">Produtos especiais para você encontrar o que combina com seu momento.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product, index) => (
          <motion.article
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.46, delay: Math.min(index * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
            className="product-card group flex flex-col justify-between overflow-hidden rounded-[1.35rem] transition-all duration-300"
          >
            <div className="product-image relative flex h-56 items-center justify-center overflow-hidden p-4">
              <img src={product.imageUrl} alt={product.name} onError={handleImageError} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <span className="product-index absolute left-4 top-4" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="product-badge absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs backdrop-blur-md">{theme.productLabel}</span>
            </div>

            <div className="flex flex-grow flex-col justify-between p-5">
              <div>
                <h3 className="product-title mb-1 text-lg font-semibold transition-colors">{product.name}</h3>
                <p className="mb-4 line-clamp-2 text-xs text-[var(--muted)]">{product.description || 'Uma escolha especial para a sua coleção.'}</p>
              </div>

              <div className="product-footer mt-auto flex items-center justify-between pt-4">
                <div>
                  <span className="block text-xs text-[var(--muted)]">À vista no Pix</span>
                  <span className="product-price text-xl font-bold">R$ {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className={`mt-1 block text-xs ${product.stockQuantity > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{product.stockQuantity > 0 ? `${product.stockQuantity} em estoque` : 'Esgotado'}</span>
                </div>
                <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => onAddToCart(product)} disabled={product.stockQuantity < 1} className="buy-button cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45">
                  {product.stockQuantity > 0 ? 'Comprar' : 'Esgotado'}
                </motion.button>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      {products.length === 0 && <p className="empty-state py-12 text-center text-sm">Nenhum produto encontrado.</p>}
    </section>
  );
}
