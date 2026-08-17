import { useState } from 'react';

export default function StarRating({ rating = 5, onChange, readOnly = false, size = 'md' }) {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: 'text-sm gap-0.5',
    md: 'text-lg gap-1',
    lg: 'text-2xl gap-1.5',
  }[size] || 'text-lg gap-1';

  const current = hoverRating > 0 ? hoverRating : rating;

  return (
    <div className={`star-rating flex items-center ${sizeClasses}`} role={readOnly ? 'img' : 'radiogroup'} aria-label={`Avaliação de ${rating} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= current;
        if (readOnly) {
          return (
            <span
              key={star}
              className={`transition-colors select-none ${isFilled ? 'text-amber-400' : 'text-zinc-600'}`}
              aria-hidden="true"
            >
              ★
            </span>
          );
        }

        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className={`cursor-pointer transition-transform hover:scale-125 focus:outline-none ${isFilled ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-300'}`}
            aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
            aria-pressed={rating === star}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
