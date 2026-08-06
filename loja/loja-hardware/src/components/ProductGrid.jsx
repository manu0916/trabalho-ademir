import { motion } from 'framer-motion';

export default function ProductGrid({ products, onAddToCart }) {
  const handleImageError = (event) => {
    event.currentTarget.src =
      'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%22320%22 height%3D%22240%22 viewBox%3D%220 0 320 240%22%3E%3Crect width%3D%22320%22 height%3D%22240%22 fill%3D%22%23121214%22/%3E%3Ctext x%3D%2250%25%22 y%3D%2250%25%22 fill%3D%22%239ca3af%22 font-family%3D%22Arial%2Csans-serif%22 font-size%3D%2216%22 text-anchor%3D%22middle%22 dominant-baseline%3D%22middle%22%3EImagem indispon%C3%ADvel%3C/text%3E%3C/svg%3E';
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <h2 className="mb-8 border-l-4 border-sky-400 pl-3 text-2xl font-bold tracking-tight text-white">
        Componentes de Alta Performance
      </h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <motion.article
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="group flex flex-col justify-between overflow-hidden rounded-xl border border-[#27272a] bg-[#121214] transition-all duration-300 hover:border-sky-400/50"
          >
            <div className="relative flex h-48 items-center justify-center overflow-hidden bg-black/40 p-4">
              <img
                src={product.imageUrl}
                alt={product.name}
                onError={handleImageError}
                className="h-full max-h-40 object-contain transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute right-3 top-3 rounded-full border border-sky-400/20 bg-black/70 px-2.5 py-1 text-xs text-sky-400 backdrop-blur-md">
                {product.category}
              </span>
            </div>

            <div className="flex flex-grow flex-col justify-between p-5">
              <div>
                <h3 className="mb-1 text-lg font-semibold text-white transition-colors group-hover:text-sky-400">
                  {product.name}
                </h3>
                <p className="mb-4 line-clamp-2 text-xs text-[#a1a1aa]">
                  {product.description || 'Sem descrição disponível.'}
                </p>
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-[#27272a]/50 pt-4">
                <div>
                  <span className="block text-xs text-[#a1a1aa]">À vista no Pix</span>
                  <span className="text-xl font-bold text-white">
                    R$ {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onAddToCart(product)}
                  className="cursor-pointer rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-black shadow-lg shadow-sky-500/20 transition-colors hover:bg-sky-400"
                >
                  Comprar
                </motion.button>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      {products.length === 0 && (
        <p className="py-12 text-center text-sm text-zinc-400">Nenhum produto encontrado.</p>
      )}
    </section>
  );
}
