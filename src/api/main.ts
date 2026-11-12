import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createLiveAgent } from "../agents/live.js";
import { openDb } from "../db/migrate.js";
import { sweepExpired } from "../services/sandbox.js";
import { SystemClock } from "../shared/clock.js";
import { buildApp } from "./server.js";

// Server entrypoint. Configuration is environment variables, all with
// safe defaults for local development. The live agent is off unless
// AGENT_PROVIDER=live AND a key is present; asking for live without a
// key fails startup loudly instead of running half-configured.

function readEnv(): {
  port: number;
  host: string;
  dbPath: string;
  trustProxy: boolean;
  cookieSecure: boolean;
  agentMode: "scripted" | "live";
  agentApiKey: string | undefined;
  agentModel: string;
  agentBaseUrl: string;
} {
  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer 1-65535, got ${process.env.PORT ?? "3000"}`);
  }
  const provider = process.env.AGENT_PROVIDER ?? "scripted";
  if (provider !== "scripted" && provider !== "live") {
    throw new Error(`AGENT_PROVIDER must be "scripted" or "live", got ${JSON.stringify(provider)}`);
  }
  const agentApiKey = process.env.AGENT_API_KEY;
  if (provider === "live" && !agentApiKey) {
    throw new Error("AGENT_PROVIDER=live requires AGENT_API_KEY");
  }
  return {
    port,
    host: process.env.HOST ?? "0.0.0.0",
    dbPath: process.env.DB_PATH ?? "./data/frankenguard.db",
    trustProxy: process.env.TRUST_PROXY === "true",
    cookieSecure: process.env.NODE_ENV === "production",
    agentMode: provider,
    agentApiKey,
    agentModel: process.env.AGENT_MODEL ?? "gpt-4o-mini",
    agentBaseUrl: process.env.AGENT_BASE_URL ?? "https://api.openai.com/v1",
  };
}

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
