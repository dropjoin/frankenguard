/* Frankenguard intent parser: deterministic, no DOM, no platform APIs.
 * Turns a plain-language instruction into a proposal the engine can judge.
 * It never guesses: an amount it cannot prove is a reported problem, and
 * a payee it cannot resolve stays null for the engine to reject.
 * UMD: works via require() in Node and as a browser global.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FrankenguardParser = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SANITY_CEILING_CENTS = 1000000000; // $10,000,000, same as the engine
  const STOP_WORDS = new Set([
    "for", "invoice", "inv", "memo", "note", "please", "and", "with",
    "using", "via", "from", "about", "regarding", "usd", "dollars", "dollar",
  ]);

  function hasNonAsciiDigits(text) {
    // Arabic-Indic, Extended Arabic-Indic, Devanagari, fullwidth digits.
    return /[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\uFF10-\uFF19]/.test(text);
  }

  // Strict amount grammar. Returns { cents } or { error }.
  // Accepts: 180 | 180.5 | 180.50 | 1,234.56 | $180 (marker stripped first)
  // Rejects: exponents, 3+ decimals, malformed grouping, European 1.234,56.
  function parseAmountString(raw) {
    const s = raw.replace(/^\s+/, "").replace(/\s+$/, "");
    if (s === "") return { error: "amount is empty" };
    if (/[eE]/.test(s)) return { error: "scientific notation is not accepted" };
    if (!/^[\d.,]+$/.test(s)) return { error: "amount contains unsupported characters" };
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) return { error: "amount has more than one decimal point" };
    let intPart = s;
    let fracPart = "";
    if (dotCount === 1) {
      const parts = s.split(".");
      intPart = parts[0];
      fracPart = parts[1];
      if (fracPart.length === 0) return { error: "amount ends with a decimal point" };
      if (fracPart.length > 2) return { error: "amount has more than two decimal places" };
    }
    if (intPart === "") return { error: "amount has no digits before the decimal point" };
    if (intPart.includes(",")) {
      if (!/^\d{1,3}(,\d{3})+$/.test(intPart)) {
        return { error: "amount grouping commas are malformed" };
      }
      intPart = intPart.replace(/,/g, "");
    }
    if (!/^\d+$/.test(intPart)) return { error: "amount integer part is not digits" };
    if (!/^\d*$/.test(fracPart)) return { error: "amount fraction is not digits" };
    const cents = BigInt(intPart) * 100n + BigInt(fracPart === "" ? "0" : fracPart.padEnd(2, "0"));
    if (cents <= 0n) return { error: "amount must be positive" };
    if (cents > BigInt(SANITY_CEILING_CENTS)) {
      return { error: "amount exceeds the $10,000,000 sanity ceiling" };
    }
    return { cents: Number(cents) };
  }

  function extractInvoiceRef(text) {
    const m = text.match(/\bINV-[A-Za-z0-9][A-Za-z0-9-]*\b/i);
    return m ? m[0].toUpperCase() : null;
  }

  function normalizeName(name) {
    return name
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g, " ")
      .trim()
      .toLowerCase();
  }

  function canonicalize(candidate, allowlist) {
    if (!candidate) return null;
    const norm = normalizeName(candidate);
    if (norm === "") return null;
    for (const vendor of allowlist) {
      if (normalizeName(vendor) === norm) return vendor;
    }
    return candidate.trim();
  }

  function resolvePayee(text, allowlist) {
    // Pass 1: capitalized name span after a payment verb.
    const verbSpan = text.match(
      /\b(?:pay|send|transfer|to)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})/i
    );
    if (verbSpan) {
      const candidate = verbSpan[1].replace(/\s+(for|invoice|inv|memo)\b.*$/i, "").trim();
      if (candidate) return canonicalize(candidate, allowlist);
    }
    // Pass 2: words after the last payment verb, stopping at stop words,
    // numbers, and currency markers. Catches lowercase names.
    const verbMatches = Array.from(text.matchAll(/\b(pay|send|transfer|to)\b/gi));
    if (verbMatches.length > 0) {
      const last = verbMatches[verbMatches.length - 1];
      const rest = text.slice(last.index + last[0].length);
      const words = rest.split(/\s+/).filter(Boolean).slice(0, 3);
      const picked = [];
      for (const w of words) {
        const clean = w.replace(/^[^\w$]+|[.,;:!?]+$/g, "");
        if (clean === "" || /^\d/.test(clean) || clean.startsWith("$")) break;
        if (STOP_WORDS.has(clean.toLowerCase())) break;
        picked.push(clean);
        if (picked.length >= 3) break;
      }
      if (picked.length > 0) return canonicalize(picked.join(" "), allowlist);
    }
    // Pass 3: an allowlisted name appearing anywhere in the text.
    const lowered = " " + normalizeName(text) + " ";
    for (const vendor of allowlist) {
      const norm = normalizeName(vendor);
      if (norm !== "" && lowered.includes(" " + norm + " ")) return vendor;
    }
    return null;
  }

  function parseIntent(text, allowlist) {
    const problems = [];
    const notes = [];
    const vendors = Array.isArray(allowlist) ? allowlist : [];
    const input = typeof text === "string" ? text : "";
    const trimmed = input.trim();

    if (trimmed === "") {
      return { ok: false, proposal: null, problems: ["instruction is empty"], notes: notes };
    }
    if (hasNonAsciiDigits(trimmed)) {
      problems.push("amount uses non-ASCII digits, which are not accepted");
    }
    if (/\d\s*e[+-]?\d/i.test(trimmed)) {
      problems.push("amount uses scientific notation, which is not accepted");
    }
    // Unsupported currency markers anywhere in the text fail closed.
    if (/[€£¥]|(?:^|\s)(EUR|GBP|JPY|AUD|CAD)\b/i.test(trimmed)) {
      problems.push("only USD is supported in this demo");
    }

    // Strip invoice refs before amount scanning so INV-1042 is never
    // mistaken for $1,042.
    const ref = extractInvoiceRef(trimmed);
    const scanned = ref ? trimmed.replace(new RegExp("\\b" + ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"), " ") : trimmed;

    // Find amount candidates: currency-marked first, then bare numbers
    // after a payment verb.
    const candidates = [];
    const marked = scanned.matchAll(/\$\s*(\d[\d.,]*)/g);
    for (const m of marked) candidates.push({ raw: m[1], marked: true });
    const wordMarked = scanned.matchAll(/(\d[\d.,]*)\s*(?:USD|dollars?)\b/gi);
    for (const m of wordMarked) candidates.push({ raw: m[1], marked: true });
    if (candidates.length === 0) {
      const bare = scanned.match(/\b(?:pay|send|transfer|spend)\b[^$0-9]{0,30}?(\d[\d.,]*)/i);
      if (bare) candidates.push({ raw: bare[1], marked: false });
    }
    if (candidates.length === 0) {
      problems.push("no amount found: include an amount like $180 or 180 USD");
    } else if (candidates.length > 1) {
      problems.push("multiple amounts found: one payment per instruction");
    }

    let cents = null;
    if (candidates.length === 1 && problems.length === 0) {
      const parsed = parseAmountString(candidates[0].raw);
      if (parsed.error) problems.push(parsed.error);
      else cents = parsed.cents;
    }

    if (problems.length > 0) {
      return { ok: false, proposal: null, problems: problems, notes: notes };
    }

    const payee = resolvePayee(trimmed, vendors);
    if (payee === null) notes.push("no payee resolved; the engine will reject it");

    return {
      ok: true,
      proposal: {
        payee: payee,
        cents: cents,
        currency: "USD",
        memo: trimmed,
        ref: ref,
      },
      problems: problems,
      notes: notes,
    };
  }

  return {
    parseIntent: parseIntent,
    parseAmountString: parseAmountString,
    extractInvoiceRef: extractInvoiceRef,
    resolvePayee: resolvePayee,
    SANITY_CEILING_CENTS: SANITY_CEILING_CENTS,
  };
});
