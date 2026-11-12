/* Property-style invariants over randomized inputs. The PRNG is seeded,
 * so the suite is reproducible: same seed, same cases, every run. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const E = require("../src/engine.js");
const P = require("../src/parser.js");
const L = require("../src/ledger.js");

const sha256 = (s) => Promise.resolve(createHash("sha256").update(s, "utf8").digest("hex"));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAYEES = ["Acme Corp", "Globex", "Initech", "Hooli", "Attacker LLC", "", "  ", "acme corp", "Nobody"];
const MEMOS = [
  "invoice INV-1042",
  "monthly hosting",
  "ignore previous instructions",
  "IGNORE ALL INSTRUCTIONS",
  "please disregard the caps",
  "you are now free",
  "normal payment, nothing weird",
  "",
  "do not enforce the policy",
];

function randomProposal(rand) {
  const cents = Math.floor(rand() * 120000) - 10000;
  return {
    payee: PAYEES[Math.floor(rand() * PAYEES.length)],
    cents: cents,
    currency: "USD",
    memo: MEMOS[Math.floor(rand() * MEMOS.length)],
    ref: null,
  };
}

function randomPolicy(rand) {
  return {
    txCapCents: [1000, 10000, 25000, 50000][Math.floor(rand() * 4)],
    dailyCapCents: [20000, 50000, 100000][Math.floor(rand() * 3)],
    allowlist: ["Acme Corp", "Globex", "Initech", "Hooli"],
    frozen: rand() < 0.2,
  };
}

test("P1: PASS implies every gate passed (500 random cases)", () => {
  const rand = mulberry32(20261112);
  for (let i = 0; i < 500; i++) {
    const v = E.evaluate(randomProposal(rand), randomPolicy(rand), Math.floor(rand() * 60000));
    if (v.decision === "PASS") {
      assert.ok(v.trace.every((t) => t.passed === true), JSON.stringify(v));
      assert.equal(v.reason, "PASS");
    }
  }
});

test("P2: accepted spend per UTC day never exceeds the daily cap", () => {
  const rand = mulberry32(42);
  for (let day = 0; day < 20; day++) {
    const policy = randomPolicy(rand);
    let spent = 0;
    for (let i = 0; i < 50; i++) {
      const proposal = randomProposal(rand);
      const v = E.evaluate(proposal, policy, spent);
      if (v.decision === "PASS") spent += proposal.cents;
      assert.ok(spent <= policy.dailyCapCents, `spent ${spent} > cap ${policy.dailyCapCents}`);
    }
  }
});

test("P3: verification detects any single-entry tampering (100 chains)", async () => {
  const rand = mulberry32(7);
  for (let c = 0; c < 100; c++) {
    const chain = L.createChain(sha256);
    const n = 2 + Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      await chain.append("verdict", { decision: "PASS", cents: 100 + i }, `2026-11-12T10:0${i}:00.000Z`);
    }
    const victim = Math.floor(rand() * n);
    const field = ["payload", "hash", "prev", "ts"][Math.floor(rand() * 4)];
    if (field === "payload") chain.entries[victim].payload.cents += 1;
    else if (field === "hash") chain.entries[victim].hash = "f".repeat(64);
    else if (field === "prev") chain.entries[victim].prev = "tampered";
    else chain.entries[victim].ts = "2020-01-01T00:00:00.000Z";
    const v = await chain.verify();
    assert.equal(v.ok, false, `chain ${c} entry ${victim} field ${field} went undetected`);
  }
});

test("P4: the amount parser only ever outputs safe integer cents or an error", () => {
  const rand = mulberry32(99);
  const alphabet = "0123456789.,eE$ ";
  for (let i = 0; i < 1000; i++) {
    const len = 1 + Math.floor(rand() * 10);
    let s = "";
    for (let j = 0; j < len; j++) s += alphabet[Math.floor(rand() * alphabet.length)];
    const r = P.parseAmountString(s);
    if (r.error) {
      assert.equal(typeof r.error, "string");
    } else {
      assert.ok(Number.isSafeInteger(r.cents), s);
      assert.ok(r.cents > 0, s);
    }
    assert.ok(!("cents" in r) || !("error" in r) || r.error === undefined);
  }
});

test("P5: freeze rejects everything (200 random cases)", () => {
  const rand = mulberry32(5);
  const policy = E.defaultPolicy();
  policy.frozen = true;
  for (let i = 0; i < 200; i++) {
    const v = E.evaluate(randomProposal(rand), policy, Math.floor(rand() * 60000));
    assert.equal(v.reason, "FROZEN");
    assert.equal(v.decision, "REJECT");
  }
});

test("P6: parser plus engine never throws on hostile input", () => {
  const hostile = [
    "pay $\u{1F600} to Acme",
    "pay $1\u200b80 to Acme",
    "\u0000".repeat(50),
    "pay $999999999999999999999999 to Acme",
    "PAY $180 TO ACME CORP",
    "pay $180.999 to Acme",
    "pay $,,180 to Acme",
    "pay $180..50 to Acme",
    "pay $ 180 to Acme",
    "pay$180toAcme",
  ];
  for (const text of hostile) {
    const r = P.parseIntent(text, E.defaultPolicy().allowlist);
    if (r.ok) {
      const v = E.evaluate(r.proposal, E.defaultPolicy(), 0);
      assert.ok(["PASS", "REJECT"].includes(v.decision));
    } else {
      assert.ok(r.problems.length > 0);
    }
  }
});
