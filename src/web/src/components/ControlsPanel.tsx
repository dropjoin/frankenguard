import { useEffect, useState, type FormEvent } from "react";

import { formatUsd, parseDecimalToCents } from "../../../shared/money.js";
import type { StateResponse } from "../../../shared/types.js";
import { ApiError } from "../api.js";
import { useStore } from "../store.js";
import { ErrorNotice } from "./ErrorNotice.js";
import { Button, Chip, InlineMessage, Meter, Panel, Toggle } from "./primitives.js";

// ControlsPanel: the visitor's hands on the rule engine. Caps,
// allowlist, and the freeze switch, plus the daily spend meter and
// the UTC reset countdown. Every change goes to the server and the
// page refetches, so the meter and the chips always show the stored
// config, never an optimistic guess.

function countdownText(windowEnd: string, nowMs: number): string {
  const remainingMs = new Date(windowEnd).getTime() - nowMs;
  if (remainingMs <= 0) return "The daily window is resetting…";
  const minutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(minutes / 60);
  return `Daily window resets in ${hours}h ${minutes % 60}m (UTC midnight)`;
}

export function ControlsPanel({ state }: { state: StateResponse }) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [perTx, setPerTx] = useState(() => (state.perTxCapCents / 100).toFixed(2));
  const [daily, setDaily] = useState(() => (state.dailyCapCents / 100).toFixed(2));
  const [capsError, setCapsError] = useState<string | null>(null);
  const [capsSaved, setCapsSaved] = useState(false);

  const [newRecipient, setNewRecipient] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [allowlistError, setAllowlistError] = useState<string | null>(null);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // When the server state changes under us (another panel's write,
  // a reset), the form follows the stored caps.
  useEffect(() => {
    setPerTx((state.perTxCapCents / 100).toFixed(2));
    setDaily((state.dailyCapCents / 100).toFixed(2));
  }, [state.perTxCapCents, state.dailyCapCents, state.configVersion]);

  async function saveCaps(event: FormEvent) {
    event.preventDefault();
    const parsedPerTx = parseDecimalToCents(perTx);
    if (!parsedPerTx.ok) {
      setCapsError(`Per-transaction cap: ${parsedPerTx.error}`);
      return;
    }
    const parsedDaily = parseDecimalToCents(daily);
    if (!parsedDaily.ok) {
      setCapsError(`Daily cap: ${parsedDaily.error}`);
      return;
    }
    if (parsedPerTx.cents > parsedDaily.cents) {
      setCapsError("The per-transaction cap cannot be larger than the daily cap.");
      return;
    }
    setCapsError(null);
    setCapsSaved(false);
    setBusy(true);
    setError(null);
    try {
      await store.updateCaps({
        perTxCapCents: parsedPerTx.cents,
        dailyCapCents: parsedDaily.cents,
      });
      setCapsSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_INPUT") {
        setCapsError(err.message);
      } else {
        setError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  async function addRecipient(event: FormEvent) {
    event.preventDefault();
    const recipient = newRecipient.trim();
    if (recipient === "") {
      setAllowlistError("Recipient is required.");
      return;
    }
    setAllowlistError(null);
    setBusy(true);
    setError(null);
    try {
      await store.addRecipient({
        recipient,
        label: newLabel.trim() === "" ? undefined : newLabel.trim(),
      });
      setNewRecipient("");
      setNewLabel("");
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === "INVALID_INPUT" || err.code === "DUPLICATE_RECIPIENT")
      ) {
        setAllowlistError(err.message);
      } else {
        setError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeRecipient(recipientKey: string) {
    setAllowlistError(null);
    setBusy(true);
    setError(null);
    try {
      await store.removeRecipient({ recipient: recipientKey });
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_INPUT") {
        setAllowlistError(err.message);
      } else {
        setError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleFreeze(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await store.setFrozen({ frozen: next });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const ratio =
    state.dailyCapCents === 0 ? 0 : state.dailySpentCents / state.dailyCapCents;
  const caption =
    ratio >= 1
      ? "Cap reached"
      : ratio >= 0.7
        ? "Approaching the daily cap"
        : "Plenty of room left today";
  const captionClass =
    ratio >= 1
      ? "meter-caption-error"
      : ratio >= 0.7
        ? "meter-caption-warning"
        : "meter-caption-success";

  return (
    <Panel
      className={state.frozen ? "controls-frozen" : undefined}
      title="Controls"
      variant="sky"
    >
      <p className="panel-intro">
        Change the rules and watch the next verdict follow. Nothing here touches real
        money.
      </p>

      <h3 className="panel-subhead">Spending caps</h3>
      <form className="caps-form" onSubmit={(event) => void saveCaps(event)}>
        <div className="field">
          <label className="field-label" htmlFor="caps-per-tx">
            Per-transaction cap (USD)
          </label>
          <input
            className="field-input"
            disabled={busy}
            id="caps-per-tx"
            inputMode="decimal"
            onChange={(event) => setPerTx(event.target.value)}
            type="text"
            value={perTx}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="caps-daily">
            Daily cap (USD)
          </label>
          <input
            className="field-input"
            disabled={busy}
            id="caps-daily"
            inputMode="decimal"
            onChange={(event) => setDaily(event.target.value)}
            type="text"
            value={daily}
          />
        </div>
        {capsError && <InlineMessage variant="error">{capsError}</InlineMessage>}
        {capsSaved && (
          <InlineMessage variant="success">
            Caps saved. The next proposal is judged against them.
          </InlineMessage>
        )}
        <Button disabled={busy} type="submit">
          Save caps
        </Button>
      </form>

      <h3 className="panel-subhead">Allowlist</h3>
      <div className="chip-row">
        {state.allowlist.length === 0 && (
          <p className="panel-note">Nobody is allowed. Every proposal will be blocked.</p>
        )}
        {state.allowlist.map((entry) => (
          <Chip
            key={entry.key}
            label={entry.label}
            onRemove={() => void removeRecipient(entry.key)}
          />
        ))}
      </div>
      <form className="allowlist-form" onSubmit={(event) => void addRecipient(event)}>
        <div className="field">
          <label className="field-label" htmlFor="allowlist-recipient">
            Recipient key
          </label>
          <input
            className="field-input"
            disabled={busy}
            id="allowlist-recipient"
            onChange={(event) => setNewRecipient(event.target.value)}
            placeholder="new-partner"
            type="text"
            value={newRecipient}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="allowlist-label">
            Label (optional)
          </label>
          <input
            className="field-input"
            disabled={busy}
            id="allowlist-label"
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="New Partner Inc."
            type="text"
            value={newLabel}
          />
        </div>
        {allowlistError && (
          <InlineMessage variant="error">{allowlistError}</InlineMessage>
        )}
        <Button disabled={busy} type="submit" variant="secondary">
          Add recipient
        </Button>
      </form>

      <h3 className="panel-subhead">Freeze switch</h3>
      <div className="freeze-row">
        <Toggle
          checked={state.frozen}
          disabled={busy}
          label="Freeze all payments"
          onChange={(next) => void toggleFreeze(next)}
        />
        <p className="freeze-text">
          {state.frozen
            ? "Frozen. Every proposal is blocked until you switch this off."
            : "Off. Flip it to block every payment at once."}
        </p>
      </div>

      <h3 className="panel-subhead">Daily spend</h3>
      <p className="font-display meter-amounts">
        {formatUsd(state.dailySpentCents)} <span className="meter-amounts-of">of</span>{" "}
        {formatUsd(state.dailyCapCents)}
      </p>
      <Meter
        label={`${formatUsd(state.dailySpentCents)} of ${formatUsd(state.dailyCapCents)} spent`}
        ratio={ratio}
      />
      <p className={`meter-caption ${captionClass}`}>{caption}</p>
      <p className="panel-note">{countdownText(state.windowEnd, nowMs)}</p>

      {error !== null && (
        <ErrorNotice
          error={error}
          onFreshSandbox={() => void store.startFreshSandbox()}
          onRetry={() => setError(null)}
        />
      )}
    </Panel>
  );
}
