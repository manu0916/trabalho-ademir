export default function KicksSun({ className = '', label = '' }) {
  return (
    <svg
      className={`kicks-sun ${className}`.trim()}
      viewBox="0 0 64 64"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      <g className="kicks-sun-rays" fill="currentColor">
        <path d="M29 1h6l1.3 11.2h-8.6L29 1Z" />
        <path d="m52.3 7.5 4.2 4.2-7 8.9-6.1-6.1 8.9-7Z" />
        <path d="M63 29v6l-11.2 1.3v-8.6L63 29Z" />
        <path d="m56.5 52.3-4.2 4.2-8.9-7 6.1-6.1 7 8.9Z" />
        <path d="M35 63h-6l-1.3-11.2h8.6L35 63Z" />
        <path d="m11.7 56.5-4.2-4.2 7-8.9 6.1 6.1-8.9 7Z" />
        <path d="M1 35v-6l11.2-1.3v8.6L1 35Z" />
        <path d="m7.5 11.7 4.2-4.2 8.9 7-6.1 6.1-7-8.9Z" />
      </g>
      <circle cx="32" cy="32" r="17" fill="currentColor" />
      <path d="M22.5 33.5c4 4.9 14.8 5.2 19 0" fill="none" stroke="var(--ink, #17223b)" strokeLinecap="round" strokeWidth="3.2" />
      <circle cx="24.5" cy="28" r="1.8" fill="var(--ink, #17223b)" />
      <circle cx="39.5" cy="28" r="1.8" fill="var(--ink, #17223b)" />
    </svg>
  );
}
