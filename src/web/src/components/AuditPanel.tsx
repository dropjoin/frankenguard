import { useCallback, useEffect, useState, type FormEvent } from "react";

import type {
  AuditEntryView,
  StateResponse,
  VerifyResponse,
} from "../../../shared/types.js";
import { useStore } from "../store.js";
import { Bolt, GhostMascot, TornStitch } from "./art/index.js";
import { ErrorNotice } from "./ErrorNotice.js";
import { Badge, Button, InlineMessage, Panel } from "./primitives.js";

// AuditPanel: the receipt book. Every proposal, decision, payment,
// and config change lands here as a hash-chained entry. Filters
// narrow the timeline, each entry expands to its raw payload, and
// "Verify chain" recomputes every link. The caveat is stated in the
// open: verification cannot detect entries removed from the end of
// the log, so the UI says "verifiable", never "tamper-proof".

const REASON_CODES = [
  "SYSTEM_FROZEN",
  "NOT_FROZEN",
  "RECIPIENT_ALLOWED",
  "RECIPIENT_NOT_ALLOWED",
  "WITHIN_PER_TX_CAP",
  "PER_TX_CAP_EXCEEDED",
  "WITHIN_DAILY_CAP",
  "DAILY_CAP_EXCEEDED",
  "INVALID_PROPOSAL",
  "ENGINE_ERROR",
] as const;

const PAGE_SIZE = 50;

function chipFor(entry: AuditEntryView): { label: string; className: string } {
  if (entry.payloadParseError) {
    return { label: "Unparseable", className: "audit-chip audit-chip-received" };
  }
  switch (entry.type) {
    case "PROPOSAL_RECEIVED":
      return { label: "Received", className: "audit-chip audit-chip-received" };
    case "DECISION_MADE": {
      const outcome = entry.payload["outcome"];
      return outcome === "APPROVED"
        ? { label: "Decision · Approved", className: "audit-chip audit-chip-approved" }
        : { label: "Decision · Blocked", className: "audit-chip audit-chip-blocked" };
    }
    case "PAYMENT_EXECUTED":
      return { label: "Payment", className: "audit-chip audit-chip-approved" };
    case "CAPS_CHANGED":
    case "ALLOWLIST_CHANGED":
    case "FREEZE_CHANGED":
    case "CONFIG_CHANGED":
      return { label: "Config", className: "audit-chip audit-chip-config" };
    case "SANDBOX_CREATED":
      return { label: "Sandbox", className: "audit-chip audit-chip-received" };
    case "AUDIT_VERIFIED":
      return { label: "Verified", className: "audit-chip audit-chip-approved" };
    default: {
      const _exhaustive: never = entry.type;
      return { label: _exhaustive, className: "audit-chip audit-chip-received" };
    }
  }
}

function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
}

export function AuditPanel({
  state,
  selectedId,
  onSelect,
  onVerified,
}: {
  state: StateResponse;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onVerified: (ok: boolean) => void;
}) {
  const store = useStore();
  const [entries, setEntries] = useState<AuditEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [nextAfterSeq, setNextAfterSeq] = useState<number | null>(null);
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);

  const [outcome, setOutcome] = useState<"" | "APPROVED" | "REJECTED">("");
  const [code, setCode] = useState("");
  const [recipient, setRecipient] = useState("");
  const [appliedRecipient, setAppliedRecipient] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [verifyError, setVerifyError] = useState<unknown>(null);

  const load = useCallback(
    async (afterSeq?: number) => {
      const query = {
        limit: PAGE_SIZE,
        ...(afterSeq !== undefined ? { afterSeq } : {}),
        ...(outcome !== "" ? { outcome } : {}),
        ...(code !== "" ? { code } : {}),
        ...(appliedRecipient !== "" ? { recipient: appliedRecipient } : {}),
      };
      const result = await store.listAudit(query);
      return result;
    },
    // store.listAudit is a stable callback (see store.tsx); depending
    // on the whole store object refetched the timeline on every state
    // change, including the first load landing.
    [store.listAudit, outcome, code, appliedRecipient],
  );

  // Reload from the start whenever the filters change or new entries
  // land (tracked through the audit head count in server state).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .then((result) => {
        if (cancelled) return;
        setEntries(result.entries);
        setNextAfterSeq(result.nextAfterSeq);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, state.auditHead.entries]);

  async function loadMore() {
    if (nextAfterSeq === null) return;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await load(nextAfterSeq);
      setEntries((prev) => [...prev, ...result.entries]);
      setNextAfterSeq(result.nextAfterSeq);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
    }
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setAppliedRecipient(recipient.trim());
  }

  async function verify() {
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await store.verifyAudit();
      setVerifyResult(result);
      onVerified(result.ok);
    } catch (err) {
      setVerifyError(err);
    } finally {
      setVerifying(false);
    }
  }

  const brokenSeq =
    verifyResult && !verifyResult.ok ? (verifyResult.brokenAtSeq ?? null) : null;

  return (
    <Panel title="Audit trail" variant="lavender">
      <p className="panel-intro">
        Every step leaves a receipt, each one chained to the last by hash. Individual
        entries can&apos;t be edited or deleted; resetting the demo wipes the whole
        sandbox and starts a fresh chain.
      </p>

      <form className="audit-filters" onSubmit={applyFilters}>
        <div className="field">
          <label className="field-label" htmlFor="audit-outcome">
            Outcome
          </label>
          <select
            className="field-input"
            id="audit-outcome"
            onChange={(event) =>
              setOutcome(event.target.value as "" | "APPROVED" | "REJECTED")
            }
            value={outcome}
          >
            <option value="">All</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="audit-code">
            Reason code
          </label>
          <select
            className="field-input"
            id="audit-code"
            onChange={(event) => setCode(event.target.value)}
            value={code}
          >
            <option value="">All</option>
            {REASON_CODES.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="audit-recipient">
            Recipient
          </label>
          <input
            className="field-input"
            id="audit-recipient"
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="acme-corp"
            type="text"
            value={recipient}
          />
        </div>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </form>

      {loading && <p className="panel-note">Loading the audit trail…</p>}
      {error !== null && (
        <ErrorNotice
          error={error}
          onFreshSandbox={() => void store.startFreshSandbox()}
          onRetry={() => setError(null)}
        />
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-title">No receipts yet.</p>
          <p className="panel-note">The first proposal writes the first entry.</p>
        </div>
      )}

      {entries.length > 0 && (
        <ol className="audit-timeline">
          {entries.map((entry, index) => {
            const chip = chipFor(entry);
            const linked = selectedId !== null && entry.proposalId === selectedId;
            const broken = brokenSeq !== null && entry.seq === brokenSeq;
            return (
              <li
                key={entry.seq}
                className={[
                  "audit-entry",
                  linked ? "audit-entry-linked" : "",
                  broken ? "audit-entry-broken" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="audit-entry-head">
                  <span className={chip.className}>{chip.label}</span>
                  <span className="audit-entry-meta">
                    #{entry.seq} · {new Date(entry.ts).toLocaleTimeString()} ·{" "}
                    {entry.actor}
                  </span>
                </div>
                <div className="audit-entry-links">
                  {entry.proposalId && (
                    <button
                      className="audit-proposal-link"
                      onClick={() =>
                        onSelect(
                          selectedId === entry.proposalId ? null : entry.proposalId,
                        )
                      }
                      type="button"
                    >
                      Proposal {shortId(entry.proposalId)}
                    </button>
                  )}
                  <button
                    aria-expanded={expandedSeq === entry.seq}
                    className="audit-expand"
                    onClick={() =>
                      setExpandedSeq(expandedSeq === entry.seq ? null : entry.seq)
                    }
                    type="button"
                  >
                    {expandedSeq === entry.seq ? "Hide payload" : "Show payload"}
                  </button>
                </div>
                {expandedSeq === entry.seq &&
                  (entry.payloadParseError ? (
                    <p className="font-mono terminal-block">
                      This entry&apos;s stored payload is not valid JSON, so its contents
                      can&apos;t be shown.
                    </p>
                  ) : (
                    <pre className="font-mono terminal-block">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  ))}
                {(index + 1) % 5 === 0 && (
                  <span className="audit-ghost">
                    <GhostMascot className="ghost-sm" state="idle" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {nextAfterSeq !== null && (
        <Button
          disabled={loadingMore}
          onClick={() => void loadMore()}
          variant="secondary"
        >
          {loadingMore ? "Loading…" : "Load older entries"}
        </Button>
      )}

      <div className="verify-block">
        <Button disabled={verifying} onClick={() => void verify()}>
          {verifying ? "Verifying…" : "Verify chain"}
        </Button>
        {verifyResult?.ok && (
          <div className="verify-result verify-result-ok">
            <span className="verify-sparks" aria-hidden="true">
              <Bolt className="bolt-icon" />
              <Bolt className="bolt-icon" />
            </span>
            <Badge variant="success">Chain intact</Badge>
            <p className="verify-caption verify-caption-ok">
              {verifyResult.entries} entries verified, every hash links to the last. Head{" "}
              <code className="font-mono reason-code">
                {verifyResult.headHash ? shortHash(verifyResult.headHash) : "(empty)"}
              </code>
            </p>
          </div>
        )}
        {verifyResult && !verifyResult.ok && (
          <div className="verify-result verify-result-broken">
            <TornStitch className="torn-stitch" />
            <Badge variant="error">Chain broken</Badge>
            <p className="verify-caption verify-caption-broken">
              {brokenSeq !== null
                ? `The link broke at entry #${brokenSeq}. The offending row is outlined above.`
                : "Verification failed."}
            </p>
          </div>
        )}
        {verifyError !== null && (
          <InlineMessage variant="error">
            Verification failed. The chain was not modified.
          </InlineMessage>
        )}
        <p className="panel-note">
          Verification recomputes every hash back to the first entry. It cannot detect
          entries removed from the end of the log.
        </p>
      </div>
    </Panel>
  );
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}
