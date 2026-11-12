import type { z } from "zod";

import { InvalidInputError } from "../shared/errors.js";

// Request parsing for routes: query validation through the shared
// Zod schemas, body shape checks, and the error envelope. Route
// handlers do NOT use Fastify's JSON-schema validation for bodies:
// a malformed proposal body must reach ProposalService and be
// recorded as INVALID_PROPOSAL with a 200, not rejected by the
// framework with a 400. Only a non-object body is refused here
// (422 INVALID_INPUT), because there is no proposal to record.

export interface ErrorEnvelope {
  error: { code: string; message: string };
}

export function toErrorEnvelope(code: string, message: string): ErrorEnvelope {
  return { error: { code, message } };
}

export function parseQuery<T>(schema: z.ZodType<T>, query: unknown): T {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new InvalidInputError(first ? `${String(first.path[0] ?? "query")}: ${first.message}` : "invalid query");
  }
  return parsed.data;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/** Refuse a non-object JSON body with 422. Object bodies pass through for the service to judge. */
export function requireObjectBody(body: unknown): Record<string, unknown> {
  if (!isPlainObject(body)) throw new InvalidInputError("request body must be a JSON object");
  return body;
}
