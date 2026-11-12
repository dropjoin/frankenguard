import { useEffect, useRef, useState } from "react";

import type { GhostState } from "./components/art/index.js";
import { AgentPanel } from "./components/AgentPanel.js";
import { AuditPanel } from "./components/AuditPanel.js";
import { JackOLantern, Snowflake } from "./components/art/index.js";
import { ControlsPanel } from "./components/ControlsPanel.js";
import { DecisionPanel } from "./components/DecisionPanel.js";
import { HeaderBand } from "./components/HeaderBand.js";
import { Banner, Button, InlineMessage } from "./components/primitives.js";
import { StoreProvider, useStore } from "./store.js";

import type { FrankenguardApi } from "./api.js";

function Shell() {
  const store = useStore();
  const frozen = store.state?.frozen ?? false;
  const agentMode = store.state?.agentMode ?? "scripted";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agentProposalIds, setAgentProposalIds] = useState<ReadonlySet<string>>(new Set());
  const [justVerified, setJustVerified] = useState(false);
  const lastAuditEntries = useRef<number | null>(null);

  // The verified glow lasts until the next activity writes a new
  // audit entry; then the ghost goes back to reacting to verdicts.
  useEffect(() => {
    const entries = store.state?.auditHead.entries ?? null;
    if (lastAuditEntries.current !== null && entries !== null && entries !== lastAuditEntries.current) {
      setJustVerified(false);
    }
    lastAuditEntries.current = entries;
  }, [store.state?.auditHead.entries]);

  const latest = store.state?.recentProposals[0] ?? null;
  const ghostState: GhostState = frozen
    ? "frozen"
    : justVerified
      ? "verified"
      : latest?.outcome === "APPROVED"
        ? "approved"
        : latest?.outcome === "REJECTED"
          ? "blocked"
          : "idle";

  return (
    <div className={frozen ? "page-frozen" : undefined}>
      <HeaderBand
        agentMode={agentMode}
        frozen={frozen}
        onReset={() => void store.reset()}
        resetDisabled={store.status !== "ready"}
      />
      <div className="simulated-banner-wrap">
        <Banner icon={<JackOLantern className="pumpkin-icon" />} variant="warning">
          SIMULATED MONEY ONLY. No real payments move here: every decision is checked against a pretend
          ledger, and nothing connects to a wallet or a payment rail.
        </Banner>
      </div>
      {frozen && store.status === "ready" && (
        <div className="frozen-banner-wrap">
          <Banner icon={<Snowflake className="snowflake-icon" />} variant="info">
            All payments are blocked.
          </Banner>
          <p className="frozen-explainer">
            The freeze switch is on. Every proposal is rejected by the first rule until you switch it off in
            Controls.
          </p>
        </div>
      )}
      <main className="panels">
        {store.status === "loading" && (
          <p aria-live="polite" className="store-state-note">
            Opening your sandbox…
          </p>
        )}
        {store.status === "error" && (
          <div className="store-state-note">
            <InlineMessage variant="error">
              {store.error ?? "Something went wrong loading the demo."}
            </InlineMessage>
            <Button onClick={() => void store.refresh()} variant="secondary">
              Try again
            </Button>
          </div>
        )}
        {store.status === "expired" && (
          <div className="store-state-note">
            <InlineMessage variant="warning">
              Your sandbox expired. Start a fresh one to keep playing.
            </InlineMessage>
            <Button onClick={() => void store.startFreshSandbox()}>Start a new sandbox</Button>
          </div>
        )}
        {store.status === "ready" && store.state && (
          <div className="panels-grid">
            <AgentPanel
              onAgentRun={(ids) => setAgentProposalIds(new Set(ids))}
              onManualSubmit={() => setAgentProposalIds(new Set())}
              state={store.state}
            />
            <DecisionPanel
              agentProposalIds={agentProposalIds}
              ghostState={ghostState}
              onSelect={setSelectedId}
              selectedId={selectedId}
              state={store.state}
            />
            <ControlsPanel state={store.state} />
            <AuditPanel
              onSelect={setSelectedId}
              onVerified={(ok) => setJustVerified(ok)}
              selectedId={selectedId}
              state={store.state}
            />
          </div>
        )}
      </main>
      <footer className="page-footer">
        <p className="page-footer-text">Built with Kiro 👻</p>
      </footer>
    </div>
  );
}

export function App({ client }: { client?: FrankenguardApi }) {
  return (
    <StoreProvider client={client}>
      <Shell />
    </StoreProvider>
  );
}
