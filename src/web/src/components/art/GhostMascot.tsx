import { useId } from "react";

// The purple ghost: FrankenGuard's friendly face. One body, five
// expressions. The ghost is always decorative (aria-hidden): state is
// conveyed by text elsewhere, never by the ghost alone. Colors come
// only from the binding tokens.

export type GhostState = "idle" | "approved" | "blocked" | "frozen" | "verified";

const BODY_PATH =
  "M20 112 V62 A40 40 0 0 1 100 62 V112 Q92 102 84 112 Q76 102 68 112 Q60 102 52 112 Q44 102 36 112 Q28 102 20 112 Z";

function Sparkle({ x, y, size }: { x: number; y: number; size: number }) {
  const s = size;
  return (
    <path
      d={`M${x} ${y - s} L${x + s * 0.25} ${y - s * 0.25} L${x + s} ${y} L${x + s * 0.25} ${y + s * 0.25} L${x} ${y + s} L${x - s * 0.25} ${y + s * 0.25} L${x - s} ${y} L${x - s * 0.25} ${y - s * 0.25} Z`}
      fill="var(--highlight)"
    />
  );
}

function IdleFace() {
  return (
    <>
      <ellipse cx="46" cy="58" rx="7" ry="9" fill="var(--on-color)" />
      <ellipse cx="74" cy="58" rx="7" ry="9" fill="var(--on-color)" />
      <circle cx="46" cy="60" r="3.5" fill="var(--text-on-fill)" />
      <circle cx="74" cy="60" r="3.5" fill="var(--text-on-fill)" />
      <path d="M50 74 Q60 81 70 74" fill="none" stroke="var(--text-on-fill)" strokeLinecap="round" strokeWidth="3.5" />
    </>
  );
}

function ApprovedFace() {
  return (
    <>
      <path d="M38 58 Q46 49 54 58" fill="none" stroke="var(--text-on-fill)" strokeLinecap="round" strokeWidth="3.5" />
      <path d="M66 58 Q74 49 82 58" fill="none" stroke="var(--text-on-fill)" strokeLinecap="round" strokeWidth="3.5" />
      <path d="M46 71 Q60 86 74 71" fill="none" stroke="var(--text-on-fill)" strokeLinecap="round" strokeWidth="3.5" />
    </>
  );
}

function BlockedFace() {
  return (
    <>
      <path d="M39 61 L54 54" fill="none" stroke="var(--text-on-fill)" strokeLinecap="round" strokeWidth="3.5" />
      <path d="M81 61 L66 54" fill="none" stroke="var(--text-on-fill)" strokeLinecap="round" strokeWidth="3.5" />
      <path d="M48 76 L72 76" fill="none" stroke="var(--text-on-fill)" strokeLinecap="round" strokeWidth="3.5" />
    </>
  );
}

function FrozenFace() {
  return (
    <>
      <circle cx="46" cy="57" r="4" fill="var(--text-on-fill)" />
      <circle cx="74" cy="57" r="4" fill="var(--text-on-fill)" />
      <circle cx="60" cy="74" r="4.5" fill="none" stroke="var(--text-on-fill)" strokeWidth="3" />
    </>
  );
}

export function GhostMascot({ state = "idle", className }: { state?: GhostState; className?: string }) {
  // useId colons break url(#...) references; strip them.
  const clipId = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 120 120" role="presentation">
      <defs>
        <clipPath id={clipId}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>
      <path d={BODY_PATH} fill="var(--purple)" />
      <ellipse clipPath={`url(#${clipId})`} cx="94" cy="66" fill="var(--amethyst)" opacity="0.55" rx="26" ry="46" />
      {state === "frozen" && <path d={BODY_PATH} fill="var(--info)" opacity="0.28" />}
      {state === "idle" && <IdleFace />}
      {state === "approved" && <ApprovedFace />}
      {state === "blocked" && <BlockedFace />}
      {state === "frozen" && <FrozenFace />}
      {state === "verified" && <ApprovedFace />}
      {state === "approved" && (
        <>
          <Sparkle size={7} x={16} y={34} />
          <Sparkle size={5} x={104} y={26} />
        </>
      )}
      {state === "blocked" && (
        <g>
          <path
            d="M96 84 L106 84 L112 90 L112 100 L106 106 L96 106 L90 100 L90 90 Z"
            fill="var(--pumpkin)"
            stroke="var(--text-on-fill)"
            strokeWidth="2"
          />
          <rect fill="var(--on-color)" height="5" rx="2.5" width="14" x="94" y="92.5" />
        </g>
      )}
      {state === "frozen" && (
        <g fill="none" stroke="var(--info)" strokeLinecap="round" strokeWidth="2.5">
          <path d="M12 48 Q8 54 12 60 Q8 66 12 72" />
          <path d="M108 48 Q112 54 108 60 Q112 66 108 72" />
        </g>
      )}
      {state === "verified" && (
        <g>
          <circle cx="98" cy="96" fill="var(--success)" r="14" stroke="var(--text-on-fill)" strokeWidth="2" />
          <path
            d="M91 96 L96 101 L106 90"
            fill="none"
            stroke="var(--on-color)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.5"
          />
        </g>
      )}
    </svg>
  );
}
