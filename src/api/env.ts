import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Server configuration from environment variables, all with safe
// defaults for local development. Kept out of main.ts so the parsing
// is unit-testable without booting a server. The live agent is off
// unless AGENT_PROVIDER=live AND a key is present; asking for live
// without a key fails startup loudly instead of running
// half-configured.

export interface ServerEnv {
  port: number;
  host: string;
  dbPath: string;
  trustProxy: boolean;
  cookieSecure: boolean;
  agentMode: "scripted" | "live";
  agentApiKey: string | undefined;
  agentModel: string;
  agentBaseUrl: string;
  webRoot: string | undefined;
  tamperDemo: boolean;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const port = Number(source.PORT ?? "3000");
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer 1-65535, got ${source.PORT ?? "3000"}`);
  }
  const provider = source.AGENT_PROVIDER ?? "scripted";
  if (provider !== "scripted" && provider !== "live") {
    throw new Error(`AGENT_PROVIDER must be "scripted" or "live", got ${JSON.stringify(provider)}`);
  }
  const agentApiKey = source.AGENT_API_KEY;
  if (provider === "live" && !agentApiKey) {
    throw new Error("AGENT_PROVIDER=live requires AGENT_API_KEY");
  }
  // The built SPA lives next to the built server (dist/web). A
  // missing web root fails startup in production, where the demo
  // must serve the page; in development the Vite dev server owns
  // the SPA, so the API runs alone with a warning.
  const production = source.NODE_ENV === "production";
  const webRoot = source.WEB_ROOT ?? fileURLToPath(new URL("../../web", import.meta.url));
  if (!existsSync(webRoot)) {
    if (production) {
      throw new Error(`web root not found at ${webRoot}; run npm run build first`);
    }
    console.warn(`web root not found at ${webRoot}; serving the API only`);
  }
  return {
    port,
    host: source.HOST ?? "0.0.0.0",
    dbPath: source.DB_PATH ?? "./data/frankenguard.db",
    trustProxy: source.TRUST_PROXY === "1" || source.TRUST_PROXY === "true",
    cookieSecure: production,
    agentMode: provider,
    agentApiKey,
    agentModel: source.AGENT_MODEL ?? "gpt-4o-mini",
    agentBaseUrl: source.AGENT_BASE_URL ?? "https://api.openai.com/v1",
    webRoot: existsSync(webRoot) ? webRoot : undefined,
    tamperDemo: source.TAMPER_DEMO === "1",
  };
}
