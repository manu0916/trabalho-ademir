import { useState, useEffect } from 'react';
import { isSoundMuted, toggleSound } from '../utils/soundEffects';

export default function SoundToggle() {
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    setMuted(isSoundMuted());
  }, []);

  const handleToggle = () => {
    const nextMuted = toggleSound();
    setMuted(nextMuted);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="nav-button cursor-pointer rounded-xl px-2.5 py-2 text-xs font-semibold transition-all flex items-center gap-1.5"
      title={muted ? 'Ativar Efeitos Sonoros' : 'Silenciar Efeitos Sonoros'}
      aria-label={muted ? 'Ativar Efeitos Sonoros' : 'Silenciar Efeitos Sonoros'}
    >
      <div className="flex items-center gap-[2px] h-3.5 px-0.5">
        <span className={`w-[2px] bg-[var(--accent)] rounded-full transition-all duration-300 ${muted ? 'h-1 opacity-40' : 'h-3 animate-pulse'}`} />
        <span className={`w-[2px] bg-[var(--accent)] rounded-full transition-all duration-300 ${muted ? 'h-1 opacity-40' : 'h-3.5 animate-pulse delay-75'}`} />
        <span className={`w-[2px] bg-[var(--accent)] rounded-full transition-all duration-300 ${muted ? 'h-1 opacity-40' : 'h-2 animate-pulse delay-150'}`} />
      </div>
      <span className="hidden xl:inline text-[11px] font-bold tracking-wider uppercase">
        {muted ? 'SFX OFF' : 'SFX ON'}
      </span>
    </button>
  );
}
