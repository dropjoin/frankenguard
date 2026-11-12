import type { FastifyInstance, InjectOptions } from "fastify";

import { openDb } from "../../src/db/migrate.js";
import { buildApp, SANDBOX_COOKIE } from "../../src/api/server.js";
import { FakeClock } from "../../src/shared/clock.js";

export async function makeApp(options: { cookieSecure?: boolean } = {}): Promise<{
  db: ReturnType<typeof openDb>;
  clock: FakeClock;
  app: FastifyInstance;
}> {
  const db = openDb(":memory:");
  const clock = new FakeClock("2026-11-13T12:00:00.000Z");
  const app = buildApp({ db, clock, agentMode: "scripted", cookieSecure: options.cookieSecure });
  await app.ready();
  return { db, clock, app };
}

export function cookieFromResponse(res: { headers: Record<string, unknown> }): string | undefined {
  const raw = res.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (typeof header !== "string") return undefined;
  return /fg_sandbox=([^;]+)/.exec(header)?.[1];
}

export async function newSandbox(app: FastifyInstance): Promise<{ cookie: string; sandboxId: string }> {
  const res = await app.inject({ method: "POST", url: "/api/sandbox" });
  if (res.statusCode !== 201) throw new Error(`sandbox creation failed: ${res.statusCode} ${res.body}`);
  const cookie = cookieFromResponse(res);
  if (!cookie) throw new Error("sandbox creation set no cookie");
  const body = res.json() as { sandboxId: string };
  return { cookie, sandboxId: body.sandboxId };
}

export function withCookie(cookie: string, opts: InjectOptions): InjectOptions {
  return { ...opts, cookies: { [SANDBOX_COOKIE]: cookie } };
}
