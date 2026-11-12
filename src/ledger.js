/* Frankenguard audit ledger: append-only, SHA-256 hash-chained.
 * The hash function is injected (WebCrypto in the browser, node:crypto
 * in tests) so this module never imports a platform API.
 * UMD: works via require() in Node and as a browser global.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FrankenguardLedger = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const GENESIS_PREV = "FRANKENGUARD-GENESIS";

  function canonical(entry) {
    return JSON.stringify({
      seq: entry.seq,
      ts: entry.ts,
      kind: entry.kind,
      payload: entry.payload,
      prev: entry.prev,
    });
  }

  async function hashEntry(hashFn, entry) {
    return hashFn(canonical(entry));
  }

  // Verify a full chain. Returns { ok: true } or
  // { ok: false, firstBadSeq, reason }.
  async function verifyChain(entries, hashFn) {
    if (!Array.isArray(entries)) {
      return { ok: false, firstBadSeq: null, reason: "chain is not an array" };
    }
    let prev = GENESIS_PREV;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry || typeof entry !== "object") {
        return { ok: false, firstBadSeq: i, reason: "entry is not an object" };
      }
      if (entry.seq !== i) {
        return { ok: false, firstBadSeq: i, reason: "sequence number out of order" };
      }
      if (entry.prev !== prev) {
        return { ok: false, firstBadSeq: i, reason: "previous hash link broken" };
      }
      const recomputed = await hashEntry(hashFn, entry);
      if (recomputed !== entry.hash) {
        return { ok: false, firstBadSeq: i, reason: "stored hash does not match payload" };
      }
      prev = entry.hash;
    }
    return { ok: true, firstBadSeq: null, reason: null };
  }

  function utcDayKey(ts) {
    return new Date(ts).toISOString().slice(0, 10);
  }

  // Accepted spend for one UTC day, from verdict entries only.
  function spentOn(entries, dayKey) {
    let total = 0;
    for (const entry of entries) {
      if (entry.kind !== "verdict") continue;
      const p = entry.payload || {};
      if (p.decision !== "PASS") continue;
      if (utcDayKey(entry.ts) !== dayKey) continue;
      if (Number.isSafeInteger(p.cents) && p.cents > 0) total += p.cents;
    }
    return total;
  }

  function createChain(hashFn) {
    const entries = [];
    return {
      entries: entries,
      async append(kind, payload, ts) {
        const entry = {
          seq: entries.length,
          ts: ts || new Date().toISOString(),
          kind: kind,
          payload: payload,
          prev: entries.length === 0 ? GENESIS_PREV : entries[entries.length - 1].hash,
          hash: "",
        };
        entry.hash = await hashEntry(hashFn, entry);
        entries.push(entry);
        return entry;
      },
      verify: function () {
        return verifyChain(entries, hashFn);
      },
      spentOn: function (dayKey) {
        return spentOn(entries, dayKey);
      },
    };
  }

  return {
    GENESIS_PREV: GENESIS_PREV,
    canonical: canonical,
    hashEntry: hashEntry,
    verifyChain: verifyChain,
    utcDayKey: utcDayKey,
    spentOn: spentOn,
    createChain: createChain,
  };
});
