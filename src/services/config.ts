import type Database from "better-sqlite3";

import { withImmediateTransaction } from "../db/migrate.js";
import { createRepositories } from "../db/repositories.js";
import { normalizeRecipient } from "../engine/validate.js";
import type { Clock } from "../shared/clock.js";
import {
  AuditUnavailableError,
  DuplicateRecipientError,
  InvalidInputError,
  NotFoundError,
  SandboxLimitReachedError,
} from "../shared/errors.js";
import type { Actor, CapsConfig } from "../shared/types.js";
import { allowlistAddSchema, allowlistRemoveSchema, capsSchema, freezeSchema } from "../shared/types.js";
import { appendAudit } from "./audit/chain.js";
import { MAX_ALLOWLIST_ENTRIES } from "./limits.js";

// ConfigService: caps, allowlist, freeze. Every mutation is one
// transaction (state change + audit entry), bumps config_version, and
// validates the input before writing anything. Zod validation happens
// outside the transaction so an invalid body can never leave a
// half-written config behind.

export interface CapsResult {
  configVersion: number;
  perTxCapCents: number;
  dailyCapCents: number;
}

function parseOr422<T>(parsed: { success: boolean; data?: T; error?: { issues: { path: (string | number)[]; message: string }[] } }): T {
  if (parsed.success && parsed.data !== undefined) return parsed.data;
  const first = parsed.error?.issues[0];
  throw new InvalidInputError(first ? `${String(first.path[0] ?? "input")}: ${first.message}` : "invalid input");
}

export function updateCaps(
  db: Database.Database,
  clock: Clock,
  sandboxId: string,
  input: unknown,
  actor: Actor,
): CapsResult {
  const caps = parseOr422(capsSchema.safeParse(input));
  const nowIso = clock.nowIso();
  return withImmediateTransaction(db, () => {
    const repos = createRepositories(db);
    const current = repos.config.getBySandbox(sandboxId);
    if (!current) throw new AuditUnavailableError();
    repos.config.updateCaps(sandboxId, caps.perTxCapCents, caps.dailyCapCents, nowIso);
    const updated = repos.config.getBySandbox(sandboxId);
    if (!updated) throw new AuditUnavailableError();
    appendAudit(db, sandboxId, {
      type: "CAPS_CHANGED",
      ts: nowIso,
      actor,
      proposalId: null,
      payload: {
        previous: {
          perTxCapCents: current.per_tx_cap_cents,
          dailyCapCents: current.daily_cap_cents,
        },
        new: { perTxCapCents: caps.perTxCapCents, dailyCapCents: caps.dailyCapCents },
        configVersion: updated.config_version,
      },
    });
    return {
      configVersion: updated.config_version,
      perTxCapCents: updated.per_tx_cap_cents,
      dailyCapCents: updated.daily_cap_cents,
    };
  });
}

export function addRecipient(
  db: Database.Database,
  clock: Clock,
  sandboxId: string,
  input: unknown,
  actor: Actor,
): { recipientKey: string; label: string } {
  const parsed = parseOr422(allowlistAddSchema.safeParse(input));
  const normalized = normalizeRecipient(parsed.recipient);
  if (!normalized.ok) throw new InvalidInputError(`recipient: ${normalized.error}`);
  const label = parsed.label ?? parsed.recipient.trim();
  const nowIso = clock.nowIso();
  return withImmediateTransaction(db, () => {
    const repos = createRepositories(db);
    if (repos.allowlist.countBySandbox(sandboxId) >= MAX_ALLOWLIST_ENTRIES) {
      throw new SandboxLimitReachedError(`allowlist limit (${MAX_ALLOWLIST_ENTRIES}) reached`);
    }
    if (repos.allowlist.getByKey(sandboxId, normalized.key)) {
      throw new DuplicateRecipientError();
    }
    repos.allowlist.insert({
      sandbox_id: sandboxId,
      recipient_key: normalized.key,
      label,
      created_at: nowIso,
    });
    appendAudit(db, sandboxId, {
      type: "ALLOWLIST_CHANGED",
      ts: nowIso,
      actor,
      proposalId: null,
      payload: { change: "added", recipientKey: normalized.key, label },
    });
    return { recipientKey: normalized.key, label };
  });
}

export function removeRecipient(
  db: Database.Database,
  clock: Clock,
  sandboxId: string,
  input: unknown,
  actor: Actor,
): { recipientKey: string } {
  const parsed = parseOr422(allowlistRemoveSchema.safeParse(input));
  const normalized = normalizeRecipient(parsed.recipient);
  if (!normalized.ok) throw new InvalidInputError(`recipient: ${normalized.error}`);
  const nowIso = clock.nowIso();
  return withImmediateTransaction(db, () => {
    const repos = createRepositories(db);
    const removed = repos.allowlist.remove(sandboxId, normalized.key);
    if (!removed) throw new NotFoundError(`recipient "${parsed.recipient}"`);
    appendAudit(db, sandboxId, {
      type: "ALLOWLIST_CHANGED",
      ts: nowIso,
      actor,
      proposalId: null,
      payload: { change: "removed", recipientKey: normalized.key },
    });
    return { recipientKey: normalized.key };
  });
}

export interface FreezeResult {
  configVersion: number;
  frozen: boolean;
}

export function setFrozen(
  db: Database.Database,
  clock: Clock,
  sandboxId: string,
  input: unknown,
  actor: Actor,
): FreezeResult {
  const parsed = parseOr422(freezeSchema.safeParse(input));
  const nowIso = clock.nowIso();
  return withImmediateTransaction(db, () => {
    const repos = createRepositories(db);
    const current = repos.config.getBySandbox(sandboxId);
    if (!current) throw new AuditUnavailableError();
    repos.config.updateFrozen(sandboxId, parsed.frozen ? 1 : 0, nowIso);
    const updated = repos.config.getBySandbox(sandboxId);
    if (!updated) throw new AuditUnavailableError();
    appendAudit(db, sandboxId, {
      type: "FREEZE_CHANGED",
      ts: nowIso,
      actor,
      proposalId: null,
      payload: {
        previous: current.frozen === 1,
        new: parsed.frozen,
        note: parsed.note ?? null,
        configVersion: updated.config_version,
      },
    });
    return { configVersion: updated.config_version, frozen: parsed.frozen };
  });
}

export function getCaps(db: Database.Database, sandboxId: string): CapsConfig {
  const config = createRepositories(db).config.getBySandbox(sandboxId);
  if (!config) throw new AuditUnavailableError();
  return {
    configVersion: config.config_version,
    perTxCapCents: config.per_tx_cap_cents,
    dailyCapCents: config.daily_cap_cents,
    frozen: config.frozen === 1,
  };
}
