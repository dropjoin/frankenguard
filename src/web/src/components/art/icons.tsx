// Seasonal spot icons: jack-o'-lantern for the simulated-money
// banner, snowflake for the frozen state. Decorative, token colors
// only.

export function JackOLantern({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} role="presentation" viewBox="0 0 48 44">
      <ellipse cx="24" cy="26" fill="var(--pumpkin)" rx="20" ry="16" />
      <path
        d="M24 10 C18 18 18 34 24 42 M24 10 C30 18 30 34 24 42"
        fill="none"
        opacity="0.7"
        stroke="var(--text-warning)"
        strokeWidth="2"
      />
      <path d="M22 10 Q24 2 28 4 L27 10 Z" fill="var(--success)" />
      <path d="M13 21 L19 21 L16 26 Z" fill="var(--text-on-fill)" />
      <path d="M29 21 L35 21 L32 26 Z" fill="var(--text-on-fill)" />
      <path d="M22 27 L26 27 L24 30 Z" fill="var(--text-on-fill)" />
      <path d="M12 31 L17 34 L21 31 L25 34 L29 31 L33 34 L36 31 L34 37 L14 37 Z" fill="var(--text-on-fill)" />
    </svg>
  );
}

export function Snowflake({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} role="presentation" viewBox="0 0 40 40">
      <g fill="none" stroke="var(--info)" strokeLinecap="round" strokeWidth="2.5">
        <path d="M20 4 L20 36 M6 12 L34 28 M34 12 L6 28" />
        <path d="M20 4 L16 9 M20 4 L24 9 M20 36 L16 31 M20 36 L24 31" strokeWidth="2" />
        <path d="M6 12 L12 13 M6 12 L8 18 M34 28 L28 27 M34 28 L32 22" strokeWidth="2" />
        <path d="M34 12 L28 13 M34 12 L32 18 M6 28 L12 27 M6 28 L8 22" strokeWidth="2" />
      </g>
    </svg>
  );
}
