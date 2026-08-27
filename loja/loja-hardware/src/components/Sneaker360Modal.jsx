import { useState } from 'react';
import { motion } from 'framer-motion';
import { getProductImages } from '../utils/productImages';
import { playUiSound } from '../utils/soundEffects';

export default function Sneaker360Modal({ product, isOpen, onClose, onAddToCart }) {
  const [rotationDegree, setRotationDegree] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [activeAngleIndex, setActiveAngleIndex] = useState(0);

  if (!isOpen || !product) return null;

  const images = getProductImages(product);
  const mainImage = images[activeAngleIndex]?.imageUrl || images[0]?.imageUrl || product.imageUrl;
  const numericPrice = Number(product.price);
  const hasPrice = product.price !== null
    && product.price !== undefined
    && String(product.price).trim() !== ''
    && Number.isFinite(numericPrice);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.clientX || e.touches?.[0]?.clientX || 0);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const currentX = e.clientX || e.touches?.[0]?.clientX || 0;
    const diff = currentX - startX;
    setRotationDegree((prev) => prev + diff * 0.5);
    setStartX(currentX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleAngleSelect = (idx) => {
    playUiSound('pop');
    setActiveAngleIndex(idx);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl"
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sneaker-preview-title"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-[var(--surface-solid)] border border-[var(--line)] shadow-2xl p-6 sm:p-10"
      >
        <div className="flex items-center justify-between gap-4 mb-6 border-b border-[var(--line)] pb-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-[var(--accent)] flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-ping" />
              Prévia visual experimental
            </span>
            <h3 id="sneaker-preview-title" className="text-xl sm:text-2xl font-black text-[var(--text)] tracking-tight mt-0.5">
              {product.name}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] text-xl font-bold text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-all"
            aria-label="Fechar prévia do produto"
          >
            ×
          </button>
        </div>

          {/* A rotação é um efeito aplicado à imagem cadastrada, não uma captura 3D. */}
        <div
          className="relative min-h-[340px] sm:min-h-[420px] rounded-3xl bg-gradient-to-b from-black/20 to-black/5 flex items-center justify-center overflow-hidden border border-[var(--line)] cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
        >
          {/* Radial pedestal lighting */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,rgba(216,255,84,0.18),transparent_65%)] pointer-events-none" />
          
          {/* Rotating floor grid */}
          <div className="absolute bottom-6 w-80 h-28 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/5 blur-[1px] pointer-events-none transform -rotate-x-60 shadow-2xl" />

          <motion.div
            style={{
              transform: `perspective(1000px) rotateY(${rotationDegree}deg)`,
              transition: isDragging ? 'none' : 'transform 0.25s ease-out'
            }}
            className="relative z-10 max-w-md w-full p-4 flex items-center justify-center"
          >
            {mainImage ? (
              <img
                src={mainImage}
                alt={product.name}
                className="max-h-[300px] sm:max-h-[360px] w-auto object-contain filter drop-shadow-[0_25px_35px_rgba(0,0,0,0.65)] pointer-events-none"
              />
            ) : (
              <p className="text-sm text-[var(--muted)]">Nenhuma imagem cadastrada para este produto.</p>
            )}
          </motion.div>

          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[11px] font-bold text-white">
            <span>⇄</span> Arraste para inclinar a imagem
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-[var(--muted)] pointer-events-none">
            <span className="font-mono text-[11px]">EFEITO: {Math.round(rotationDegree % 360)}°</span>
            <span className="font-mono text-[11px]">NÃO REPRESENTA VISUALIZAÇÃO 3D</span>
          </div>
        </div>

        {/* Angles Selector & Controls */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
            {images.map((img, idx) => (
              <button
                key={img.key || idx}
                type="button"
                onClick={() => handleAngleSelect(idx)}
                className={`relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                  activeAngleIndex === idx
                    ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 scale-105'
                    : 'border-[var(--line)] opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img.imageUrl} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                playUiSound('swoosh');
                setRotationDegree((prev) => prev - 90);
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] hover:border-[var(--accent)] font-bold text-xs text-[var(--text)] transition-all"
            >
              ↺ 90°
            </button>
            <button
              type="button"
              onClick={() => {
                playUiSound('swoosh');
                setRotationDegree((prev) => prev + 90);
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] hover:border-[var(--accent)] font-bold text-xs text-[var(--text)] transition-all"
            >
              ↻ 90°
            </button>
            {onAddToCart && Number(product.stockQuantity) > 0 && (
              <button
                type="button"
                onClick={() => {
                  playUiSound('success');
                  onAddToCart(product);
                  onClose();
                }}
                className="buy-button flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg"
              >
                Adicionar à sacola{hasPrice ? ` • ${numericPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
