import { HeaderBand } from "./components/HeaderBand.js";
import { JackOLantern } from "./components/art/index.js";
import { Banner, Button, InlineMessage } from "./components/primitives.js";
import { StoreProvider, useStore } from "./store.js";

import type { FrankenguardApi } from "./api.js";

function Shell() {
  const store = useStore();
  const frozen = store.state?.frozen ?? false;
  const agentMode = store.state?.agentMode ?? "scripted";

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
        {store.status === "ready" && store.state && <div className="panels-grid" />}
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
