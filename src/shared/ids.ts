import { randomBytes } from "node:crypto";

import type { Clock } from "./clock.js";

// ULID: 26 Crockford base32 chars, 48-bit millisecond timestamp followed
// by 80 bits of randomness. Lexicographically sortable by creation time,
// which is why proposals and payments use it: insertion order and id
// order agree without a separate sequence.

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeUlid(timeMs: number, random: Buffer): string {
  const value = (BigInt(timeMs) << 80n) | BigInt(`0x${random.toString("hex")}`);
  let out = "";
  let rest = value;
  for (let i = 0; i < 26; i++) {
    out = CROCKFORD[Number(rest & 31n)] + out;
    rest >>= 5n;
  }
  return out;
}

export function newUlid(clock?: Clock): string {
  const timeMs = clock ? clock.now().getTime() : Date.now();
  return encodeUlid(timeMs, randomBytes(10));
}

/** A sandbox id is 128 random bits, base64url, 22 chars. Unpredictable by construction: it is the only thing standing between visitors and each other's sandboxes. */
export function newSandboxId(): string {
  return randomBytes(16).toString("base64url");
}
