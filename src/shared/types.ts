import { z } from "zod";

import { MAX_CAP_CENTS } from "./money.js";

// Domain types (design 3.2) and the Zod schemas that guard the system
// boundary. The engine's validateProposal is the authoritative shape
// check for proposals; these schemas guard agent output and client
// input before it reaches the service.

export type RuleName = "FREEZE" | "ALLOWLIST" | "PER_TX_CAP" | "DAILY_CAP";

export const RULE_ORDER: readonly RuleName[] = ["FREEZE", "ALLOWLIST", "PER_TX_CAP", "DAILY_CAP"];

export type Outcome = "APPROVED" | "REJECTED";

/**
 * Reason codes. The pass/fail pair per rule comes from design 3.2; the
 * per-transaction pass code WITHIN_PER_TX_CAP is derived by symmetry
 * with the captured WITHIN_DAILY_CAP, since the 3.2 table rows were
 * truncated in retrieval (see BUILD-JOURNAL derivations). The two
 * decision-level codes cover the paths where no rule runs at all:
 * INVALID_PROPOSAL (shape validation failed, R1.3) and ENGINE_ERROR
 * (evaluation could not run, R2.8).
 */
export type ReasonCode =
  | "SYSTEM_FROZEN"
  | "NOT_FROZEN"
  | "RECIPIENT_ALLOWED"
  | "RECIPIENT_NOT_ALLOWED"
  | "WITHIN_PER_TX_CAP"
  | "PER_TX_CAP_EXCEEDED"
  | "WITHIN_DAILY_CAP"
  | "DAILY_CAP_EXCEEDED"
  | "INVALID_PROPOSAL"
  | "ENGINE_ERROR";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Reason {
  rule: RuleName;
  passed: boolean;
  code: ReasonCode;
  /** Human-readable, at most 280 chars. Never built from agent text. */
  message: string;
  /** Supporting numbers only: caps, amounts, remaining cents. Must survive canonicalJson (integers, no floats). */
  detail: Record<string, JsonValue>;
}

/** What the agent (or the visitor's form) submits. Untrusted input: every field is re-validated by the engine. */
export interface ProposalInput {
  recipient: string;
  amountCents: number;
  currency: string;
  memo: string;
  idempotencyKey?: string;
}

/**
 * A proposal that passed shape validation. The label is resolved
 * server-side from the allowlist at submit time, never supplied by the
 * caller: a display name must not be usable as an identity (R4.3).
 */
export interface ValidProposal {
  recipientKey: string;
  label?: string;
  amountCents: number;
  currency: "USD";
  memo: string;
}

/**
 * The frozen configuration one evaluation ran against. The allowlist is
 * stored sorted so two snapshots of the same policy compare equal.
 * payloadVersion lets a future shape change stay readable; snapshotKey
 * is the SHA-256 of the canonical snapshot, so a decision can be tied
 * to the exact policy it ran against.
 */
export interface ConfigSnapshot {
  configVersion: number;
  perTxCapCents: number;
  dailyCapCents: number;
  frozen: boolean;
  allowlist: string[];
  createdAt: string;
  snapshotKey: string;
  payloadVersion: string;
}

export const SNAPSHOT_PAYLOAD_VERSION = "1";

/** A decision: the outcome, the primary code, one reason per rule, and the snapshot it ran against. */
export interface Decision {
  outcome: Outcome;
  /** First failing rule's code, or INVALID_PROPOSAL / ENGINE_ERROR on the paths where no rule ran. "APPROVED" when every rule passed. */
  reason: ReasonCode | "APPROVED";
  reasons: Reason[];
  /** Null only for ENGINE_ERROR decisions, where no snapshot could be read. */
  snapshot: ConfigSnapshot | null;
}

export type ProposalStatus = "RECEIVED" | "EXECUTED" | "BLOCKED";

export type AuditType =
  | "PROPOSAL_RECEIVED"
  | "DECISION_MADE"
  | "PAYMENT_EXECUTED"
  | "CONFIG_CHANGED"
  | "SANDBOX_CREATED"
  | "AUDIT_VERIFIED"
  | "CAPS_CHANGED"
  | "ALLOWLIST_CHANGED"
  | "FREEZE_CHANGED";

export type Actor = "operator" | "operator:manual" | "agent:scripted" | "system";

// --- Zod schemas: system boundary -----------------------------------------

export const proposalInputSchema = z.object({
  recipient: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  memo: z.string(),
  idempotencyKey: z.string().max(128).optional(),
});

export const capsSchema = z
  .object({
    perTxCapCents: z.number().int().positive().max(MAX_CAP_CENTS),
    dailyCapCents: z.number().int().positive().max(MAX_CAP_CENTS),
  })
  .refine((v) => v.perTxCapCents <= v.dailyCapCents, {
    message: "per-transaction cap must not exceed the daily cap",
  });

export const freezeSchema = z.object({
  frozen: z.boolean(),
  note: z.string().max(280).optional(),
});

export const allowlistAddSchema = z.object({
  recipient: z.string(),
  label: z.string().trim().min(1).max(64).optional(),
});

export const allowlistRemoveSchema = z.object({
  recipient: z.string(),
});

export const SCENARIO_IDS = [
  "happy_path",
  "over_per_tx",
  "over_daily",
  "unknown_recipient",
  "frozen",
  "prompt_injection",
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export const agentRunSchema = z
  .object({
    scenario: z.enum(SCENARIO_IDS).optional(),
    prompt: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((v) => v.scenario !== undefined || v.prompt !== undefined, {
    message: "either scenario or prompt is required",
  });

export const auditQuerySchema = z.object({
  afterSeq: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  outcome: z.enum(["APPROVED", "REJECTED"]).optional(),
  code: z.string().max(30).optional(),
  recipient: z.string().max(64).optional(),
});

// --- API response shapes ---------------------------------------------------

export interface ProposalResponse {
  proposalId: string;
  replayed: boolean;
  outcome: Outcome;
  status: ProposalStatus;
  reason: ReasonCode | "APPROVED";
  reasons: Reason[];
}

export interface AuditEntryView {
  seq: number;
  type: AuditType;
  ts: string;
  actor: Actor;
  proposalId: string | null;
  payload: Record<string, JsonValue>;
  prevHash: string;
  hash: string;
}

export interface StateResponse {
  sandboxId: string;
  configVersion: number;
  perTxCapCents: number;
  dailyCapCents: number;
  frozen: boolean;
  allowlist: { key: string; label: string }[];
  dailySpentCents: number;
  dailyRemainingCents: number;
  windowStart: string;
  windowEnd: string;
  proposalCount: number;
  paymentCount: number;
  paymentTotalCents: number;
  recentProposals: ProposalResponse[];
  agentMode: "scripted" | "live";
  auditHead: { entries: number; headHash: string | null };
}

export interface VerifyResponse {
  ok: boolean;
  entries: number;
  headHash: string | null;
  brokenAtSeq?: number;
  reason?: string;
}
