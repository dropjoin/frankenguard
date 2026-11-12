import { MAX_AMOUNT_CENTS } from "../shared/money.js";
import type { ValidProposal } from "../shared/types.js";

// Shape validation for proposals. This runs before any rule sees the
// proposal: a malformed proposal is recorded as INVALID_PROPOSAL and
// never evaluated (R1.3). Every failure names the field and the rule
// it broke, so the caller can say exactly what was wrong.

export interface FieldError {
  field: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; proposal: ValidProposal; idempotencyKey: string | undefined }
  | { ok: false; fields: FieldError[] };

export type NormalizeResult = { ok: true; key: string } | { ok: false; error: string };

// The control-character class is the point of this regex: identifiers
// containing C0/C1 controls are rejected outright.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * Normalize a recipient identifier: NFKC, lowercase, trim. Rejects
 * empty results, control characters, and anything over 64 chars after
 * normalization. Deliberately does NOT strip zero-width characters or
 * fold exotic whitespace beyond what NFKC + trim do: the spec's
 * normalization is exact, and two identifiers that normalize
 * differently are different recipients (R4.4, fail closed).
 */
export function normalizeRecipient(raw: string): NormalizeResult {
  if (CONTROL_CHARS.test(raw)) {
    return { ok: false, error: "recipient contains control characters" };
  }
  const key = raw.normalize("NFKC").toLowerCase().trim();
  if (key.length === 0) return { ok: false, error: "recipient is empty" };
  if (key.length > 64) return { ok: false, error: "recipient exceeds 64 characters" };
  return { ok: true, key };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

export function validateProposal(input: unknown): ValidationResult {
  if (!isPlainObject(input)) {
    return { ok: false, fields: [{ field: "proposal", message: "proposal must be an object" }] };
  }
  const fields: FieldError[] = [];

  let recipientKey = "";
  if (typeof input.recipient !== "string") {
    fields.push({ field: "recipient", message: "recipient must be a string" });
  } else {
    const normalized = normalizeRecipient(input.recipient);
    if (!normalized.ok) {
      fields.push({ field: "recipient", message: normalized.error });
    } else {
      recipientKey = normalized.key;
    }
  }

  let amountCents = 0;
  if (typeof input.amountCents !== "number" || !Number.isSafeInteger(input.amountCents)) {
    fields.push({ field: "amountCents", message: "amountCents must be an integer" });
  } else if (input.amountCents <= 0) {
    fields.push({ field: "amountCents", message: "amountCents must be positive" });
  } else if (input.amountCents > MAX_AMOUNT_CENTS) {
    fields.push({ field: "amountCents", message: "amountCents exceeds the $10,000,000 ceiling" });
  } else {
    amountCents = input.amountCents;
  }

  if (typeof input.currency !== "string") {
    fields.push({ field: "currency", message: "currency must be a string" });
  } else if (input.currency !== "USD") {
    fields.push({ field: "currency", message: "only USD is supported" });
  }

  let memo = "";
  if (typeof input.memo !== "string") {
    fields.push({ field: "memo", message: "memo must be a string" });
  } else {
    memo = input.memo.trim();
    if ([...memo].length > 280) {
      fields.push({ field: "memo", message: "memo exceeds 280 characters" });
    }
  }

  let idempotencyKey: string | undefined;
  if (input.idempotencyKey !== undefined) {
    if (typeof input.idempotencyKey !== "string") {
      fields.push({ field: "idempotencyKey", message: "idempotencyKey must be a string" });
    } else if (input.idempotencyKey.trim().length === 0) {
      fields.push({ field: "idempotencyKey", message: "idempotencyKey must not be empty" });
    } else if (input.idempotencyKey.length > 128) {
      fields.push({ field: "idempotencyKey", message: "idempotencyKey exceeds 128 characters" });
    } else {
      idempotencyKey = input.idempotencyKey;
    }
  }

  if (fields.length > 0) return { ok: false, fields };
  return {
    ok: true,
    proposal: { recipientKey, amountCents, currency: "USD", memo },
    idempotencyKey,
  };
}
