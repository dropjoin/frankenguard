#!/usr/bin/env node
/* Frankenguard MCP server: stdio JSON-RPC 2.0, stdlib only.
 * Exposes the exact rule engine the browser runs, so a Kiro agent can
 * evaluate proposals, read the policy, and verify audit chains without
 * reimplementing anything. No network, no secrets, no side effects.
 */
"use strict";

const readline = require("node:readline");
const { createHash } = require("node:crypto");
const engine = require("../../src/engine.js");
const ledger = require("../../src/ledger.js");

const sha256 = (s) => Promise.resolve(createHash("sha256").update(s, "utf8").digest("hex"));

const TOOLS = [
  {
    name: "evaluate_proposal",
    description:
      "Evaluate a payment proposal against the Frankenguard policy. Returns the verdict, reason code, and the full six-gate trace. Deterministic: same inputs always yield the same verdict.",
    inputSchema: {
      type: "object",
      properties: {
        payee: { type: ["string", "null"], description: "Recipient name, or null when unresolved." },
        cents: { type: "number", description: "Amount in integer minor units (cents)." },
        currency: { type: "string", description: "Currency code, e.g. USD." },
        memo: { type: "string", description: "Full instruction text, scanned by the memo guardrail." },
        ref: { type: ["string", "null"], description: "Invoice reference, if any." },
        txCapCents: { type: "number", description: "Per-transaction cap in cents. Default 25000." },
        dailyCapCents: { type: "number", description: "Daily cap in cents. Default 50000." },
        allowlist: { type: "array", items: { type: "string" }, description: "Allowed recipients." },
        frozen: { type: "boolean", description: "Freeze switch. Default false." },
        spentTodayCents: { type: "number", description: "Accepted spend so far this UTC day. Default 0." },
      },
      required: ["payee", "cents", "currency", "memo"],
    },
  },
  {
    name: "get_policy",
    description: "Return the default Frankenguard policy, gate order, and reason codes.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "audit_tail",
    description:
      "Take a caller-supplied ledger chain, verify its hashes, and return the last N entries plus the verification result.",
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", description: "Ledger entries to verify." },
        n: { type: "number", description: "How many trailing entries to return. Default 5." },
      },
      required: ["entries"],
    },
  },
];

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

async function callTool(name, args) {
  const a = args && typeof args === "object" ? args : {};
  if (name === "evaluate_proposal") {
    const policy = engine.defaultPolicy();
    if (Number.isSafeInteger(a.txCapCents)) policy.txCapCents = a.txCapCents;
    if (Number.isSafeInteger(a.dailyCapCents)) policy.dailyCapCents = a.dailyCapCents;
    if (Array.isArray(a.allowlist)) policy.allowlist = a.allowlist;
    if (typeof a.frozen === "boolean") policy.frozen = a.frozen;
    const spent = Number.isSafeInteger(a.spentTodayCents) ? a.spentTodayCents : 0;
    const verdict = engine.evaluate(
      { payee: a.payee, cents: a.cents, currency: a.currency, memo: a.memo, ref: a.ref ?? null },
      policy,
      spent
    );
    return textResult(verdict);
  }
  if (name === "get_policy") {
    return textResult({
      policy: engine.defaultPolicy(),
      gateOrder: ["freeze", "amount", "tx_cap", "daily_cap", "allowlist", "memo"],
      reasonCodes: Object.values(engine.REASONS),
      sanityCeilingCents: engine.SANITY_CEILING_CENTS,
    });
  }
  if (name === "audit_tail") {
    const entries = Array.isArray(a.entries) ? a.entries : [];
    const n = Number.isSafeInteger(a.n) && a.n > 0 ? a.n : 5;
    const verification = await ledger.verifyChain(entries, sha256);
    return textResult({ tail: entries.slice(-n), verification: verification });
  }
  throw Object.assign(new Error("unknown tool: " + name), { code: -32602 });
}

async function handle(message) {
  if (!message || typeof message !== "object" || message.jsonrpc !== "2.0") {
    return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid Request" } };
  }
  const isNotification = message.id === undefined;
  try {
    let result = null;
    if (message.method === "initialize") {
      result = {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "frankenguard", version: "1.0.0" },
      };
    } else if (message.method === "tools/list") {
      result = { tools: TOOLS };
    } else if (message.method === "tools/call") {
      const params = message.params || {};
      result = await callTool(params.name, params.arguments || {});
    } else if (message.method === "ping") {
      result = {};
    } else if (typeof message.method === "string" && message.method.startsWith("notifications/")) {
      return null; // notifications get no response
    } else {
      throw Object.assign(new Error("method not found: " + message.method), { code: -32601 });
    }
    if (isNotification) return null;
    return { jsonrpc: "2.0", id: message.id, result: result };
  } catch (err) {
    if (isNotification) return null;
    return {
      jsonrpc: "2.0",
      id: message.id,
      error: { code: err.code || -32603, message: String(err.message || err) },
    };
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (trimmed === "") return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    process.stdout.write(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }) + "\n"
    );
    return;
  }
  const response = await handle(message);
  if (response) process.stdout.write(JSON.stringify(response) + "\n");
});
