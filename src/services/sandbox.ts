import type Database from "better-sqlite3";

import { withImmediateTransaction, withPurgeMode } from "../db/migrate.js";
import { createRepositories, type SandboxRow } from "../db/repositories.js";
import type { Clock } from "../shared/clock.js";
import { newSandboxId } from "../shared/ids.js";
import { appendAudit } from "./audit/chain.js";

// Sandbox lifecycle: one isolated demo world per visitor. Seeded with
// the default policy, three recipients, and a SANDBOX_CREATED audit
// entry as the chain's first row. Idle 60 minutes or 4 hours absolute,
// whichever comes first, and the sweeper purges it. The clock is
// clamped non-decreasing per sandbox: a backward clock jump must never
// resurrect an expired sandbox or double-count a day.

export const DEFAULT_PER_TX_CAP_CENTS = 50_000; // $500
export const DEFAULT_DAILY_CAP_CENTS = 100_000; // $1,000

export const IDLE_TTL_MS = 60 * 60 * 1000;
export const ABSOLUTE_TTL_MS = 4 * 60 * 60 * 1000;

/**
 * Seed recipients (design 7). The keys are Kiro's; the labels are
 * derived: "Acme Corp" is the name the scripted scenarios use for
 * acme-corp, and the other two follow the same key-to-label pattern.
 */
export const SEED_ALLOWLIST: readonly { key: string; label: string }[] = [
  { key: "acme-corp", label: "Acme Corp" },
  { key: "globex-corp", label: "Globex Corp" },
  { key: "initech", label: "Initech" },
];

export interface Sandbox {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  state: string;
}

function toSandbox(row: SandboxRow): Sandbox {
  return {
    id: row.id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    state: row.state,
  };
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

/** The sandbox's effective now: the clock, unless the sandbox has seen a later time (clock moved backward). */
function clampedNowMs(sandbox: SandboxRow, clock: Clock): number {
  return Math.max(clock.now().getTime(), Date.parse(sandbox.last_seen_at));
}

export function createSandbox(db: Database.Database, clock: Clock): Sandbox {
  const id = newSandboxId();
  const nowIso = clock.nowIso();
  const expiresAt = addMs(nowIso, IDLE_TTL_MS);
  const repos = createRepositories(db);
  withImmediateTransaction(db, () => {
    repos.sandboxes.insert({
      id,
      created_at: nowIso,
      last_seen_at: nowIso,
      expires_at: expiresAt,
      state: "ACTIVE",
    });
    repos.config.insert({
      sandbox_id: id,
      config_version: 1,
      per_tx_cap_cents: DEFAULT_PER_TX_CAP_CENTS,
      daily_cap_cents: DEFAULT_DAILY_CAP_CENTS,
      frozen: 0,
      updated_at: nowIso,
    });
    for (const seed of SEED_ALLOWLIST) {
      repos.allowlist.insert({
        sandbox_id: id,
        recipient_key: seed.key,
        label: seed.label,
        created_at: nowIso,
      });
    }
    appendAudit(db, id, {
      type: "SANDBOX_CREATED",
      ts: nowIso,
      actor: "system",
      proposalId: null,
      payload: {
        configVersion: 1,
        perTxCapCents: DEFAULT_PER_TX_CAP_CENTS,
        dailyCapCents: DEFAULT_DAILY_CAP_CENTS,
        frozen: false,
        allowlist: SEED_ALLOWLIST.map((s) => s.key),
      },
    });
  });
  const created = repos.sandboxes.getById(id);
  if (!created) throw new Error("sandbox creation did not persist");
  return toSandbox(created);
}

/**
 * Load a live sandbox and refresh its idle expiry. Returns null when
 * the id is unknown or the sandbox expired; an expired sandbox is
 * never resurrected by a touch. The idle extension is capped by the
 * absolute lifetime measured from creation.
 */
export function touchSandbox(db: Database.Database, clock: Clock, id: string): Sandbox | null {
  const repos = createRepositories(db);
  const row = repos.sandboxes.getById(id);
  if (!row) return null;
  const nowMs = clampedNowMs(row, clock);
  if (nowMs >= Date.parse(row.expires_at)) return null;
  const nowIso = new Date(nowMs).toISOString();
  const idleExpiry = nowMs + IDLE_TTL_MS;
  const absoluteExpiry = Date.parse(row.created_at) + ABSOLUTE_TTL_MS;
  const expiresAt = new Date(Math.min(idleExpiry, absoluteExpiry)).toISOString();
  withImmediateTransaction(db, () => {
    repos.sandboxes.touch(id, nowIso, expiresAt);
  });
  const touched = repos.sandboxes.getById(id);
  if (!touched) return null;
  return toSandbox(touched);
}

/** Read a sandbox without touching it. Used by the sweeper and tests. */
export function getSandbox(db: Database.Database, id: string): Sandbox | null {
  const row = createRepositories(db).sandboxes.getById(id);
  return row ? toSandbox(row) : null;
}

function purgeSandbox(db: Database.Database, id: string): void {
  withPurgeMode(db, () => {
    withImmediateTransaction(db, () => {
      createRepositories(db).sandboxes.deleteById(id);
    });
  });
}

/** Delete the old sandbox and all its rows, then create a fresh one. The visitor starts over as if it were their first visit. */
export function resetSandbox(db: Database.Database, clock: Clock, oldId: string): Sandbox {
  purgeSandbox(db, oldId);
  return createSandbox(db, clock);
}

/** Purge every sandbox past its expiry. Returns the number purged. This is the only code path that deletes audit rows. */
export function sweepExpired(db: Database.Database, clock: Clock): number {
  const expired = createRepositories(db).sandboxes.listExpired(clock.nowIso());
  for (const row of expired) {
    purgeSandbox(db, row.id);
  }
  return expired.length;
}
