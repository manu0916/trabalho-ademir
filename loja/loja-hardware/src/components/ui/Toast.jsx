import { Check, Heart, ShoppingBag, Sparkles, X } from 'lucide-react';

const ICONS = {
  cart: ShoppingBag,
  favorite: Heart,
  success: Check,
};

export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  const Icon = ICONS[toast.tone] || Sparkles;

  return (
    <div className={`joy-toast joy-toast-${toast.tone || 'default'}`} role="status" aria-live="polite">
      <span className="joy-toast-icon" aria-hidden="true"><Icon size={19} strokeWidth={2.4} /></span>
      <div>
        <strong>{toast.title}</strong>
        {toast.message && <p>{toast.message}</p>}
      </div>
      <Sparkles className="joy-toast-sparkle" size={15} aria-hidden="true" />
      <button type="button" onClick={onClose} aria-label="Fechar aviso"><X size={17} /></button>
    </div>
  );
}
