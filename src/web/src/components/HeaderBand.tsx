import { GhostMascot } from "./art/index.js";
import { Button, StatusPill } from "./primitives.js";

// HeaderBand: the hero gradient band. Ghost logo, wordmark, status
// pill, agent-mode badge, Reset. The only component that uses the
// hero gradient; everything below it sits on the light bases.

export function HeaderBand({
  frozen,
  agentMode,
  onReset,
  resetDisabled,
}: {
  frozen: boolean;
  agentMode: "scripted" | "live";
  onReset: () => void;
  resetDisabled?: boolean;
}) {
  return (
    <header className="header-band">
      <div className="header-band-inner">
        <div className="header-band-brand">
          <GhostMascot className="ghost-md header-band-ghost" state={frozen ? "frozen" : "idle"} />
          <div>
            <p className="header-band-wordmark">FrankenGuard</p>
            <p className="header-band-tagline">An agent proposes. Old rules dispose.</p>
          </div>
        </div>
        <div className="header-band-controls">
          <StatusPill frozen={frozen} onHero />
          <span className="agent-badge">{agentMode === "live" ? "LIVE AGENT" : "SCRIPTED AGENT"}</span>
          <Button disabled={resetDisabled} onClick={onReset} variant="hero">
            Reset demo
          </Button>
        </div>
      </div>
    </header>
  );
}
