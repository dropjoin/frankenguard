import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Bolt, StitchBorder } from "./art/index.js";

// Themed primitives. Every status indicator pairs an icon with a text
// label: color alone never conveys a status. Bright semantic colors
// appear as fills and icons only; semantic text always uses the
// text-safe tokens.

export type SemanticVariant = "success" | "warning" | "error" | "info";

function StatusIcon({ variant, className }: { variant: SemanticVariant; className?: string }) {
  const common = {
    "aria-hidden": true as const,
    className,
    fill: "none",
    viewBox: "0 0 20 20",
  };
  if (variant === "success") {
    return (
      <svg {...common}>
        <path d="M4 10.5 L8.5 15 L16 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
      </svg>
    );
  }
  if (variant === "error") {
    return (
      <svg {...common}>
        <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    );
  }
  if (variant === "warning") {
    return (
      <svg {...common}>
        <path d="M10 3 L18 17 L2 17 Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        <path d="M10 8 L10 12.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <circle cx="10" cy="15" fill="currentColor" r="1.2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="2" />
      <path d="M10 9 L10 14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <circle cx="10" cy="6.5" fill="currentColor" r="1.2" />
    </svg>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "hero" }) {
  const classes = ["btn", `btn-${variant}`, className].filter(Boolean).join(" ");
  return <button className={classes} type={props.type ?? "button"} {...props} />;
}

export function Badge({ variant, children }: { variant: SemanticVariant; children: ReactNode }) {
  return (
    <span className={`badge badge-${variant}`}>
      <StatusIcon className="badge-icon" variant={variant} />
      <span>{children}</span>
    </span>
  );
}

export function InlineMessage({ variant, children }: { variant: SemanticVariant; children: ReactNode }) {
  return (
    <p className={`inline-message inline-message-${variant}`} role="status">
      <StatusIcon className="inline-message-icon" variant={variant} />
      <span>{children}</span>
    </p>
  );
}

export function Link({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className="fg-link" {...props}>
      {children}
    </a>
  );
}

export function StatusPill({ frozen, onHero = false }: { frozen: boolean; onHero?: boolean }) {
  return (
    <span className={onHero ? "status-pill status-pill-on-hero" : "status-pill"}>
      {frozen ? (
        <>
          <span aria-hidden="true" className="status-dot status-dot-frozen">
            ❄
          </span>
          <span>FROZEN</span>
        </>
      ) : (
        <>
          <span aria-hidden="true" className="status-dot status-dot-active" />
          <span>ACTIVE</span>
        </>
      )}
    </span>
  );
}

export function Panel({
  variant,
  title,
  aside,
  children,
  className,
}: {
  variant: "lavender" | "sky";
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <StitchBorder className={`panel panel-${variant}${className ? ` ${className}` : ""}`}>
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {aside}
      </div>
      {children}
    </StitchBorder>
  );
}

export function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="chip">
      <span>{label}</span>
      {onRemove && (
        <button aria-label={`Remove ${label}`} className="chip-remove" onClick={onRemove} type="button">
          ×
        </button>
      )}
    </span>
  );
}

export function Meter({ ratio, label }: { ratio: number; label: string }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const fillClass = ratio >= 1 ? "meter-fill-error" : ratio >= 0.7 ? "meter-fill-warning" : "meter-fill-success";
  return (
    <div className="meter">
      <div aria-hidden="true" className="meter-track">
        <div className={`meter-fill ${fillClass}`} style={{ width: `${clamped * 100}%` }} />
      </div>
      <p className="meter-label">{label}</p>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? "toggle-on" : "toggle-off"}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <Bolt className="toggle-bolt" />
      <span aria-hidden="true" className="toggle-thumb" />
      <Bolt className="toggle-bolt" />
    </button>
  );
}

export function Banner({ variant, icon, children }: { variant: SemanticVariant; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={`banner banner-${variant}`} role="status">
      {icon ?? <StatusIcon className="banner-icon" variant={variant} />}
      <p>{children}</p>
    </div>
  );
}
