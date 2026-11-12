import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { StoreProvider } from "../../src/web/src/store.js";

import type { FrankenguardApi } from "../../src/web/src/api.js";
import type {
  AuditEntryView,
  ProposalBundle,
  ProposalResponse,
  Reason,
  StateResponse,
} from "../../src/shared/types.js";

// Shared fixtures and a fully-mocked API client for panel tests.
// Panels receive server state through props and call mutations
// through the store, so tests render them inside a real
// StoreProvider backed by the mock client.

export function baseState(overrides: Partial<StateResponse> = {}): StateResponse {
  return {
    sandboxId: "sandbox-1",
    configVersion: 1,
    perTxCapCents: 50_000,
    dailyCapCents: 100_000,
    frozen: false,
    allowlist: [
      { key: "acme-corp", label: "Acme Corp" },
      { key: "globex-corp", label: "Globex Corp" },
      { key: "initech", label: "Initech" },
    ],
    dailySpentCents: 0,
    dailyRemainingCents: 100_000,
    windowStart: "2026-11-13T00:00:00.000Z",
    windowEnd: "2026-11-14T00:00:00.000Z",
    proposalCount: 0,
    paymentCount: 0,
    paymentTotalCents: 0,
    recentProposals: [],
    agentMode: "scripted",
    auditHead: { entries: 1, headHash: "aabbccddeeff00112233445566778899" },
    ...overrides,
  };
}

function reason(rule: Reason["rule"], passed: boolean, code: Reason["code"], message: string): Reason {
  return { rule, passed, code, message, detail: {} };
}

export function approvedProposal(overrides: Partial<ProposalResponse> = {}): ProposalResponse {
  return {
    proposalId: "01K9APPROVED000000000001",
    replayed: false,
    outcome: "APPROVED",
    status: "EXECUTED",
    reason: "APPROVED",
    reasons: [
      reason("FREEZE", true, "NOT_FROZEN", "The system is not frozen."),
      reason("ALLOWLIST", true, "RECIPIENT_ALLOWED", "Recipient acme-corp is on the allowlist."),
      reason("PER_TX_CAP", true, "WITHIN_PER_TX_CAP", "$100.00 is within the $500.00 per-transaction cap."),
      reason("DAILY_CAP", true, "WITHIN_DAILY_CAP", "$100.00 keeps the daily total within the $1,000.00 cap."),
    ],
    ...overrides,
  };
}

export function blockedProposal(overrides: Partial<ProposalResponse> = {}): ProposalResponse {
  return {
    proposalId: "01K9BLOCKED000000000002",
    replayed: false,
    outcome: "REJECTED",
    status: "BLOCKED",
    reason: "RECIPIENT_NOT_ALLOWED",
    reasons: [
      reason("FREEZE", true, "NOT_FROZEN", "The system is not frozen."),
      reason("ALLOWLIST", false, "RECIPIENT_NOT_ALLOWED", "Recipient evil.com (real) is not on the allowlist."),
      reason("PER_TX_CAP", false, "PER_TX_CAP_EXCEEDED", "$5,000.00 exceeds the $500.00 per-transaction cap."),
      reason("DAILY_CAP", true, "WITHIN_DAILY_CAP", "$5,000.00 keeps the daily total within the $1,000.00 cap."),
    ],
    ...overrides,
  };
}

export function invalidProposal(overrides: Partial<ProposalResponse> = {}): ProposalResponse {
  return {
    proposalId: "01K9INVALID000000000003",
    replayed: false,
    outcome: "REJECTED",
    status: "BLOCKED",
    reason: "INVALID_PROPOSAL",
    reasons: [],
    ...overrides,
  };
}

export function proposalBundle(overrides: Partial<ProposalBundle["proposal"]> = {}): ProposalBundle {
  return {
    proposal: {
      id: "01K9APPROVED000000000001",
      amountCents: 10_000,
      currency: "USD",
      memo: "Office supplies",
      recipientKey: "acme-corp",
      label: "Acme Corp",
      status: "EXECUTED",
      createdAt: "2026-11-13T12:00:00.000Z",
      ...overrides,
    },
    decision: {
      outcome: "APPROVED",
      reason: "APPROVED",
      reasons: approvedProposal().reasons,
      snapshot: null,
    },
    payment: {
      id: "pay-1",
      amountCents: 10_000,
      recipientKey: "acme-corp",
      executedAt: "2026-11-13T12:00:01.000Z",
    },
    auditEntries: [],
  };
}

export function auditEntry(seq: number, overrides: Partial<AuditEntryView> = {}): AuditEntryView {
  return {
    seq,
    type: "PROPOSAL_RECEIVED",
    ts: "2026-11-13T12:00:00.000Z",
    actor: "agent:scripted",
    proposalId: "01K9APPROVED000000000001",
    payload: { recipient: "acme-corp", amountCents: 10_000 },
    prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
    hash: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
    ...overrides,
  };
}

export function makeMockClient(overrides: Partial<FrankenguardApi> = {}): FrankenguardApi {
  const defaults: FrankenguardApi = {
    createSandbox: async () => ({ sandboxId: "sandbox-1" }),
    resetSandbox: async () => ({ sandboxId: "sandbox-2" }),
    getState: async () => baseState(),
    submitProposal: async () => approvedProposal(),
    getProposal: async () => proposalBundle(),
    updateCaps: async (body) => ({ configVersion: 2, ...body }),
    addRecipient: async (body) => ({ recipientKey: body.recipient, label: body.label ?? body.recipient }),
    removeRecipient: async (body) => ({ recipientKey: body.recipient }),
    setFrozen: async (body) => ({ configVersion: 2, frozen: body.frozen }),
    listAudit: async () => ({ entries: [], nextAfterSeq: null }),
    verifyAudit: async () => ({ ok: true, entries: 1, headHash: "aabbccddeeff00112233445566778899" }),
    runAgent: async () => ({ agentMode: "scripted", proposals: [approvedProposal()] }),
  };
  const merged = { ...defaults, ...overrides };
  return Object.fromEntries(
    Object.entries(merged).map(([key, fn]) => [key, vi.fn(fn as (...args: never[]) => unknown)]),
  ) as unknown as FrankenguardApi;
}

export function renderWithClient(ui: ReactNode, client: FrankenguardApi) {
  return render(<StoreProvider client={client}>{ui}</StoreProvider>);
}
