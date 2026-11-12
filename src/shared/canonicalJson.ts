// Canonical JSON for the audit hash chain: object keys sorted, no
// whitespace, integers only. Two equal payloads must hash equal no
// matter which order the caller built them in, and a float must never
// reach the chain, because 0.1 + 0.2 does not have a canonical decimal
// spelling. Anything that is not plain JSON data is rejected loudly
// instead of being silently coerced. Nesting is capped: the recursion
// below would otherwise stack-overflow on a hostile payload instead
// of failing with a message. Real payloads nest a handful of levels;
// 100 leaves wide headroom and stays far from the stack limit.

const MAX_DEPTH = 100;

function fail(path: string, what: string): never {
  throw new Error(`canonicalJson: ${what} at ${path || "$"} is not canonical JSON data`);
}

function canonical(value: unknown, path: string, depth: number): string {
  if (depth > MAX_DEPTH) fail(path, `nesting deeper than ${MAX_DEPTH} levels`);
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail(path, `number ${String(value)}`);
    // -0 stringifies as "0" in JSON; normalize so -0 and 0 hash the same.
    return JSON.stringify(value === 0 ? 0 : value);
  }
  if (Array.isArray(value)) {
    const parts = value.map((item, i) => canonical(item, `${path}[${i}]`, depth + 1));
    return `[${parts.join(",")}]`;
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value) as unknown;
    if (proto !== Object.prototype && proto !== null) {
      fail(path, "non-plain object");
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts = keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key], `${path}.${key}`, depth + 1)}`);
    return `{${parts.join(",")}}`;
  }
  return fail(path, typeof value);
}

export function canonicalJson(value: unknown): string {
  return canonical(value, "", 0);
}
