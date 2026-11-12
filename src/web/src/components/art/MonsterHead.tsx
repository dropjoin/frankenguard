import { useId } from "react";

// MonsterHead: the Frankenstein lab illustration for the hero and lab
// strip only, never to convey data or status. Success-green skin,
// amethyst shading, a blue scar, electric neck bolts. Decorative.

export function MonsterHead({ className }: { className?: string }) {
  const clipId = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" className={className} role="presentation" viewBox="0 0 200 150">
      <defs>
        <clipPath id={clipId}>
          <rect height="100" rx="18" width="120" x="40" y="20" />
        </clipPath>
      </defs>
      {/* Neck bolts */}
      <rect fill="var(--electric)" height="12" stroke="var(--text-body)" strokeWidth="2" width="24" x="6" y="94" />
      <rect fill="var(--electric)" height="12" stroke="var(--text-body)" strokeWidth="2" width="24" x="170" y="94" />
      <rect fill="var(--text-body)" height="20" width="6" x="30" y="90" />
      <rect fill="var(--text-body)" height="20" width="6" x="164" y="90" />
      {/* Head */}
      <rect fill="var(--success)" height="100" rx="18" stroke="var(--text-body)" strokeWidth="2.5" width="120" x="40" y="20" />
      <rect clipPath={`url(#${clipId})`} fill="var(--amethyst)" height="100" opacity="0.35" width="42" x="118" y="20" />
      {/* Flat-top hair with a jagged hairline */}
      <path
        d="M40 20 H160 V34 L150 44 L140 34 L130 46 L120 34 L110 44 L100 34 L90 46 L80 34 L70 44 L60 34 L50 44 L40 34 Z"
        fill="var(--text-on-fill)"
      />
      {/* Heavy brow, mismatched eyes */}
      <rect fill="var(--text-on-fill)" height="9" rx="4.5" width="44" x="54" y="58" />
      <rect fill="var(--text-on-fill)" height="9" rx="4.5" width="44" x="102" y="55" />
      <rect fill="var(--on-color)" height="12" width="18" x="62" y="72" />
      <rect fill="var(--on-color)" height="14" width="18" x="112" y="70" />
      <circle cx="71" cy="78" fill="var(--text-on-fill)" r="3.5" />
      <circle cx="121" cy="77" fill="var(--text-on-fill)" r="3.5" />
      {/* Blue scar with stitches, left cheek */}
      <path
        d="M52 88 L64 94 L54 100 L66 106"
        fill="none"
        stroke="var(--blue)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path d="M56 86 L60 92 M58 97 L62 103" stroke="var(--text-on-fill)" strokeLinecap="round" strokeWidth="2" />
      {/* Flat stitched mouth */}
      <path d="M78 104 L128 104" stroke="var(--text-on-fill)" strokeLinecap="round" strokeWidth="3" />
      <path d="M90 100 L90 108 M104 100 L104 108 M118 100 L118 108" stroke="var(--text-on-fill)" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
