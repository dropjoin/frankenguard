import { describe, expect, it } from "vitest";

import { createLiveAgent, LiveAgentError } from "../../src/agents/live.js";

function completionResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const VALID_CONTENT = JSON.stringify({
  proposals: [{ recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "pay acme" }],
});

describe("live agent", () => {
  it("returns validated proposals from one provider call", async () => {
    let calls = 0;
    let seenUrl = "";
    let seenBody: Record<string, unknown> = {};
    const agent = createLiveAgent({
      apiKey: "test-key",
      model: "test-model",
      baseUrl: "https://provider.example/v1",
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        calls += 1;
        seenUrl = String(url);
        seenBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return completionResponse(VALID_CONTENT);
      }) as typeof fetch,
    });
    const proposals = await agent.run("pay acme $100");
    expect(calls).toBe(1);
    expect(seenUrl).toBe("https://provider.example/v1/chat/completions");
    expect(proposals).toEqual([
      { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "pay acme" },
    ]);
    // The model is told nothing about caps, spend, or verdicts.
    const bodyText = JSON.stringify(seenBody);
    expect(bodyText).not.toContain("50000");
    expect(bodyText).not.toContain("100000");
    expect(bodyText).not.toContain("APPROVED");
  });

  it("throws LiveAgentError on an HTTP error", async () => {
    const agent = createLiveAgent({
      apiKey: "k",
      model: "m",
      baseUrl: "https://provider.example/v1",
      fetchImpl: (async () => new Response("nope", { status: 401 })) as typeof fetch,
    });
    await expect(agent.run("pay")).rejects.toThrow(LiveAgentError);
  });

  it("throws LiveAgentError when the content is not JSON", async () => {
    const agent = createLiveAgent({
      apiKey: "k",
      model: "m",
      baseUrl: "https://provider.example/v1",
      fetchImpl: (async () => completionResponse("sure, paying now!")) as typeof fetch,
    });
    await expect(agent.run("pay")).rejects.toThrow(LiveAgentError);
  });

  it("throws LiveAgentError when proposals fail schema validation", async () => {
    const bad = JSON.stringify({
      proposals: [
        { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "a" },
        { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "b" },
        { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "c" },
        { recipient: "acme-corp", amountCents: 10_000, currency: "USD", memo: "d" },
      ],
    });
    const agent = createLiveAgent({
      apiKey: "k",
      model: "m",
      baseUrl: "https://provider.example/v1",
      fetchImpl: (async () => completionResponse(bad)) as typeof fetch,
    });
    await expect(agent.run("pay")).rejects.toThrow(LiveAgentError);
  });

  it("throws LiveAgentError when the provider returns no message content", async () => {
    const agent = createLiveAgent({
      apiKey: "k",
      model: "m",
      baseUrl: "https://provider.example/v1",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ choices: [] }), { headers: { "content-type": "application/json" } })) as typeof fetch,
    });
    await expect(agent.run("pay")).rejects.toThrow(LiveAgentError);
  });

  it("throws LiveAgentError on timeout", async () => {
    const agent = createLiveAgent({
      apiKey: "k",
      model: "m",
      baseUrl: "https://provider.example/v1",
      timeoutMs: 20,
      fetchImpl: ((async (_url: unknown, init?: { signal?: AbortSignal }) => {
        await new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
        throw new Error("unreachable");
      }) as unknown) as typeof fetch,
    });
    await expect(agent.run("pay")).rejects.toThrow(/timed out/);
  });
});
