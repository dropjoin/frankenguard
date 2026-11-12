import type Database from "better-sqlite3";

import { createRepositories } from "../../db/repositories.js";
import { normalizeRecipient } from "../../engine/validate.js";
import { NotFoundError } from "../../shared/errors.js";
import type {
  AuditEntryView,
  AuditType,
  AuditQuery,
  Decision,
  JsonValue,
  ProposalBundle,
  Reason,
} from "../../shared/types.js";

// Audit queries: cursor-paginated listing with filters, and the
// proposal bundle (proposal + decision + payment + linked entries).
// Reads only. Filters are deliberately simple SQL over the JSON
// payloads; the payload shapes are the contract with proposals.ts and
// config.ts, and the tests pin them.
//
//   outcome: matches any entry whose payload carries that outcome
//     (DECISION_MADE rows, plus the PROPOSAL_RECEIVED row of an invalid
//     proposal, which has no decision of its own).
//   code: matches payload.reason, or any code inside payload.reasons.
//   recipient: matches payload.recipientKey, or any entry linked to a
//     proposal whose recipient_key matches (after normalization).

interface AuditRow {
  seq: number;
  type: AuditType;
  ts: string;
  actor: string;
  proposal_id: string | null;
  payload: string;
  prev_hash: string;
  hash: string;
}

function toView(row: AuditRow): AuditEntryView {
  // A stored payload that is not valid JSON can only come from a
  // corrupted database: appendAudit canonicalizes at write time.
  // The entry is still listed, marked, with an empty payload, so
  // one bad row cannot 500 the whole audit view or bundle.
  let payload: Record<string, JsonValue>;
  let payloadParseError: boolean | undefined;
  try {
    payload = JSON.parse(row.payload) as Record<string, JsonValue>;
  } catch {
    payload = {};
    payloadParseError = true;
  }
  return {
    seq: row.seq,
    type: row.type,
    ts: row.ts,
    actor: row.actor as AuditEntryView["actor"],
    proposalId: row.proposal_id,
    payload,
    prevHash: row.prev_hash,
    hash: row.hash,
    ...(payloadParseError ? { payloadParseError } : {}),
  };
}

export function listAudit(
  db: Database.Database,
  sandboxId: string,
  query: AuditQuery,
): { entries: AuditEntryView[]; nextAfterSeq: number | null } {
  const conditions: string[] = ["sandbox_id = ?"];
  const params: unknown[] = [sandboxId];
  if (query.afterSeq !== undefined) {
    conditions.push("seq > ?");
    params.push(query.afterSeq);
  }
  if (query.outcome !== undefined) {
    conditions.push("json_extract(payload, '$.outcome') = ?");
    params.push(query.outcome);
  }
  if (query.code !== undefined) {
    conditions.push(
      `(json_extract(payload, '$.reason') = ? OR EXISTS (
         SELECT 1 FROM json_each(payload, '$.reasons')
         WHERE json_extract(value, '$.code') = ?
       ))`,
    );
    params.push(query.code, query.code);
  }
  if (query.recipient !== undefined) {
    const normalized = normalizeRecipient(query.recipient);
    if (!normalized.ok) return { entries: [], nextAfterSeq: null };
    conditions.push(
      `(json_extract(payload, '$.recipientKey') = ? OR proposal_id IN (
         SELECT id FROM proposals WHERE sandbox_id = ? AND recipient_key = ?
       ))`,
    );
    params.push(normalized.key, sandboxId, normalized.key);
  }
  const limit = query.limit ?? 50;
  const rows = db
    .prepare(
      `SELECT seq, type, ts, actor, proposal_id, payload, prev_hash, hash
       FROM audit_log WHERE ${conditions.join(" AND ")} ORDER BY seq ASC LIMIT ?`,
    )
    .all(...params, limit + 1) as AuditRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    entries: page.map(toView),
    nextAfterSeq: hasMore && last ? last.seq : null,
  };
}

export function getProposalBundle(
  db: Database.Database,
  sandboxId: string,
  proposalId: string,
): ProposalBundle {
  const repos = createRepositories(db);
  const proposal = repos.proposals.getById(proposalId);
  if (!proposal || proposal.sandbox_id !== sandboxId) {
    throw new NotFoundError(`proposal "${proposalId}"`);
  }
  const decisionRow = repos.decisions.getByProposalId(proposalId);
  const paymentRow = repos.payments.getByProposalId(proposalId);
  const auditRows = db
    .prepare(
      `SELECT seq, type, ts, actor, proposal_id, payload, prev_hash, hash
       FROM audit_log WHERE sandbox_id = ? AND proposal_id = ? ORDER BY seq ASC`,
    )
    .all(sandboxId, proposalId) as AuditRow[];
  let decision: Decision | null = null;
  if (decisionRow) {
    const reasons = JSON.parse(decisionRow.reasons_json) as Reason[];
    const firstFailure = reasons.find((r) => !r.passed);
    decision = {
      outcome: decisionRow.outcome,
      reasons,
      snapshot: JSON.parse(decisionRow.snapshot_json) as Decision["snapshot"],
      reason: decisionRow.outcome === "APPROVED" ? "APPROVED" : (firstFailure?.code ?? "ENGINE_ERROR"),
    };
  }
  return {
    proposal: {
      id: proposal.id,
      amountCents: proposal.amount_cents,
      currency: proposal.currency,
      memo: proposal.memo ?? "",
      recipientKey: proposal.recipient_key,
      label: proposal.label ?? undefined,
      status: proposal.status,
      idempotencyKey: proposal.idempotency_key ?? undefined,
      createdAt: proposal.created_at,
    },
    decision,
    payment: paymentRow
      ? {
          id: paymentRow.id,
          amountCents: paymentRow.amount_cents,
          recipientKey: paymentRow.recipient_key,
          executedAt: paymentRow.executed_at,
        }
      : null,
    auditEntries: auditRows.map(toView),
  };
}
