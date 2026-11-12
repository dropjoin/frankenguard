import type { AgentMode, AgentRunResult } from "../../agents/types.js";
import {
  agentRunSchema,
  allowlistAddSchema,
  allowlistRemoveSchema,
  auditQuerySchema,
  capsSchema,
  freezeSchema,
  type AuditEntryView,
  type AuditQuery,
  type ProposalBundle,
  type ProposalResponse,
  type StateResponse,
  type VerifyResponse,
} from "../../shared/types.js";

// Typed API client. Request bodies are validated client-side with the
// shared Zod schemas before they are sent, so a typo'd cap never
// makes a round trip; responses are typed from the shared response
// shapes. The server is the authority on every verdict: this client
// never evaluates, it only carries proposals and renders answers.
//
// Errors: a 401 means the sandbox is gone (expired or swept) and
// surfaces as SandboxExpiredError so the store can offer a fresh
// sandbox. Every other error carries the server's code and message.

export class SandboxExpiredError extends Error {
  constructor() {
    super("sandbox session is missing or expired");
    this.name = "SandboxExpiredError";
  }
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  /** Seconds to wait before retrying, from the Retry-After header; null when the server sent none. */
  readonly retryAfterSeconds: number | null;

  constructor(code: string, status: number, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401) throw new SandboxExpiredError();
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const envelope = body as ErrorBody | null;
    const code = typeof envelope?.error?.code === "string" ? envelope.error.code : "UNKNOWN";
    const message = typeof envelope?.error?.message === "string" ? envelope.error.message : `request failed (${res.status})`;
    const retryAfter = res.headers.get("retry-after");
    const parsed = retryAfter === null ? Number.NaN : Number.parseInt(retryAfter, 10);
    throw new ApiError(code, res.status, message, Number.isInteger(parsed) && parsed > 0 ? parsed : null);
  }
  return body as T;
}

function post<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, { body: JSON.stringify(payload), method: "POST" });
}

function put<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, { body: JSON.stringify(payload), method: "PUT" });
}

function del<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, { body: JSON.stringify(payload), method: "DELETE" });
}

function invalidInput(issues: { path: (string | number)[]; message: string }[]): ApiError {
  const first = issues[0];
  return new ApiError("INVALID_INPUT", 422, first ? `${String(first.path[0] ?? "input")}: ${first.message}` : "invalid input");
}

export interface FrankenguardApi {
  createSandbox(): Promise<{ sandboxId: string }>;
  resetSandbox(): Promise<{ sandboxId: string }>;
  getState(): Promise<StateResponse>;
  submitProposal(body: { recipient: string; amountCents: number; currency: string; memo: string }): Promise<ProposalResponse>;
  getProposal(id: string): Promise<ProposalBundle>;
  updateCaps(body: { perTxCapCents: number; dailyCapCents: number }): Promise<{
    configVersion: number;
    perTxCapCents: number;
    dailyCapCents: number;
  }>;
  addRecipient(body: { recipient: string; label?: string }): Promise<{ recipientKey: string; label: string }>;
  removeRecipient(body: { recipient: string }): Promise<{ recipientKey: string }>;
  setFrozen(body: { frozen: boolean; note?: string }): Promise<{ configVersion: number; frozen: boolean }>;
  listAudit(query: AuditQuery): Promise<{ entries: AuditEntryView[]; nextAfterSeq: number | null }>;
  verifyAudit(): Promise<VerifyResponse>;
  runAgent(body: { scenario?: string; prompt?: string }): Promise<AgentRunResult>;
}

export const api: FrankenguardApi = {
  createSandbox: () => post("/api/sandbox", {}),
  resetSandbox: () => post("/api/sandbox/reset", {}),
  getState: () => request("/api/state"),
  submitProposal: (body) => post("/api/proposals", body),
  getProposal: (id) => request(`/api/proposals/${encodeURIComponent(id)}`),
  updateCaps: (body) => {
    const parsed = capsSchema.safeParse(body);
    if (!parsed.success) throw invalidInput(parsed.error.issues);
    return put("/api/config/caps", parsed.data);
  },
  addRecipient: (body) => {
    const parsed = allowlistAddSchema.safeParse(body);
    if (!parsed.success) throw invalidInput(parsed.error.issues);
    return post("/api/config/allowlist", parsed.data);
  },
  removeRecipient: (body) => {
    const parsed = allowlistRemoveSchema.safeParse(body);
    if (!parsed.success) throw invalidInput(parsed.error.issues);
    return del("/api/config/allowlist", parsed.data);
  },
  setFrozen: (body) => {
    const parsed = freezeSchema.safeParse(body);
    if (!parsed.success) throw invalidInput(parsed.error.issues);
    return put("/api/config/freeze", parsed.data);
  },
  listAudit: (query) => {
    const parsed = auditQuerySchema.safeParse(query);
    if (!parsed.success) throw invalidInput(parsed.error.issues);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const suffix = params.toString();
    return request(`/api/audit${suffix ? `?${suffix}` : ""}`);
  },
  verifyAudit: () => request("/api/audit/verify"),
  runAgent: (body) => {
    const parsed = agentRunSchema.safeParse(body);
    if (!parsed.success) throw invalidInput(parsed.error.issues);
    return post("/api/agent/run", parsed.data);
  },
};

export type { AgentMode };
