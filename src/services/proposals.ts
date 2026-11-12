import { createHash } from "node:crypto";

import type Database from "better-sqlite3";

import { withImmediateTransaction } from "../db/migrate.js";
import { createRepositories, type DecisionRow, type ProposalRow } from "../db/repositories.js";
import { evaluateProposal } from "../engine/evaluate.js";
import { normalizeRecipient, validateProposal } from "../engine/validate.js";
import { utcDayWindow } from "../engine/window.js";
import { canonicalJson } from "../shared/canonicalJson.js";
import type { Clock } from "../shared/clock.js";
import {
  AuditUnavailableError,
  IdempotencyKeyReusedError,
  SandboxLimitReachedError,
} from "../shared/errors.js";
import { newUlid } from "../shared/ids.js";
import type {
  Actor,
  ConfigSnapshot,
  Decision,
  JsonValue,
  ProposalResponse,
  ProposalStatus,
  Reason,
  ValidProposal,
} from "../shared/types.js";
import { SNAPSHOT_PAYLOAD_VERSION } from "../shared/types.js";
import { appendAudit, type AppendEntry } from "./audit/chain.js";
import { MAX_AUDIT_ENTRIES_PER_SANDBOX, MAX_PROPOSALS_PER_SANDBOX } from "./limits.js";

// ProposalService.submit: the one path by which a proposal becomes a
// decision and, when approved, a payment. One BEGIN IMMEDIATE
// transaction per submit, in the order of design 4.7:
//
//   replay check -> limits -> persist proposal -> audit received ->
//   validate -> read state -> evaluate -> persist decision -> audit ->
//   (approved only) payment + audit -> status
//
// (Validation runs before the persist in code, because an invalid
// proposal's single audit row must carry the validation outcome; the
// persisted state is identical either way, since the transaction is
// all-or-nothing.)
//
// Fail-closed throughout: anything unreadable or unexpected becomes a
// REJECTED decision with ENGINE_ERROR, and if the audit write itself
// fails the whole transaction rolls back and the caller gets a 503
// with nothing executed and nothing partially persisted.

/** Test-only fault-injection seam. Every hook defaults off; production callers never pass one. */
export interface SubmitFaults {
  failConfigRead?: boolean;
  failAllowlistRead?: boolean;
  failLedgerSum?: boolean;
  /** Throw while appending the DECISION_MADE audit entry, simulating the second write failing. */
  failSecondWrite?: boolean;
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Stable stringify for idempotency hashing: sorted keys, JSON values.
 * Deliberately NOT canonicalJson: a replay comparison must survive
 * floats and odd values in a malformed body (they stringify
 * deterministically), while the audit chain rightly rejects them.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const parts = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${parts.join(",")}}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/** SHA-256 of the four semantic fields as received. "Same body" means these four fields are equal. */
function requestHashOf(input: unknown): string {
  if (isPlainObject(input)) {
    return sha256Hex(
      stableStringify({
        recipient: input.recipient,
        amountCents: input.amountCents,
        currency: input.currency,
        memo: input.memo,
      }),
    );
  }
  return sha256Hex(stableStringify(input));
}

function buildSnapshot(args: {
  configVersion: number;
  perTxCapCents: number;
  dailyCapCents: number;
  frozen: boolean;
  allowlist: string[];
  createdAt: string;
}): ConfigSnapshot {
  const base = {
    configVersion: args.configVersion,
    perTxCapCents: args.perTxCapCents,
    dailyCapCents: args.dailyCapCents,
    frozen: args.frozen,
    allowlist: [...args.allowlist].sort(),
    createdAt: args.createdAt,
    payloadVersion: SNAPSHOT_PAYLOAD_VERSION,
  };
  return { ...base, snapshotKey: sha256Hex(canonicalJson(base)) };
}

export function toProposalResponse(
  proposal: ProposalRow,
  decision: DecisionRow | undefined,
  replayed: boolean,
): ProposalResponse {
  if (!decision) {
    // No decision row exists only on the invalid-proposal path.
    return {
      proposalId: proposal.id,
      replayed,
      outcome: "REJECTED",
      status: proposal.status,
      reason: "INVALID_PROPOSAL",
      reasons: [],
    };
  }
  const reasons = JSON.parse(decision.reasons_json) as Reason[];
  const firstFailure = reasons.find((r) => !r.passed);
  return {
    proposalId: proposal.id,
    replayed,
    outcome: decision.outcome,
    status: proposal.status,
    reason: decision.outcome === "APPROVED" ? "APPROVED" : (firstFailure?.code ?? "ENGINE_ERROR"),
    reasons,
  };
}

interface StateRead {
  snapshot: ConfigSnapshot;
  label: string | undefined;
  dailySpentCents: number;
  windowStartIso: string;
}

type ErrorKind = "config" | "allowlist" | "ledger" | "evaluation";

class FailClosed extends Error {
  readonly kind: ErrorKind;

  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export function submitProposal(
  db: Database.Database,
  clock: Clock,
  sandboxId: string,
  input: unknown,
  actor: Actor,
  faults: SubmitFaults = {},
): ProposalResponse {
  const repos = createRepositories(db);
  const requestHash = requestHashOf(input);
  const nowIso = clock.nowIso();

  const append = (entry: AppendEntry) => {
    if (faults.failSecondWrite && entry.type === "DECISION_MADE") {
      throw new Error("injected audit failure on the second write");
    }
    return appendAudit(db, sandboxId, entry);
  };

  try {
    return withImmediateTransaction(db, () => {
      // Replay first: a replay writes nothing and consumes no limit.
      if (isPlainObject(input) && typeof input.idempotencyKey === "string" && input.idempotencyKey !== "") {
        const existing = repos.proposals.getByIdempotencyKey(sandboxId, input.idempotencyKey);
        if (existing) {
          if (existing.request_hash !== requestHash) throw new IdempotencyKeyReusedError();
          const decision = repos.decisions.getByProposalId(existing.id);
          return toProposalResponse(existing, decision, true);
        }
      }

      if (repos.proposals.countBySandbox(sandboxId) >= MAX_PROPOSALS_PER_SANDBOX) {
        throw new SandboxLimitReachedError(`sandbox proposal limit (${MAX_PROPOSALS_PER_SANDBOX}) reached`);
      }
      // A submit writes up to 3 audit entries; refuse before the limit
      // can be crossed rather than after.
      if (repos.audit.countBySandbox(sandboxId) + 3 > MAX_AUDIT_ENTRIES_PER_SANDBOX) {
        throw new SandboxLimitReachedError(`sandbox audit limit (${MAX_AUDIT_ENTRIES_PER_SANDBOX}) reached`);
      }

      const proposalId = newUlid(clock);
      const validation = validateProposal(input);

      if (!validation.ok) {
        persistInvalidProposal(repos, sandboxId, proposalId, input, requestHash, nowIso, actor, validation.fields, append);
        const stored = repos.proposals.getById(proposalId);
        if (!stored) throw new Error("proposal insert did not persist");
        return toProposalResponse(stored, undefined, false);
      }

      const { proposal, idempotencyKey } = validation;

      // The label is resolved from the allowlist once state is read;
      // the row is inserted first with a null label and the label is
      // not part of the decision. To keep the row write-once, state is
      // read before the insert (same transaction, same guarantees).
      let state: StateRead;
      try {
        state = readState(db, clock, sandboxId, proposal.recipientKey, faults);
      } catch (error) {
        if (error instanceof FailClosed) {
          persistProposalRow(repos, sandboxId, proposalId, proposal, idempotencyKey, requestHash, nowIso, null);
          appendReceived(proposalId, proposal, idempotencyKey, nowIso, actor, append);
          return recordEngineError(repos, proposalId, nowIso, actor, error.kind, append);
        }
        throw error;
      }

      persistProposalRow(repos, sandboxId, proposalId, proposal, idempotencyKey, requestHash, nowIso, state.label ?? null);
      appendReceived(proposalId, proposal, idempotencyKey, nowIso, actor, append);

      let decision: Decision;
      try {
        decision = evaluateProposal({
          proposal,
          snapshot: state.snapshot,
          dailySpentCents: state.dailySpentCents,
        });
      } catch {
        return recordEngineError(repos, proposalId, nowIso, actor, "evaluation", append);
      }

      persistDecision(repos, sandboxId, proposalId, proposal, decision, state, nowIso, actor, append);

      const status: ProposalStatus = decision.outcome === "APPROVED" ? "EXECUTED" : "BLOCKED";
      repos.proposals.updateStatus(proposalId, status);
      const stored = repos.proposals.getById(proposalId);
      const storedDecision = repos.decisions.getByProposalId(proposalId);
      if (!stored || !storedDecision) throw new Error("decision insert did not persist");
      return toProposalResponse(stored, storedDecision, false);
    });
  } catch (error) {
    // Domain errors (idempotency, limits) pass through untouched. Any
    // other failure inside the transaction means the audit write or a
    // state read broke: the transaction rolled back, nothing executed,
    // and the caller gets a 503, never a half-written decision.
    if (error instanceof IdempotencyKeyReusedError || error instanceof SandboxLimitReachedError) throw error;
    throw new AuditUnavailableError();
  }
}

function persistProposalRow(
  repos: ReturnType<typeof createRepositories>,
  sandboxId: string,
  proposalId: string,
  proposal: ValidProposal,
  idempotencyKey: string | undefined,
  requestHash: string,
  nowIso: string,
  label: string | null,
): void {
  repos.proposals.insert({
    id: proposalId,
    sandbox_id: sandboxId,
    idempotency_key: idempotencyKey ?? null,
    request_hash: requestHash,
    amount_cents: proposal.amountCents,
    currency: proposal.currency,
    memo: proposal.memo,
    recipient_key: proposal.recipientKey,
    label,
    status: "RECEIVED",
    created_at: nowIso,
  });
}

function appendReceived(
  proposalId: string,
  proposal: ValidProposal,
  idempotencyKey: string | undefined,
  nowIso: string,
  actor: Actor,
  append: (entry: AppendEntry) => { seq: number; hash: string },
): void {
  append({
    type: "PROPOSAL_RECEIVED",
    ts: nowIso,
    actor,
    proposalId,
    payload: {
      recipientKey: proposal.recipientKey,
      amountCents: proposal.amountCents,
      currency: proposal.currency,
      memo: proposal.memo,
      idempotencyKey: idempotencyKey ?? null,
    },
  });
}

function persistInvalidProposal(
  repos: ReturnType<typeof createRepositories>,
  sandboxId: string,
  proposalId: string,
  input: unknown,
  requestHash: string,
  nowIso: string,
  actor: Actor,
  fields: { field: string; message: string }[],
  append: (entry: AppendEntry) => { seq: number; hash: string },
): void {
  const raw = isPlainObject(input) ? input : {};
  const normalized = typeof raw.recipient === "string" ? normalizeRecipient(raw.recipient) : { ok: false as const };
  const recipientKey = normalized.ok
    ? normalized.key
    : typeof raw.recipient === "string"
      ? raw.recipient.trim().slice(0, 64)
      : "";
  const amountCents =
    typeof raw.amountCents === "number" && Number.isSafeInteger(raw.amountCents) ? raw.amountCents : 0;
  const currency = typeof raw.currency === "string" ? raw.currency : "";
  const memo = typeof raw.memo === "string" ? raw.memo : "";
  const key = typeof raw.idempotencyKey === "string" && raw.idempotencyKey !== "" ? raw.idempotencyKey : null;
  repos.proposals.insert({
    id: proposalId,
    sandbox_id: sandboxId,
    idempotency_key: key,
    request_hash: requestHash,
    amount_cents: amountCents,
    currency,
    memo: memo === "" ? null : memo,
    recipient_key: recipientKey,
    label: null,
    status: "RECEIVED",
    created_at: nowIso,
  });
  append({
    type: "PROPOSAL_RECEIVED",
    ts: nowIso,
    actor,
    proposalId,
    payload: {
      recipientKey,
      amountCents,
      currency,
      memo,
      idempotencyKey: key,
      invalid: true,
      fields: fields.map((f) => ({ field: f.field, message: f.message })),
      outcome: "REJECTED",
      reason: "INVALID_PROPOSAL",
    },
  });
  repos.proposals.updateStatus(proposalId, "BLOCKED");
}

function readState(
  db: Database.Database,
  clock: Clock,
  sandboxId: string,
  recipientKey: string,
  faults: SubmitFaults,
): StateRead {
  const repos = createRepositories(db);
  if (faults.failConfigRead) throw new FailClosed("config", "injected config read failure");
  const config = repos.config.getBySandbox(sandboxId);
  if (!config) throw new FailClosed("config", "config row is missing");
  if (
    !Number.isSafeInteger(config.per_tx_cap_cents) ||
    !Number.isSafeInteger(config.daily_cap_cents) ||
    config.per_tx_cap_cents <= 0 ||
    config.daily_cap_cents <= 0 ||
    config.per_tx_cap_cents > config.daily_cap_cents ||
    (config.frozen !== 0 && config.frozen !== 1) ||
    !Number.isSafeInteger(config.config_version) ||
    config.config_version < 1
  ) {
    throw new FailClosed("config", "config row failed validation");
  }
  if (faults.failAllowlistRead) throw new FailClosed("allowlist", "injected allowlist read failure");
  const allowlistRows = repos.allowlist.listBySandbox(sandboxId);
  const label = allowlistRows.find((r) => r.recipient_key === recipientKey)?.label;

  const window = utcDayWindow(clock.now().getTime());
  const windowStartIso = new Date(window.startMs).toISOString();
  const windowEndIso = new Date(window.endMs).toISOString();
  if (faults.failLedgerSum) throw new FailClosed("ledger", "injected ledger read failure");
  const dailySpentCents = repos.payments.sumForWindow(sandboxId, windowStartIso, windowEndIso);

  return {
    snapshot: buildSnapshot({
      configVersion: config.config_version,
      perTxCapCents: config.per_tx_cap_cents,
      dailyCapCents: config.daily_cap_cents,
      frozen: config.frozen === 1,
      allowlist: allowlistRows.map((r) => r.recipient_key),
      createdAt: clock.nowIso(),
    }),
    label,
    dailySpentCents,
    windowStartIso,
  };
}

function persistDecision(
  repos: ReturnType<typeof createRepositories>,
  sandboxId: string,
  proposalId: string,
  proposal: ValidProposal,
  decision: Decision,
  state: StateRead,
  nowIso: string,
  actor: Actor,
  append: (entry: AppendEntry) => { seq: number; hash: string },
): void {
  repos.decisions.insert({
    proposal_id: proposalId,
    outcome: decision.outcome,
    reasons_json: JSON.stringify(decision.reasons),
    snapshot_json: JSON.stringify(decision.snapshot),
    created_at: nowIso,
  });
  append({
    type: "DECISION_MADE",
    ts: nowIso,
    actor,
    proposalId,
    payload: {
      outcome: decision.outcome,
      reason: decision.reason,
      reasons: decision.reasons as unknown as JsonValue[],
      snapshot: decision.snapshot as unknown as Record<string, JsonValue>,
      dailySpentCents: state.dailySpentCents,
      windowStart: state.windowStartIso,
    },
  });
  if (decision.outcome === "APPROVED") {
    const paymentId = newUlid();
    repos.payments.insert({
      id: paymentId,
      sandbox_id: sandboxId,
      proposal_id: proposalId,
      decision_id: proposalId,
      amount_cents: proposal.amountCents,
      recipient_key: proposal.recipientKey,
      created_at: nowIso,
      executed_at: nowIso,
    });
    append({
      type: "PAYMENT_EXECUTED",
      ts: nowIso,
      actor,
      proposalId,
      payload: {
        paymentId,
        amountCents: proposal.amountCents,
        recipientKey: proposal.recipientKey,
      },
    });
  }
}

function recordEngineError(
  repos: ReturnType<typeof createRepositories>,
  proposalId: string,
  nowIso: string,
  actor: Actor,
  kind: ErrorKind,
  append: (entry: AppendEntry) => { seq: number; hash: string },
): ProposalResponse {
  repos.decisions.insert({
    proposal_id: proposalId,
    outcome: "REJECTED",
    reasons_json: "[]",
    snapshot_json: "null",
    created_at: nowIso,
  });
  append({
    type: "DECISION_MADE",
    ts: nowIso,
    actor,
    proposalId,
    payload: {
      outcome: "REJECTED",
      reason: "ENGINE_ERROR",
      reasons: [],
      snapshot: null,
      errorKind: kind,
    },
  });
  repos.proposals.updateStatus(proposalId, "BLOCKED");
  const stored = repos.proposals.getById(proposalId);
  const storedDecision = repos.decisions.getByProposalId(proposalId);
  if (!stored || !storedDecision) throw new Error("engine-error decision did not persist");
  return toProposalResponse(stored, storedDecision, false);
}
