import { useEffect, useState } from 'react';

export default function SafeImage({ src, alt = '', fallback = null, onError, ...imageProps }) {
  const normalizedSource = typeof src === 'string' ? src.trim() : '';
  const [failed, setFailed] = useState(!normalizedSource);

  useEffect(() => {
    setFailed(!normalizedSource);
  }, [normalizedSource]);

  if (failed) return fallback;

  return (
    <img
      {...imageProps}
      src={normalizedSource}
      alt={alt}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
