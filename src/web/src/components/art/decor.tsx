import { useId, type ReactNode } from "react";

// Bolt: the electric accent mark. --electric is allow-listed only for
// small components like this one, never as text or a general
// background.

export function Bolt({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} role="presentation" viewBox="0 0 24 40">
      <path
        d="M14 2 L4 24 L11 24 L8 38 L20 16 L13 16 Z"
        fill="var(--electric)"
        stroke="var(--text-body)"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

// SutureDivider: a stitched zig-zag rule. The X stitches tile every
// 16px across the full rendered width (no viewBox, so user units are
// pixels and the stitches never stretch).

export function SutureDivider({ className }: { className?: string }) {
  const patternId = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" className={className} height="12" role="presentation" width="100%">
      <defs>
        <pattern height="12" id={patternId} patternUnits="userSpaceOnUse" width="16">
          <path d="M3 2 L13 10 M13 2 L3 10" fill="none" stroke="var(--stitch)" strokeLinecap="round" strokeWidth="2" />
        </pattern>
      </defs>
      <rect fill={`url(#${patternId})`} height="12" width="100%" />
    </svg>
  );
}

// StitchBorder: the panel wrapper. A dashed stitch border in
// --stitch over the panel's base color, with the shared radius.

export function StitchBorder({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `stitch-border ${className}` : "stitch-border"}>{children}</div>;
}
