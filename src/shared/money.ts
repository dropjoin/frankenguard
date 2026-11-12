// Money is integer cents from the moment it enters the system until the
// moment it is displayed. Floats never hold money: every conversion goes
// through BigInt, and formatting is integer division only.

export const MAX_AMOUNT_CENTS = 1_000_000_000; // $10,000,000, the exhibit ceiling (R1 assumptions)
export const MAX_CAP_CENTS = 1_000_000_000; // caps are likewise bounded (R3.8)

/** Format integer cents as USD, e.g. 75000 -> "$750.00". Throws on anything that is not a safe integer. */
export function formatUsd(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`formatUsd expects integer cents, got ${String(cents)}`);
  }
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${String(remainder).padStart(2, "0")}`;
}

const NON_ASCII_DIGITS = /[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\uFF10-\uFF19]/;

export type DecimalParse =
  | { ok: true; cents: number }
  | { ok: false; error: string };

/**
 * Parse a human-typed dollar amount into integer cents, strictly.
 * Accepts "180", "180.50", "1,234.56", and an optional leading "$".
 * Rejects exponents, more than two decimals, malformed grouping,
 * European-style decimals, non-ASCII digits, zero, negatives, and
 * anything over the $10,000,000 ceiling. Never guesses: a string that
 * fails any rule comes back as an error naming the rule.
 *
 * Ported from the pre-spec intent parser's amount grammar, which had
 * eleven tests for exactly these traps. The grammar survives; the
 * payee-resolution machinery around it does not (no spec consumer).
 */
export function parseDecimalToCents(raw: string): DecimalParse {
  let s = raw.trim();
  if (s === "") return { ok: false, error: "amount is empty" };
  if (s.startsWith("$")) s = s.slice(1).trim();
  if (s === "") return { ok: false, error: "amount is empty" };
  if (NON_ASCII_DIGITS.test(s)) {
    return { ok: false, error: "amount uses non-ASCII digits, which are not accepted" };
  }
  if (/[eE]/.test(s)) return { ok: false, error: "scientific notation is not accepted" };
  if (!/^[\d.,]+$/.test(s)) {
    return { ok: false, error: "amount contains unsupported characters" };
  }
  const dotCount = (s.match(/\./g) ?? []).length;
  if (dotCount > 1) return { ok: false, error: "amount has more than one decimal point" };
  let intPart = s;
  let fracPart = "";
  if (dotCount === 1) {
    const parts = s.split(".");
    intPart = parts[0] ?? "";
    fracPart = parts[1] ?? "";
    if (fracPart.length === 0) return { ok: false, error: "amount ends with a decimal point" };
    if (fracPart.length > 2) {
      return { ok: false, error: "amount has more than two decimal places" };
    }
  }
  if (intPart === "") return { ok: false, error: "amount has no digits before the decimal point" };
  if (intPart.includes(",")) {
    if (!/^\d{1,3}(,\d{3})+$/.test(intPart)) {
      return { ok: false, error: "amount grouping commas are malformed" };
    }
    intPart = intPart.replace(/,/g, "");
  }
  const cents =
    BigInt(intPart) * 100n + BigInt(fracPart === "" ? "0" : fracPart.padEnd(2, "0"));
  if (cents <= 0n) return { ok: false, error: "amount must be positive" };
  if (cents > BigInt(MAX_AMOUNT_CENTS)) {
    return { ok: false, error: "amount exceeds the $10,000,000 ceiling" };
  }
  return { ok: true, cents: Number(cents) };
}
