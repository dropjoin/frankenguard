import { useState, type FormEvent, type ReactNode } from "react";

import { parseDecimalToCents } from "../../../shared/money.js";
import type { ScenarioId, StateResponse } from "../../../shared/types.js";
import { ApiError } from "../api.js";
import { useStore } from "../store.js";
import { Snowflake } from "./art/index.js";
import { ErrorNotice } from "./ErrorNotice.js";
import { Button, InlineMessage, Panel } from "./primitives.js";

// AgentPanel: the left hand of the demo. Scenario buttons run the
// scripted agent, the prompt box (live mode only) talks to the real
// model, and the manual form lets the visitor propose a payment
// directly. Nothing here evaluates: every proposal goes to the
// server, and the verdict comes back from the rule engine.
//
// Client-side field checks mirror the engine's grammar so a typo
// fails fast with a field message; the server re-validates
// everything and stays authoritative.

interface ScenarioMeta {
  id: ScenarioId;
  label: string;
  description: string;
  icon: ReactNode;
}

function CheckGlyph() {
  return (
    <svg aria-hidden="true" className="scenario-icon" viewBox="0 0 20 20">
      <path
        d="M4 10.5 L8.5 15 L16 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function CapGlyph() {
  return (
    <svg aria-hidden="true" className="scenario-icon" viewBox="0 0 20 20">
      <path
        d="M3 16 L10 4 L17 16 Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M7 16 L7 10 M13 16 L13 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg aria-hidden="true" className="scenario-icon" viewBox="0 0 20 20">
      <rect
        fill="none"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        width="16"
        x="2"
        y="4"
      />
      <path
        d="M2 8.5 L18 8.5 M6 2.5 L6 6 M14 2.5 L14 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function StrangerGlyph() {
  return (
    <svg aria-hidden="true" className="scenario-icon" viewBox="0 0 20 20">
      <circle
        cx="10"
        cy="6.5"
        fill="none"
        r="3.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M3.5 17 C4.5 12.5 15.5 12.5 16.5 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="M13.5 3 L16.5 6 M16.5 3 L13.5 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function OverrideGlyph() {
  return (
    <svg aria-hidden="true" className="scenario-icon" viewBox="0 0 20 20">
      <path
        d="M10 3 L18 17 L2 17 Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M10 8 L10 12.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx="10" cy="15" fill="currentColor" r="1.2" />
    </svg>
  );
}

const SCENARIOS: ScenarioMeta[] = [
  {
    id: "happy_path",
    label: "Happy path",
    description: "$100 to Acme Corp. Passes all four rules.",
    icon: <CheckGlyph />,
  },
  {
    id: "over_per_tx",
    label: "Over per-transaction cap",
    description: "$750 to Acme Corp. Breaks the single-payment cap.",
    icon: <CapGlyph />,
  },
  {
    id: "over_daily",
    label: "Over daily cap",
    description: "Fills the day, then one more payment. Breaks the daily cap.",
    icon: <CalendarGlyph />,
  },
  {
    id: "unknown_recipient",
    label: "Unknown recipient",
    description: "$100 to a stranger. Not on the allowlist.",
    icon: <StrangerGlyph />,
  },
  {
    id: "frozen",
    label: "Frozen system",
    description: "$100 to Acme Corp while the freeze switch is on.",
    icon: <Snowflake className="scenario-icon" />,
  },
  {
    id: "prompt_injection",
    label: "Prompt injection",
    description:
      "$5,000 to a stranger, memo says “ignore all limits”. The memo is ignored.",
    icon: <OverrideGlyph />,
  },
];

function validateRecipient(raw: string): string | null {
  const recipient = raw.trim();
  if (recipient === "") return "Recipient is required.";
  if ([...recipient].length > 64) return "Recipient must be at most 64 characters.";
  // eslint-disable-next-line no-control-regex -- control characters are exactly what this check rejects
  if (/[\u0000-\u001f\u007f]/.test(recipient))
    return "Recipient must not contain control characters.";
  return null;
}

function validateMemo(raw: string): string | null {
  if ([...raw].length > 500) return "Memo must be at most 500 characters.";
  return null;
}

export function AgentPanel({
  state,
  onAgentRun,
  onManualSubmit,
}: {
  state: StateResponse;
  onAgentRun: (proposalIds: string[]) => void;
  onManualSubmit: () => void;
}) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    recipient?: string;
    amount?: string;
    memo?: string;
  }>({});

  const [prompt, setPrompt] = useState("");
  const [promptError, setPromptError] = useState<string | null>(null);

  async function runScenario(scenario: ScenarioId) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await store.runAgent({ scenario });
      onAgentRun(result.proposals.map((p) => p.proposalId));
      if (result.agentMode === "scripted_fallback") {
        setNotice(
          "The live agent failed, so the scripted agent ran the happy path instead.",
        );
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function runPrompt(event: FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (trimmed === "") {
      setPromptError("Describe the payment you want the agent to propose.");
      return;
    }
    setPromptError(null);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await store.runAgent({ prompt: trimmed });
      onAgentRun(result.proposals.map((p) => p.proposalId));
      if (result.agentMode === "scripted_fallback") {
        setNotice(
          "The live agent failed, so the scripted agent ran the happy path instead.",
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_INPUT") {
        setPromptError(err.message);
      } else {
        setError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitManual(event: FormEvent) {
    event.preventDefault();
    const errors: { recipient?: string; amount?: string; memo?: string } = {};
    const recipientError = validateRecipient(recipient);
    if (recipientError) errors.recipient = recipientError;
    const parsed = parseDecimalToCents(amount);
    if (!parsed.ok) errors.amount = parsed.error;
    const memoError = validateMemo(memo);
    if (memoError) errors.memo = memoError;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !parsed.ok) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await store.submitProposal({
        recipient: recipient.trim(),
        amountCents: parsed.cents,
        currency: "USD",
        memo,
      });
      onManualSubmit();
      if (result.reason === "INVALID_PROPOSAL") {
        setNotice(
          "The server rejected this proposal as invalid. Check the fields and try again.",
        );
      } else if (result.reason === "ENGINE_ERROR") {
        setNotice(
          "The rule engine could not run, so nothing was executed. Try again in a moment.",
        );
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Agent" variant="lavender">
      <p className="panel-intro">
        The agent proposes payments. The rule engine disposes. Pick a scenario, or write
        your own proposal.
      </p>

      <h3 className="panel-subhead">Scenarios</h3>
      <div className="scenario-list">
        {SCENARIOS.map((scenario) => {
          const frozenLocked = scenario.id === "frozen" && !state.frozen;
          return (
            <div key={scenario.id} className="scenario-row">
              <Button
                aria-describedby={frozenLocked ? "frozen-scenario-hint" : undefined}
                className="scenario-button"
                disabled={busy || frozenLocked}
                onClick={() => void runScenario(scenario.id)}
                variant="secondary"
              >
                {scenario.icon}
                <span className="scenario-text">
                  <span className="scenario-label">{scenario.label}</span>
                  <span className="scenario-description">{scenario.description}</span>
                </span>
              </Button>
              {frozenLocked && (
                <p className="field-hint" id="frozen-scenario-hint">
                  Turn the freeze switch on in Controls to run this one.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="panel-subhead">Live prompt</h3>
      {state.agentMode === "live" ? (
        <form className="prompt-form" onSubmit={(event) => void runPrompt(event)}>
          <label className="field-label" htmlFor="agent-prompt">
            Ask the agent to propose a payment
          </label>
          <textarea
            className="field-input"
            disabled={busy}
            id="agent-prompt"
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Pay $40 to Acme Corp for office supplies"
            rows={3}
            value={prompt}
          />
          {promptError && <InlineMessage variant="error">{promptError}</InlineMessage>}
          <Button disabled={busy} type="submit">
            {busy ? "Agent is thinking…" : "Ask the agent"}
          </Button>
        </form>
      ) : (
        <p className="panel-note">
          The live agent is disabled in this demo, so prompts stay off. The scenarios
          above run from fixed scripts, and every proposal still goes through the same
          four rules.
        </p>
      )}

      <h3 className="panel-subhead">Propose a payment yourself</h3>
      <form className="manual-form" onSubmit={(event) => void submitManual(event)}>
        <div className="field">
          <label className="field-label" htmlFor="manual-recipient">
            Recipient
          </label>
          <input
            aria-invalid={fieldErrors.recipient ? true : undefined}
            className="field-input"
            disabled={busy}
            id="manual-recipient"
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="acme-corp"
            type="text"
            value={recipient}
          />
          {fieldErrors.recipient && (
            <InlineMessage variant="error">{fieldErrors.recipient}</InlineMessage>
          )}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="manual-amount">
            Amount (USD)
          </label>
          <input
            aria-invalid={fieldErrors.amount ? true : undefined}
            className="field-input"
            disabled={busy}
            id="manual-amount"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="19.99"
            type="text"
            value={amount}
          />
          {fieldErrors.amount && (
            <InlineMessage variant="error">{fieldErrors.amount}</InlineMessage>
          )}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="manual-memo">
            Memo (optional)
          </label>
          <input
            aria-invalid={fieldErrors.memo ? true : undefined}
            className="field-input"
            disabled={busy}
            id="manual-memo"
            maxLength={600}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="What is this for?"
            type="text"
            value={memo}
          />
          {fieldErrors.memo && (
            <InlineMessage variant="error">{fieldErrors.memo}</InlineMessage>
          )}
        </div>
        <Button disabled={busy} type="submit">
          {busy ? "Proposing…" : "Propose payment"}
        </Button>
      </form>

      {notice && <InlineMessage variant="warning">{notice}</InlineMessage>}
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
