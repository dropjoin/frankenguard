import { useEffect, useState } from "react";

import {
  REASON_CODE_LABELS,
  RULE_DESCRIPTIONS,
  RULE_LABELS,
} from "../../../engine/clientOnly.js";
import { formatUsd } from "../../../shared/money.js";
import {
  RULE_ORDER,
  type ProposalBundle,
  type ProposalResponse,
  type Reason,
  type StateResponse,
} from "../../../shared/types.js";
import { useStore } from "../store.js";
import { GhostMascot, MonsterHead, SutureDivider, type GhostState } from "./art/index.js";
import { Badge, InlineMessage, Panel } from "./primitives.js";

// DecisionPanel: the verdicts. Cards newest-first, each with its
// four rule rows in fixed order, the reason codes in mono, and the
// ghost reacting to the latest outcome. The lab strip lights its
// four stamps in sequence for the latest decision. Selecting a card
// loads the full proposal bundle (recipient, amount, memo) from the
// server; agent-supplied text is rendered as text, never as HTML.

const RULE_SHORT: Record<(typeof RULE_ORDER)[number], string> = {
  FREEZE: "Freeze",
  ALLOWLIST: "Allowlist",
  PER_TX_CAP: "Per-tx",
  DAILY_CAP: "Daily",
};

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function RuleRow({ reason }: { reason: Reason }) {
  return (
    <li className="rule-row">
      <span
        aria-hidden="true"
        className={
          reason.passed ? "rule-badge rule-badge-pass" : "rule-badge rule-badge-fail"
        }
      >
        {reason.passed ? "✓" : "✕"}
      </span>
      <span className="rule-row-body">
        <span className="rule-row-label">{RULE_LABELS[reason.rule]}</span>
        <span
          className={
            reason.passed
              ? "rule-message rule-message-pass"
              : "rule-message rule-message-fail"
          }
        >
          {reason.message}
        </span>
        <span className="rule-row-meta">
          <code className="font-mono reason-code">{reason.code}</code>
          <span className="rule-row-description">{RULE_DESCRIPTIONS[reason.rule]}</span>
        </span>
      </span>
    </li>
  );
}

function DecisionCard({
  proposal,
  isLatest,
  isAgentProposal,
  expanded,
  bundle,
  bundleLoading,
  onToggle,
}: {
  proposal: ProposalResponse;
  isLatest: boolean;
  isAgentProposal: boolean;
  expanded: boolean;
  bundle: ProposalBundle | null;
  bundleLoading: boolean;
  onToggle: () => void;
}) {
  const approved = proposal.outcome === "APPROVED";
  const decisionLevel = proposal.reasons.length === 0;
  const classes = [
    "decision-card",
    approved ? "decision-card-approved" : "decision-card-blocked",
    isLatest ? "decision-card-latest decision-card-enter" : "",
    isLatest && !approved ? "decision-card-blocked-enter" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <article className={classes}>
      <button
        aria-expanded={expanded}
        className="decision-card-toggle"
        onClick={onToggle}
        type="button"
      >
        <span className="decision-card-head">
          <Badge variant={approved ? "success" : "error"}>
            {approved ? "APPROVED" : "BLOCKED"}
          </Badge>
          {isAgentProposal && <span className="badge badge-blue">Agent proposal</span>}
          <span className="font-mono decision-card-id">
            {shortId(proposal.proposalId)}
          </span>
          {proposal.replayed && <span className="decision-card-replayed">replay</span>}
        </span>
        {!approved && !decisionLevel && (
          <span className="decision-card-caught">Caught by FrankenGuard!</span>
        )}
        <span className="decision-card-summary">
          {decisionLevel
            ? (REASON_CODE_LABELS[proposal.reason as keyof typeof REASON_CODE_LABELS] ??
              proposal.reason)
            : proposal.reason === "APPROVED"
              ? "All four rules passed."
              : `Failed on ${REASON_CODE_LABELS[proposal.reason as keyof typeof REASON_CODE_LABELS] ?? proposal.reason}.`}
        </span>
      </button>
      {decisionLevel ? (
        <p className="decision-level-note">
          No rule ran for this proposal. Reason:{" "}
          <code className="font-mono reason-code">{proposal.reason}</code>
          {proposal.reason === "INVALID_PROPOSAL" &&
            " — the proposal failed shape validation before the rules saw it."}
          {proposal.reason === "ENGINE_ERROR" &&
            " — the engine could not run, so nothing was executed."}
        </p>
      ) : (
        <ol className="rule-rows">
          {RULE_ORDER.map((rule) => {
            const reason = proposal.reasons.find((r) => r.rule === rule);
            return reason ? <RuleRow key={rule} reason={reason} /> : null;
          })}
        </ol>
      )}
      {expanded && (
        <div className="decision-detail">
          {bundleLoading && <p className="panel-note">Loading the full proposal…</p>}
          {bundle && (
            <dl className="decision-detail-list">
              <div>
                <dt>Recipient</dt>
                <dd>{bundle.proposal.recipientKey}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd className="font-display">{formatUsd(bundle.proposal.amountCents)}</dd>
              </div>
              <div>
                <dt>Memo</dt>
                <dd className="decision-memo">
                  {bundle.proposal.memo === "" ? "(no memo)" : bundle.proposal.memo}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{bundle.proposal.status}</dd>
              </div>
              {bundle.payment && (
                <div>
                  <dt>Executed</dt>
                  <dd>
                    {formatUsd(bundle.payment.amountCents)} at{" "}
                    {new Date(bundle.payment.executedAt).toLocaleTimeString()}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}
    </article>
  );
}

export function DecisionPanel({
  state,
  ghostState,
  agentProposalIds,
  selectedId,
  onSelect,
}: {
  state: StateResponse;
  ghostState: GhostState;
  agentProposalIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const store = useStore();
  const [bundle, setBundle] = useState<ProposalBundle | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);

  const latest = state.recentProposals[0] ?? null;

  useEffect(() => {
    if (selectedId === null) {
      setBundle(null);
      return;
    }
    let cancelled = false;
    setBundleLoading(true);
    setBundleError(null);
    store
      .getProposal(selectedId)
      .then((result) => {
        if (!cancelled) setBundle(result);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setBundleError(
            err instanceof Error ? err.message : "could not load the proposal",
          );
      })
      .finally(() => {
        if (!cancelled) setBundleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, store]);

  const announcement = latest
    ? latest.outcome === "APPROVED"
      ? `Latest decision: approved, proposal ${shortId(latest.proposalId)}. All four rules passed.`
      : `Latest decision: blocked, proposal ${shortId(latest.proposalId)}. ${
          REASON_CODE_LABELS[latest.reason as keyof typeof REASON_CODE_LABELS] ??
          latest.reason
        }.`
    : "No decisions yet.";

  return (
    <Panel
      aside={<GhostMascot className="ghost-md ghost-float" state={ghostState} />}
      title="Decisions"
      variant="sky"
    >
      <p aria-live="polite" className="visually-hidden">
        {announcement}
      </p>

      <div className="lab-strip">
        <MonsterHead />
        <div className="lab-stamps" aria-label="Latest decision by rule">
          {RULE_ORDER.map((rule, index) => {
            const reason = latest?.reasons.find((r) => r.rule === rule);
            const stampClass =
              reason === undefined
                ? "stamp stamp-idle"
                : reason.passed
                  ? "stamp stamp-pass"
                  : "stamp stamp-fail";
            return (
              <span
                key={rule}
                className={latest ? `${stampClass} stamp-lit` : stampClass}
                style={latest ? { animationDelay: `${index * 90}ms` } : undefined}
              >
                {RULE_SHORT[rule]}
              </span>
            );
          })}
        </div>
      </div>
      <SutureDivider className="suture-divider" />

      {state.recentProposals.length === 0 ? (
        <div className="empty-state">
          <GhostMascot className="ghost-lg ghost-float" state="idle" />
          <p className="empty-state-title">The monster is sleeping.</p>
          <p className="panel-note">
            Run a scenario or propose a payment, and the verdicts will appear here.
          </p>
        </div>
      ) : (
        <div className="decision-list">
          {state.recentProposals.map((proposal, index) => (
            <DecisionCard
              key={proposal.proposalId}
              bundle={selectedId === proposal.proposalId ? bundle : null}
              bundleLoading={selectedId === proposal.proposalId && bundleLoading}
              expanded={selectedId === proposal.proposalId}
              isAgentProposal={agentProposalIds.has(proposal.proposalId)}
              isLatest={index === 0}
              onToggle={() =>
                onSelect(selectedId === proposal.proposalId ? null : proposal.proposalId)
              }
              proposal={proposal}
            />
          ))}
        </div>
      )}
      {bundleError && <InlineMessage variant="error">{bundleError}</InlineMessage>}
    </Panel>
  );
}
