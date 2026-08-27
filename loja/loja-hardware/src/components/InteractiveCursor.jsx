import { useEffect, useState, useRef } from 'react';

export default function InteractiveCursor({ activeHoverPreview }) {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [ringPos, setRingPos] = useState({ x: -100, y: -100 });
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  
  const mouseRef = useRef({ x: -100, y: -100 });
  const ringRef = useRef({ x: -100, y: -100 });
  const velocityRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      setPos({ x: e.clientX, y: e.clientY });
      setCoords({ x: Math.round(e.clientX), y: Math.round(e.clientY) });

      // Check if hovering interactive element
      const target = e.target;
      const isInteractive = target.closest('button, a, input, select, .specimen-row, [role="button"]');
      setIsHovered(Boolean(isInteractive));
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Smooth Lerp loop for ring
    let animationFrameId;
    const updateRing = () => {
      const dx = mouseRef.current.x - ringRef.current.x;
      const dy = mouseRef.current.y - ringRef.current.y;

      velocityRef.current = { x: dx, y: dy };
      ringRef.current.x += dx * 0.18;
      ringRef.current.y += dy * 0.18;

      setRingPos({ x: ringRef.current.x, y: ringRef.current.y });
      animationFrameId = requestAnimationFrame(updateRing);
    };

    animationFrameId = requestAnimationFrame(updateRing);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* Precision Dot */}
      <div
        className="custom-cursor-dot hidden md:block"
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
        }}
      />

      {/* Trailing Inertia Ring */}
      <div
        className={`custom-cursor-ring hidden md:block ${isHovered ? 'is-hovering' : ''}`}
        style={{
          left: `${ringPos.x}px`,
          top: `${ringPos.y}px`,
        }}
      />

      {/* Floating Hover Specimen Preview */}
      {activeHoverPreview && (
        <div
          className="floating-preview-card hidden md:block"
          style={{
            left: `${ringPos.x + 30}px`,
            top: `${ringPos.y - 120}px`,
            transform: `translate(0, 0) rotate(${Math.min(15, Math.max(-15, velocityRef.current.x * 0.4))}deg)`,
          }}
        >
          <img
            src={activeHoverPreview.image}
            alt={activeHoverPreview.name}
            className="w-full h-full object-contain p-4 filter drop-shadow-2xl"
          />
          <div className="absolute bottom-2 left-2 right-2 bg-black/90 p-2 border border-white/10 text-[9px] font-mono-tech uppercase text-[#ccff00] flex justify-between">
            <span>{activeHoverPreview.sku || 'SPECIMEN'}</span>
            <span>R$ {Number(activeHoverPreview.price).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Top Telemetry Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none hidden md:flex items-center justify-between px-6 py-2 border-b border-white/10 bg-black/60 backdrop-blur-md font-mono-tech text-[10px] text-[#707070]">
        <div className="flex items-center gap-4">
          <span className="text-[#ccff00] font-bold">● KICKS // AVANT-GARDE ENGINE</span>
          <span>CURSOR: [{String(coords.x).padStart(4, '0')}, {String(coords.y).padStart(4, '0')}]</span>
          <span>FPS: 60</span>
        </div>
        <div className="flex items-center gap-4">
          <span>LATITUDE: -23.5505° S</span>
          <span>LONGITUDE: -46.6333° W</span>
          <span className="text-white font-bold">EDITION: 2026.08 // ARCHIVE</span>
        </div>
      </div>
    </>
  );
}
