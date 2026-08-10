import { motion } from 'framer-motion';

export default function ProductGrid({ products, onAddToCart, theme }) {
  const handleImageError = (event) => {
    event.currentTarget.style.display = 'none';
    event.currentTarget.parentElement.classList.add('image-unavailable');
  };

  return (
    <section id="products" className="collection-section mx-auto max-w-[90rem] px-5 py-20 sm:px-8 sm:py-28">
      <div className="collection-heading mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="collection-title-group">
          <p className="section-kicker">A vitrine da semana</p>
          <h2 className="section-title">{theme.collectionLabel}</h2>
        </div>
        <div className="collection-heading-side">
          <span className="collection-count">{String(products.length).padStart(2, '0')} itens</span>
          <p className="collection-intro max-w-xs text-sm leading-6">Produtos especiais para você encontrar o que combina com seu momento.</p>
        </div>
      </div>

      <div className="product-grid">
        {products.map((product, index) => (
          <motion.article
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.46, delay: Math.min(index * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
            className={`product-card product-card-${getCardVariant(index, products.length)} group flex flex-col justify-between overflow-hidden rounded-[1.35rem] transition-all duration-300`}
          >
            <div className="product-image relative flex items-center justify-center overflow-hidden">
              <img
                src={product.imageUrl}
                alt={product.name}
                onError={handleImageError}
                loading="lazy"
                decoding="async"
                width="720"
                height="720"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <span className="product-index absolute left-4 top-4" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="product-badge absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs backdrop-blur-md">{theme.productLabel}</span>
              <span className="product-image-corner" aria-hidden="true">{theme.edition}</span>
            </div>

            <div className="product-content flex flex-grow flex-col justify-between p-5">
              <div>
                <span className="product-category">{product.category || theme.category}</span>
                <h3 className="product-title mb-1 text-lg font-semibold transition-colors">{product.name}</h3>
                <p className="mb-4 line-clamp-2 text-xs text-[var(--muted)]">{product.description || 'Uma escolha especial para a sua coleção.'}</p>
              </div>

              <div className="product-footer mt-auto flex items-center justify-between pt-4">
                <div>
                  <span className="block text-xs text-[var(--muted)]">À vista no Pix</span>
                  <span className="product-price text-xl font-bold">R$ {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className={`product-stock mt-1 flex items-center gap-1.5 text-xs ${product.stockQuantity > 0 ? 'text-emerald-500' : 'text-rose-500'}`}><i />{product.stockQuantity > 0 ? `${product.stockQuantity} em estoque` : 'Esgotado'}</span>
                </div>
                <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => onAddToCart(product)} disabled={product.stockQuantity < 1} className="buy-button cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45" aria-label={product.stockQuantity > 0 ? `Adicionar ${product.name} à sacola` : `${product.name} esgotado`}>
                  <span>{product.stockQuantity > 0 ? 'Comprar' : 'Esgotado'}</span><b aria-hidden="true">+</b>
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

function getCardVariant(index, total) {
  if (total >= 3 && index % 6 === 0) return 'featured';
  if (index % 6 === 3) return 'portrait';
  return 'standard';
}
