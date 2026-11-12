const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const L = require("../src/ledger.js");

const sha256 = (s) => Promise.resolve(createHash("sha256").update(s, "utf8").digest("hex"));

test("append grows a linked chain from the genesis constant", async () => {
  const chain = L.createChain(sha256);
  const a = await chain.append("verdict", { decision: "PASS", cents: 10000 }, "2026-11-12T10:00:00.000Z");
  const b = await chain.append("policy", { field: "frozen", to: true }, "2026-11-12T10:01:00.000Z");
  assert.equal(a.seq, 0);
  assert.equal(a.prev, L.GENESIS_PREV);
  assert.equal(b.seq, 1);
  assert.equal(b.prev, a.hash);
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  assert.equal(chain.entries.length, 2);
});

test("an intact chain verifies", async () => {
  const chain = L.createChain(sha256);
  await chain.append("verdict", { decision: "PASS", cents: 100 }, "2026-11-12T10:00:00.000Z");
  await chain.append("verdict", { decision: "REJECT", cents: 999 }, "2026-11-12T10:01:00.000Z");
  await chain.append("policy", { field: "txCap", to: 20000 }, "2026-11-12T10:02:00.000Z");
  const v = await chain.verify();
  assert.deepEqual(v, { ok: true, firstBadSeq: null, reason: null });
  assert.deepEqual(await L.verifyChain([], sha256), { ok: true, firstBadSeq: null, reason: null });
});

test("tampering with any payload is detected at the right entry", async () => {
  const chain = L.createChain(sha256);
  await chain.append("verdict", { decision: "PASS", cents: 100 }, "2026-11-12T10:00:00.000Z");
  await chain.append("verdict", { decision: "PASS", cents: 200 }, "2026-11-12T10:01:00.000Z");
  await chain.append("verdict", { decision: "PASS", cents: 300 }, "2026-11-12T10:02:00.000Z");
  chain.entries[1].payload.cents = 200000;
  const v = await chain.verify();
  assert.equal(v.ok, false);
  assert.equal(v.firstBadSeq, 1);
  assert.match(v.reason, /stored hash/);
});

test("tampering with a hash or a link is detected", async () => {
  const chain = L.createChain(sha256);
  await chain.append("verdict", { decision: "PASS", cents: 100 }, "2026-11-12T10:00:00.000Z");
  await chain.append("verdict", { decision: "PASS", cents: 200 }, "2026-11-12T10:01:00.000Z");
  chain.entries[0].hash = "0".repeat(64);
  assert.equal((await chain.verify()).ok, false);

  const chain2 = L.createChain(sha256);
  await chain2.append("verdict", { decision: "PASS", cents: 100 }, "2026-11-12T10:00:00.000Z");
  await chain2.append("verdict", { decision: "PASS", cents: 200 }, "2026-11-12T10:01:00.000Z");
  chain2.entries.splice(0, 1); // drop the first entry: seq + link both break
  assert.equal((await chain2.verify()).ok, false);
});

test("spentOn counts only PASS verdicts on the requested UTC day", async () => {
  const chain = L.createChain(sha256);
  await chain.append("verdict", { decision: "PASS", cents: 10000 }, "2026-11-12T10:00:00.000Z");
  await chain.append("verdict", { decision: "REJECT", cents: 99999 }, "2026-11-12T11:00:00.000Z");
  await chain.append("verdict", { decision: "PASS", cents: 5000 }, "2026-11-12T23:59:00.000Z");
  await chain.append("verdict", { decision: "PASS", cents: 7000 }, "2026-11-13T00:01:00.000Z");
  await chain.append("policy", { field: "frozen", to: true }, "2026-11-12T12:00:00.000Z");
  assert.equal(chain.spentOn("2026-11-12"), 15000);
  assert.equal(chain.spentOn("2026-11-13"), 7000);
  assert.equal(chain.spentOn("2026-11-14"), 0);
});

test("same entries and timestamps produce the same hashes", async () => {
  const build = async () => {
    const c = L.createChain(sha256);
    await c.append("verdict", { decision: "PASS", cents: 100 }, "2026-11-12T10:00:00.000Z");
    await c.append("policy", { field: "frozen", to: true }, "2026-11-12T10:01:00.000Z");
    return c.entries.map((e) => e.hash);
  };
  assert.deepEqual(await build(), await build());
});
