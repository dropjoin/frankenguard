/* Frankenguard rule engine: deterministic, no DOM, no platform APIs.
 * Same proposal + same policy + same ledger state = same verdict, always.
 * UMD: works via require() in Node and as a browser global.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FrankenguardEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SANITY_CEILING_CENTS = 1000000000; // $10,000,000. Above this, no.

  const REASONS = {
    PASS: "PASS",
    FROZEN: "FROZEN",
    OVER_TX_CAP: "OVER_TX_CAP",
    OVER_DAILY_CAP: "OVER_DAILY_CAP",
    PAYEE_NOT_ALLOWLISTED: "PAYEE_NOT_ALLOWLISTED",
    MEMO_GUARDRAIL: "MEMO_GUARDRAIL",
    AMOUNT_INVALID: "AMOUNT_INVALID",
    PROPOSAL_MALFORMED: "PROPOSAL_MALFORMED",
  };

  // Injection patterns, matched against normalized memo text (see
  // normalizeMemo: Unicode whitespace folded, zero-width stripped,
  // case folded). The guardrail is a tripwire, not a classifier: a
  // payment memo has no legitimate reason to contain these phrases.
  const INJECTION_PATTERNS = [
    /\bignore\b.{0,40}\b(instructions?|rules?|polic(?:y|ies)|restrictions?|caps?|limits?|previous|prior|above)\b/,
    /\bdisregard\b/,
    /\boverride\b/,
    /\bbypass\b/,
    /\byou are now\b/,
    /\bnew instructions\b/,
    /\bdo not\b.{0,20}\b(follow|apply|enforce)\b/,
    /\bjailbreak\b/,
    /\bsystem prompt\b/,
  ];

  function normalizeMemo(memo) {
    return String(memo)
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width + BOM: strip entirely
      .replace(/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normalizePayee(payee) {
    return String(payee)
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g, " ")
      .trim()
      .toLowerCase();
  }

  function memoHasInjection(memo) {
    const text = normalizeMemo(memo);
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) return true;
    }
    return false;
  }

  function formatCents(cents) {
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(cents);
    const dollars = Math.floor(abs / 100);
    const rem = abs % 100;
    return (
      sign +
      "$" +
      String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
      "." +
      String(rem).padStart(2, "0")
    );
  }

  function defaultPolicy() {
    return {
      txCapCents: 25000,
      dailyCapCents: 50000,
      allowlist: ["Acme Corp", "Globex", "Initech", "Hooli"],
      frozen: false,
    };
  }

  function shapeProblems(proposal) {
    // Wrong types / missing fields. Present-but-invalid values are the
    // gates' job, not this check's.
    if (proposal === null || typeof proposal !== "object" || Array.isArray(proposal)) {
      return ["proposal is not an object"];
    }
    const problems = [];
    if (!("cents" in proposal)) problems.push("cents is missing");
    else if (typeof proposal.cents !== "number") problems.push("cents is not a number");
    if (!("payee" in proposal)) problems.push("payee is missing");
    else if (proposal.payee !== null && typeof proposal.payee !== "string") {
      problems.push("payee is not a string");
    }
    if (!("memo" in proposal)) problems.push("memo is missing");
    else if (typeof proposal.memo !== "string") problems.push("memo is not a string");
    if (!("currency" in proposal)) problems.push("currency is missing");
    else if (typeof proposal.currency !== "string") problems.push("currency is not a string");
    return problems;
  }

  function evaluate(proposal, policy, spentTodayCents) {
    const trace = [];
    const gate = (name, passed, detail) => {
      trace.push({ gate: name, passed: passed, detail: detail });
      return passed;
    };

    const malformed = shapeProblems(proposal);
    const frozen = policy && policy.frozen === true;

    // Gate 1: freeze. Evaluated first, but every gate still runs so the
    // trace is complete; the verdict reason is the FIRST failure in order.
    gate("freeze", !frozen, frozen ? "freeze switch is ON" : "freeze switch is off");

    // Gate 2: amount validity (also surfaces malformed proposals).
    let amountOk = false;
    let amountDetail = "";
    if (malformed.length > 0) {
      amountDetail = "proposal malformed: " + malformed.join("; ");
    } else if (!Number.isSafeInteger(proposal.cents)) {
      amountDetail = "amount is not a safe integer";
    } else if (proposal.cents <= 0) {
      amountDetail = "amount must be positive";
    } else if (proposal.cents > SANITY_CEILING_CENTS) {
      amountDetail = "amount exceeds sanity ceiling of " + formatCents(SANITY_CEILING_CENTS);
    } else {
      amountOk = true;
      amountDetail = formatCents(proposal.cents) + " is a valid amount";
    }
    gate("amount", amountOk, amountDetail);

    // Gate 3: per-transaction cap.
    const txCap = policy && Number.isSafeInteger(policy.txCapCents) && policy.txCapCents > 0
      ? policy.txCapCents
      : null;
    let txOk = false;
    let txDetail = "";
    if (txCap === null) {
      txDetail = "policy per-tx cap unreadable, failing closed";
    } else if (!amountOk) {
      txOk = null; // skipped, not failed: the amount gate already said no
      txDetail = "skipped, amount invalid";
    } else if (proposal.cents > txCap) {
      txDetail = formatCents(proposal.cents) + " exceeds per-tx cap " + formatCents(txCap);
    } else {
      txOk = true;
      txDetail = formatCents(proposal.cents) + " within per-tx cap " + formatCents(txCap);
    }
    gate("tx_cap", txOk, txDetail);

    // Gate 4: daily cap (UTC calendar day; spentTodayCents is the
    // caller's ledger computation for the current UTC day).
    const dailyCap = policy && Number.isSafeInteger(policy.dailyCapCents) && policy.dailyCapCents > 0
      ? policy.dailyCapCents
      : null;
    const spentOk = Number.isSafeInteger(spentTodayCents) && spentTodayCents >= 0;
    let dailyOk = false;
    let dailyDetail = "";
    if (dailyCap === null || !spentOk) {
      dailyDetail = "daily ledger state unreadable, failing closed";
    } else if (!amountOk) {
      dailyOk = null; // skipped, not failed: the amount gate already said no
      dailyDetail = "skipped, amount invalid";
    } else if (spentTodayCents + proposal.cents > dailyCap) {
      dailyDetail =
        formatCents(spentTodayCents) + " spent + " + formatCents(proposal.cents) +
        " exceeds daily cap " + formatCents(dailyCap);
    } else {
      dailyOk = true;
      dailyDetail =
        formatCents(spentTodayCents) + " spent + " + formatCents(proposal.cents) +
        " within daily cap " + formatCents(dailyCap);
    }
    gate("daily_cap", dailyOk, dailyDetail);

    // Gate 5: allowlist. Exact match after normalization. Empty never matches.
    const allowlist = policy && Array.isArray(policy.allowlist) ? policy.allowlist : [];
    const allowed = new Set(allowlist.map(normalizePayee));
    allowed.delete("");
    const payeeNorm = malformed.length > 0 ? "" : normalizePayee(proposal.payee === null ? "" : proposal.payee);
    const allowOk = payeeNorm !== "" && allowed.has(payeeNorm);
    gate(
      "allowlist",
      allowOk,
      proposal && typeof proposal.payee === "string" && proposal.payee !== ""
        ? allowOk
          ? '"' + proposal.payee + '" is allowlisted'
          : '"' + proposal.payee + '" is not on the allowlist'
        : "no payee resolved"
    );

    // Gate 6: memo guardrail. The raw memo AND the full instruction text
    // are scanned by the caller passing the combined text as memo; the
    // engine scans whatever it is given, after normalization.
    const memoText = malformed.length > 0 ? "" : proposal.memo;
    const injection = memoHasInjection(memoText);
    gate("memo", !injection, injection ? "memo matches an injection pattern" : "memo is clean");

    // Verdict: malformed proposals get their own reason; otherwise the
    // first failing gate in fixed order decides. Skipped gates (null)
    // never decide a verdict: a skip only follows an earlier failure.
    const firstFailure = trace.find((t) => t.passed === false);
    let reason = REASONS.PASS;
    if (malformed.length > 0) reason = REASONS.PROPOSAL_MALFORMED;
    else if (firstFailure) {
      reason =
        firstFailure.gate === "freeze" ? REASONS.FROZEN
        : firstFailure.gate === "amount" ? REASONS.AMOUNT_INVALID
        : firstFailure.gate === "tx_cap" ? REASONS.OVER_TX_CAP
        : firstFailure.gate === "daily_cap" ? REASONS.OVER_DAILY_CAP
        : firstFailure.gate === "allowlist" ? REASONS.PAYEE_NOT_ALLOWLISTED
        : REASONS.MEMO_GUARDRAIL;
    }

    return {
      decision: reason === REASONS.PASS ? "PASS" : "REJECT",
      reason: reason,
      trace: trace,
    };
  }

  return {
    evaluate: evaluate,
    defaultPolicy: defaultPolicy,
    formatCents: formatCents,
    normalizeMemo: normalizeMemo,
    normalizePayee: normalizePayee,
    memoHasInjection: memoHasInjection,
    REASONS: REASONS,
    SANITY_CEILING_CENTS: SANITY_CEILING_CENTS,
  };
});
