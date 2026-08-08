import { motion } from 'framer-motion';

const categoryColors = {
  GPU: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', text: '#818cf8' },
  CPU: { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.3)', text: '#38bdf8' },
  RAM: { bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)', text: '#34d399' },
  SSD: { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', text: '#fbbf24' },
  Fonte: { bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', text: '#f87171' },
};

const defaultCat = { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)', text: '#818cf8' };

export default function ProductGrid({ products, onAddToCart }) {
  const handleImageError = (event) => {
    event.currentTarget.src =
      'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%22320%22 height%3D%22240%22 viewBox%3D%220 0 320 240%22%3E%3Crect width%3D%22320%22 height%3D%22240%22 fill%3D%22%230f0f1a%22/%3E%3Ctext x%3D%2250%25%22 y%3D%2250%25%22 fill%3D%22%235a5a7a%22 font-family%3D%22Arial%2Csans-serif%22 font-size%3D%2214%22 text-anchor%3D%22middle%22 dominant-baseline%3D%22middle%22%3EImagem indispon%C3%ADvel%3C/text%3E%3C/svg%3E';
  };

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      {/* Section header */}
      <div className="mb-10 flex items-end gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: '#818cf8' }}>
            Catálogo
          </p>
          <h2 className="text-3xl font-black tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <span style={{
              background: 'linear-gradient(90deg, #f0f0ff 0%, #818cf8 60%, #38bdf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Componentes de Alta Performance
            </span>
          </h2>
          <div className="mt-3 h-px w-24 rounded-full" style={{ background: 'linear-gradient(90deg, #6366f1, transparent)' }} />
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-2 text-xs" style={{ color: 'var(--text-dim)' }}>
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.7)' }}
          />
          {products.length} produto{products.length !== 1 ? 's' : ''} disponíveis
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product, index) => {
          const cat = categoryColors[product.category] || defaultCat;
          const inStock = product.stockQuantity > 0;

          return (
            <motion.article
              key={product.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group flex flex-col justify-between overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px solid rgba(99,102,241,0.1)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
                e.currentTarget.style.boxShadow = '0 8px 40px rgba(99,102,241,0.15), 0 0 0 1px rgba(99,102,241,0.1)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.1)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Image */}
              <div
                className="relative flex h-48 items-center justify-center overflow-hidden p-6"
                style={{
                  background: 'linear-gradient(135deg, rgba(8,8,16,0.8) 0%, rgba(15,15,26,0.6) 100%)',
                  borderBottom: '1px solid rgba(99,102,241,0.08)',
                }}
              >
                {/* Glow behind image */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(ellipse at center, ${cat.bg} 0%, transparent 70%)`,
                  }}
                />
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  onError={handleImageError}
                  className="relative z-10 h-full max-h-36 object-contain transition-transform duration-500 group-hover:scale-110"
                />
                {/* Category badge */}
                <span
                  className="absolute right-3 top-3 text-xs font-semibold tracking-wide px-2.5 py-1 rounded-full"
                  style={{
                    background: cat.bg,
                    border: `1px solid ${cat.border}`,
                    color: cat.text,
                  }}
                >
                  {product.category}
                </span>
                {/* Out of stock overlay */}
                {!inStock && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(8,8,16,0.7)' }}
                  >
                    <span className="badge badge-red">Esgotado</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-grow flex-col justify-between p-4">
                <div>
                  <h3
                    className="mb-1.5 text-sm font-bold leading-snug text-white transition-colors duration-200 group-hover:text-indigo-300 line-clamp-2"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    {product.name}
                  </h3>
                  <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                    {product.description || 'Sem descrição disponível.'}
                  </p>
                </div>

                <div
                  className="mt-4 flex items-center justify-between pt-4"
                  style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}
                >
                  <div>
                    <span className="block text-xs" style={{ color: 'var(--text-dim)' }}>À vista no Pix</span>
                    <span
                      className="block text-lg font-black text-white"
                      style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }}
                    >
                      R${' '}
                      {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span
                      className="mt-0.5 flex items-center gap-1 text-xs font-medium"
                      style={{ color: inStock ? '#34d399' : '#f87171' }}
                    >
                      {inStock && (
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: '#34d399', boxShadow: '0 0 5px rgba(52,211,153,0.8)' }}
                        />
                      )}
                      {inStock ? `${product.stockQuantity} em estoque` : 'Esgotado'}
                    </span>
                  </div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.93 }}
                    onClick={() => onAddToCart(product)}
                    disabled={!inStock}
                    className="cursor-pointer text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                    style={{
                      background: inStock
                        ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                        : 'rgba(99,102,241,0.05)',
                      color: inStock ? '#fff' : 'var(--text-dim)',
                      border: inStock ? 'none' : '1px solid rgba(99,102,241,0.1)',
                      boxShadow: inStock ? '0 4px 16px rgba(99,102,241,0.35)' : 'none',
                      cursor: inStock ? 'pointer' : 'not-allowed',
                    }}
                    onMouseEnter={(e) => {
                      if (inStock) {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)';
                        e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.55)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (inStock) {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)';
                      }
                    }}
                  >
                    {inStock ? '+ Comprar' : 'Esgotado'}
                  </motion.button>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>

      {products.length === 0 && (
        <div className="py-24 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <svg className="h-8 w-8" style={{ color: '#818cf8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Nenhum produto encontrado.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Tente buscar por outro termo.</p>
        </div>
      )}
    </section>
  );
}
