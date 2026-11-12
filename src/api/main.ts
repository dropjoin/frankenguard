import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createLiveAgent } from "../agents/live.js";
import { openDb } from "../db/migrate.js";
import { sweepExpired } from "../services/sandbox.js";
import { SystemClock } from "../shared/clock.js";
import { readEnv } from "./env.js";
import { buildApp } from "./server.js";

// Server entrypoint. Configuration lives in env.ts; the live agent
// is off unless AGENT_PROVIDER=live AND a key is present.

export function startSweeper(
  db: ReturnType<typeof openDb>,
  clock: SystemClock,
  intervalMs = 60_000,
): () => void {
  const timer = setInterval(() => {
    try {
      sweepExpired(db, clock);
    } catch (error) {
      console.error("sandbox sweep failed:", error);
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

async function main(): Promise<void> {
  const env = readEnv();
  mkdirSync(dirname(env.dbPath), { recursive: true });
  const db = openDb(env.dbPath);
  const clock = new SystemClock();
  const liveAgent =
    env.agentMode === "live" && env.agentApiKey
      ? createLiveAgent({ apiKey: env.agentApiKey, model: env.agentModel, baseUrl: env.agentBaseUrl })
      : undefined;
  const app = buildApp({
    db,
    clock,
    agentMode: env.agentMode,
    liveAgent,
    trustProxy: env.trustProxy,
    cookieSecure: env.cookieSecure,
    webRoot: env.webRoot,
    tamperDemo: env.tamperDemo,
  });
  const stopSweeper = startSweeper(db, clock);
  const shutdown = async (signal: string) => {
    console.log(`received ${signal}, shutting down`);
    stopSweeper();
    await app.close();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  await app.listen({ port: env.port, host: env.host });
  console.log(`FrankenGuard listening on http://${env.host}:${env.port} (agent: ${env.agentMode})`);
}

await main();
