import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductGrid({ products, onAddToCart }) {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <section className="py-12 px-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-white border-l-4 border-sky-400 pl-3">
          Componentes de Alta Performance
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden flex flex-col justify-between hover:border-sky-400/50 transition-all duration-300 group"
            onHoverStart={() => setHoveredId(product.id)}
            onHoverEnd={() => setHoveredId(null)}
          >
            <div className="relative h-48 overflow-hidden bg-black/40 flex items-center justify-center p-4">
              <motion.img 
                src={product.imageUrl} 
                alt={product.name}
                className="object-contain h-full max-h-40 group-hover:scale-105 transition-transform duration-500"
              />
              <span className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-xs px-2.5 py-1 rounded-full text-sky-400 border border-sky-400/20">
                {product.category}
              </span>
            </div>

            <div className="p-5 flex flex-col flex-grow justify-between">
              <div>
                <h3 className="font-semibold text-lg text-white mb-1 group-hover:text-sky-400 transition-colors">
                  {product.name}
                </h3>
                <p className="text-xs text-[#a1a1aa] line-clamp-2 mb-4">
                  {product.description}
                </p>
              </div>

              <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#27272a]/50">
                <div>
                  <span className="text-xs text-[#a1a1aa] block">À vista no Pix</span>
                  <span className="text-xl font-bold text-white">
                    R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onAddToCart(product)}
                  className="bg-sky-500 hover:bg-sky-400 text-black font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow-lg shadow-sky-500/20"
                >
                  Comprar
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}