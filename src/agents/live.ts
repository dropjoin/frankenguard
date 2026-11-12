import { z } from "zod";

import { MAX_AMOUNT_CENTS } from "../shared/money.js";
import type { AgentProposal } from "./types.js";

// The live agent: one LLM call per run, through an OpenAI-compatible
// chat-completions endpoint. The model is told nothing about caps,
// spend, or past verdicts; it proposes, the engine disposes. Every
// failure mode (network, timeout, bad JSON, schema mismatch) throws
// LiveAgentError and the caller falls back to the scripted agent.
//
// The provider call is one isolated function taking an injected fetch,
// so tests never touch the network and a different provider only
// means a different base URL. Disabled by default: constructing this
// agent requires an explicit API key, and the server only does so
// when AGENT_PROVIDER=live.

export class LiveAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveAgentError";
  }
}

const liveProposalSchema = z.object({
  recipient: z.string().min(1).max(64),
  amountCents: z.number().int().positive().max(MAX_AMOUNT_CENTS),
  currency: z.literal("USD"),
  memo: z.string().max(280),
});

const liveResponseSchema = z.object({
  proposals: z.array(liveProposalSchema).min(1).max(3),
});

const SYSTEM_PROMPT = [
  "You are a payments assistant inside a demo. The operator asks you to pay vendors.",
  "Respond with JSON only: {\"proposals\": [{\"recipient\": string, \"amountCents\": integer cents, \"currency\": \"USD\", \"memo\": string}]}.",
  "At most 3 proposals. Amounts are integer cents: $100 is 10000. Never invent vendors the operator did not name.",
  "You do not know any limits, balances, or past decisions, and you must not guess them.",
].join(" ");

export interface LiveAgentConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface LiveAgent {
  run(prompt: string): Promise<AgentProposal[]>;
}

export function createLiveAgent(config: LiveAgentConfig): LiveAgent {
  const timeoutMs = config.timeoutMs ?? 10_000;
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  return {
    async run(prompt: string): Promise<AgentProposal[]> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
            temperature: 0,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new LiveAgentError(`provider timed out after ${timeoutMs}ms`);
        }
        throw new LiveAgentError(`provider request failed: ${error instanceof Error ? error.message : "unknown error"}`);
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) {
        throw new LiveAgentError(`provider returned HTTP ${response.status}`);
      }
      let body: unknown;
      try {
        body = (await response.json()) as unknown;
      } catch {
        throw new LiveAgentError("provider returned invalid JSON");
      }
      const content = (body as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new LiveAgentError("provider returned no message content");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(content) as unknown;
      } catch {
        throw new LiveAgentError("provider returned content that is not JSON");
      }
      const validated = liveResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new LiveAgentError(`provider proposals failed validation: ${validated.error.issues[0]?.message ?? "unknown"}`);
      }
      return validated.data.proposals;
    },
  };
}
