import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";

import type Database from "better-sqlite3";

import { runAgent } from "../agents/run.js";
import type { LiveAgent } from "../agents/live.js";
import { createRepositories } from "../db/repositories.js";
import { utcDayWindow } from "../engine/window.js";
import { verifyChain } from "../services/audit/chain.js";
import { getProposalBundle, listAudit } from "../services/audit/queries.js";
import { addRecipient, getCaps, removeRecipient, setFrozen, updateCaps } from "../services/config.js";
import { submitProposal, toProposalResponse } from "../services/proposals.js";
import {
  ABSOLUTE_TTL_MS,
  createSandbox,
  resetSandbox,
  touchSandbox,
} from "../services/sandbox.js";
import type { Clock } from "../shared/clock.js";
import {
  DomainError,
  RateLimitedError,
  SandboxExpiredError,
} from "../shared/errors.js";
import { auditQuerySchema, type StateResponse } from "../shared/types.js";
import { createLimiters, type Limiters } from "./rateLimit.js";
import { parseQuery, requireObjectBody, toErrorEnvelope } from "./schemas.js";

// The Fastify application: one factory, no globals. Every route is
// listed here; the services decide, the routes translate. Error
// handling is centralized: domain errors map to the design 6.4
// table, framework errors map to the envelope, and anything else is
// a 500 that never leaks internals.

declare module "fastify" {
  interface FastifyRequest {
    sandboxId: string;
  }
}

export const SANDBOX_COOKIE = "fg_sandbox";
const BODY_LIMIT_BYTES = 8 * 1024;
const RECENT_PROPOSALS = 10;

export interface AppOptions {
  db: Database.Database;
  clock: Clock;
  agentMode: "scripted" | "live";
  liveAgent?: LiveAgent;
  trustProxy?: boolean;
  /** Secure flag on the sandbox cookie. On in production, off for local HTTP. */
  cookieSecure?: boolean;
  limiters?: Limiters;
}

function cookieOptions(secure: boolean) {
  return {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: Math.floor(ABSOLUTE_TTL_MS / 1000),
  };
}

export function buildApp(options: AppOptions): FastifyInstance {
  const { db, clock } = options;
  const limiters = options.limiters ?? createLimiters();
  const app = Fastify({ bodyLimit: BODY_LIMIT_BYTES, trustProxy: options.trustProxy ?? false });

  void app.register(cookie);

  app.addHook("onRequest", async (request, reply) => {
    reply.header("content-security-policy", "default-src 'self'");
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-frame-options", "DENY");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    if (request.url.startsWith("/api/")) {
      const verdict = limiters.perIp.take(request.ip, clock.now().getTime());
      if (!verdict.allowed) throw new RateLimitedError(verdict.retryAfterSeconds);
    }
  });

  function checkWrite(request: FastifyRequest): void {
    const verdict = limiters.perSandboxWrite.take(request.sandboxId, clock.now().getTime());
    if (!verdict.allowed) throw new RateLimitedError(verdict.retryAfterSeconds);
  }

  function checkRead(request: FastifyRequest): void {
    const verdict = limiters.perSandboxRead.take(request.sandboxId, clock.now().getTime());
    if (!verdict.allowed) throw new RateLimitedError(verdict.retryAfterSeconds);
  }

  async function requireSandbox(request: FastifyRequest): Promise<void> {
    const id = request.cookies[SANDBOX_COOKIE];
    if (!id) throw new SandboxExpiredError();
    const sandbox = touchSandbox(db, clock, id);
    if (!sandbox) throw new SandboxExpiredError();
    request.sandboxId = sandbox.id;
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof RateLimitedError) {
      reply.header("retry-after", String(error.retryAfterSeconds));
      return reply.status(error.status).send(toErrorEnvelope(error.code, error.message));
    }
    if (error instanceof DomainError) {
      return reply.status(error.status).send(toErrorEnvelope(error.code, error.message));
    }
    const fastifyError = error as { code?: string; statusCode?: number; message?: string };
    if (fastifyError.code === "FST_ERR_CTP_INVALID_JSON_BODY") {
      return reply.status(422).send(toErrorEnvelope("INVALID_INPUT", "request body is not valid JSON"));
    }
    if (fastifyError.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.status(413).send(toErrorEnvelope("PAYLOAD_TOO_LARGE", "request body exceeds 8 KB"));
    }
    if (typeof fastifyError.statusCode === "number" && fastifyError.statusCode < 500) {
      return reply
        .status(fastifyError.statusCode)
        .send(toErrorEnvelope("INVALID_INPUT", fastifyError.message ?? "invalid request"));
    }
    request.log.error(error);
    return reply.status(500).send(toErrorEnvelope("INTERNAL_ERROR", "internal error"));
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send(toErrorEnvelope("NOT_FOUND", "route was not found"));
  });

  app.get("/healthz", async (_request, reply) => {
    return reply.send({ status: "ok" });
  });

  app.post("/api/sandbox", async (request, reply) => {
    const existingId = request.cookies[SANDBOX_COOKIE];
    if (existingId) {
      const existing = touchSandbox(db, clock, existingId);
      if (existing) return reply.send({ sandboxId: existing.id });
    }
    const creation = limiters.sandboxCreation.take(request.ip, clock.now().getTime());
    if (!creation.allowed) throw new RateLimitedError(creation.retryAfterSeconds);
    const sandbox = createSandbox(db, clock);
    return reply
      .status(201)
      .setCookie(SANDBOX_COOKIE, sandbox.id, cookieOptions(options.cookieSecure ?? false))
      .send({ sandboxId: sandbox.id });
  });

  app.post("/api/sandbox/reset", { preHandler: requireSandbox }, async (request, reply) => {
    const sandbox = resetSandbox(db, clock, request.sandboxId);
    return reply
      .setCookie(SANDBOX_COOKIE, sandbox.id, cookieOptions(options.cookieSecure ?? false))
      .send({ sandboxId: sandbox.id });
  });

  app.get("/api/state", { preHandler: requireSandbox }, async (request, reply) => {
    checkRead(request);
    const repos = createRepositories(db);
    const caps = getCaps(db, request.sandboxId);
    const allowlist = repos.allowlist.listBySandbox(request.sandboxId);
    const window = utcDayWindow(clock.now().getTime());
    const windowStart = new Date(window.startMs).toISOString();
    const windowEnd = new Date(window.endMs).toISOString();
    const dailySpentCents = repos.payments.sumForWindow(request.sandboxId, windowStart, windowEnd);
    const recentRows = repos.proposals.listRecent(request.sandboxId, RECENT_PROPOSALS);
    const recentProposals = recentRows.map((row) =>
      toProposalResponse(row, repos.decisions.getByProposalId(row.id), false),
    );
    const state: StateResponse = {
      sandboxId: request.sandboxId,
      configVersion: caps.configVersion,
      perTxCapCents: caps.perTxCapCents,
      dailyCapCents: caps.dailyCapCents,
      frozen: caps.frozen,
      allowlist: allowlist.map((row) => ({ key: row.recipient_key, label: row.label })),
      dailySpentCents,
      dailyRemainingCents: Math.max(0, caps.dailyCapCents - dailySpentCents),
      windowStart,
      windowEnd,
      proposalCount: repos.proposals.countBySandbox(request.sandboxId),
      paymentCount: repos.payments.countBySandbox(request.sandboxId),
      paymentTotalCents: repos.payments.totalBySandbox(request.sandboxId),
      recentProposals,
      agentMode: options.agentMode,
      auditHead: repos.audit.headBySandbox(request.sandboxId),
    };
    return reply.send(state);
  });

  app.post("/api/proposals", { preHandler: requireSandbox }, async (request, reply) => {
    checkWrite(request);
    const body = requireObjectBody(request.body);
    const result = submitProposal(db, clock, request.sandboxId, body, "operator:manual");
    return reply.send(result);
  });

  app.get<{ Params: { id: string } }>("/api/proposals/:id", { preHandler: requireSandbox }, async (request, reply) => {
    checkRead(request);
    return reply.send(getProposalBundle(db, request.sandboxId, request.params.id));
  });

  app.put("/api/config/caps", { preHandler: requireSandbox }, async (request, reply) => {
    checkWrite(request);
    const body = requireObjectBody(request.body);
    return reply.send(updateCaps(db, clock, request.sandboxId, body, "operator"));
  });

  app.post("/api/config/allowlist", { preHandler: requireSandbox }, async (request, reply) => {
    checkWrite(request);
    const body = requireObjectBody(request.body);
    return reply.send(addRecipient(db, clock, request.sandboxId, body, "operator"));
  });

  app.delete("/api/config/allowlist", { preHandler: requireSandbox }, async (request, reply) => {
    checkWrite(request);
    const body = requireObjectBody(request.body);
    return reply.send(removeRecipient(db, clock, request.sandboxId, body, "operator"));
  });

  app.put("/api/config/freeze", { preHandler: requireSandbox }, async (request, reply) => {
    checkWrite(request);
    const body = requireObjectBody(request.body);
    return reply.send(setFrozen(db, clock, request.sandboxId, body, "operator"));
  });

  app.get("/api/audit", { preHandler: requireSandbox }, async (request, reply) => {
    checkRead(request);
    const query = parseQuery(auditQuerySchema, request.query);
    return reply.send(listAudit(db, request.sandboxId, query));
  });

  app.get("/api/audit/verify", { preHandler: requireSandbox }, async (request, reply) => {
    checkRead(request);
    const result = verifyChain(db, request.sandboxId);
    return reply.send(result);
  });

  app.post("/api/agent/run", { preHandler: requireSandbox }, async (request, reply) => {
    checkWrite(request);
    const body = requireObjectBody(request.body);
    // The live bucket gates only prompt runs while the live agent is
    // enabled; scenario runs always use the normal write bucket, or
    // demo clicking would throttle at 6 runs a minute.
    if (
      options.agentMode === "live" &&
      typeof body.prompt === "string" &&
      typeof body.scenario !== "string"
    ) {
      const verdict = limiters.liveAgent.take(request.sandboxId, clock.now().getTime());
      if (!verdict.allowed) throw new RateLimitedError(verdict.retryAfterSeconds);
    }
    const result = await runAgent(db, clock, request.sandboxId, body, {
      agentMode: options.agentMode,
      liveAgent: options.liveAgent,
    });
    return reply.send(result);
  });

  return app;
}
