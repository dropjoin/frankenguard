import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Theme tests: the binding tokens (design 8.4.1) are the contract,
// and these tests parse the actual CSS instead of trusting it. Color
// math uses the standard WCAG relative-luminance formula; no ratio
// is rounded before the 4.5:1 comparison.

// Paths are resolved from the repo root (the test working
// directory). import.meta.url is unreliable under Vitest's module
// transform, and Vite rewrites new URL(..., import.meta.url) asset
// patterns, so neither is used here.
const WEB_SRC = join(process.cwd(), "src/web/src");
const THEME_DIR = join(WEB_SRC, "theme");

function readTheme(name: string): string {
  return readFileSync(join(THEME_DIR, name), "utf8");
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Parse the :root block of tokens.css into name -> value. */
function parseTokens(css: string): Map<string, string> {
  const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
  if (!root) throw new Error("no :root block in tokens.css");
  const body = root[1];
  if (body === undefined) throw new Error("no :root block in tokens.css");
  const tokens = new Map<string, string>();
  for (const match of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) tokens.set(`--${name}`, value.trim());
  }
  return tokens;
}

/** Split CSS into flat { selector, declarations } rules, unwrapping one level of @media. */
function parseRules(css: string): { selector: string; declarations: string }[] {
  const clean = stripComments(css);
  const rules: { selector: string; declarations: string }[] = [];
  const walk = (text: string) => {
    let depth = 0;
    let selectorStart = 0;
    let bodyStart = 0;
    let selector = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "{") {
        if (depth === 0) {
          selector = text.slice(selectorStart, i).trim();
          bodyStart = i + 1;
        }
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const body = text.slice(bodyStart, i);
          if (selector.startsWith("@media")) walk(body);
          else if (!selector.startsWith("@")) rules.push({ selector, declarations: body });
          selectorStart = i + 1;
        }
      }
    }
  };
  walk(clean);
  return rules;
}

function luminance(hex: string): number {
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(hexA: string, hexB: string): number {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const TOKENS_CSS = readTheme("tokens.css");
const TOKENS = parseTokens(TOKENS_CSS);
const ALL_CSS = readdirSync(THEME_DIR)
  .filter((f) => f.endsWith(".css"))
  .map((f) => ({ name: f, css: readTheme(f) }));

function tokenHex(name: string): string {
  const value = TOKENS.get(name);
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`token ${name} is not a hex color: ${value}`);
  return value.slice(1);
}

describe("binding tokens", () => {
  it("defines every binding color token with exactly the specified value", () => {
    const expected: Record<string, string> = {
      "--base-gray": "#f2f2f2",
      "--base-sky": "#d7ebff",
      "--base-lavender": "#e9e2ff",
      "--purple": "#673ab7",
      "--amethyst": "#9b59b6",
      "--blue": "#3498db",
      "--pumpkin": "#ff5f1f",
      "--electric": "#39ff14",
      "--highlight": "#f1c40f",
      "--hero-start": "#8e2de2",
      "--hero-end": "#4a00e0",
      "--success": "#16a34a",
      "--warning": "#f59e0b",
      "--error": "#ef4444",
      "--info": "#0ea5e9",
      "--text-body": "#1f2937",
      "--text-brand": "#673ab7",
      "--text-brand-alt": "#7c3aed",
      "--text-success": "#166534",
      "--text-error": "#b91c1c",
      "--text-warning": "#92400e",
      "--text-info": "#0369a1",
      "--text-blue": "#1d4ed8",
      "--text-on-fill": "#111111",
      "--on-color": "#ffffff",
      "--stitch": "#673ab7",
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(TOKENS.get(name)?.toLowerCase(), name).toBe(value);
    }
  });

  it("defines the hero gradient from the two hero ends", () => {
    const gradient = TOKENS.get("--hero-gradient") ?? "";
    expect(gradient).toContain("var(--hero-start)");
    expect(gradient).toContain("var(--hero-end)");
    expect(gradient.startsWith("linear-gradient(")).toBe(true);
  });

  it("has no --ink or --ink-muted tokens and no dark-theme tokens", () => {
    expect(TOKENS.has("--ink")).toBe(false);
    expect(TOKENS.has("--ink-muted")).toBe(false);
    for (const name of TOKENS.keys()) {
      expect(name).not.toMatch(/dark/i);
    }
  });

  it("defines the typography contract: families, base size, weights, line-heights, tracking", () => {
    expect(TOKENS.get("--font-display")).toContain("Space Grotesk");
    expect(TOKENS.get("--font-body")).toContain("Inter");
    expect(TOKENS.get("--font-mono")).toContain("Geist Mono");
    expect(TOKENS.get("--text-base")).toBe("1rem");
    expect(TOKENS.get("--fw-light")).toBe("300");
    expect(TOKENS.get("--fw-regular")).toBe("400");
    expect(TOKENS.get("--fw-medium")).toBe("500");
    expect(TOKENS.get("--fw-semibold")).toBe("600");
    expect(TOKENS.get("--fw-bold")).toBe("700");
    expect(TOKENS.get("--lh-body")).toBe("1.6");
    expect(TOKENS.get("--lh-headline")).toBe("1.1");
    expect(TOKENS.get("--lh-display-1")).toBe("1.05");
    expect(TOKENS.get("--lh-display-2")).toBe("1.15");
    expect(TOKENS.get("--lh-display-3")).toBe("1.25");
    expect(TOKENS.get("--ls-display-1")).toBe("-0.04em");
    expect(TOKENS.get("--ls-display-2")).toBe("-0.03em");
    expect(TOKENS.get("--ls-display-3")).toBe("-0.02em");
    expect(TOKENS.get("--ls-body")).toBe("0");
  });

  it("defines size-adjusted fallback faces for all three fonts", () => {
    for (const fallback of ["Inter Fallback", "Space Grotesk Fallback", "Geist Mono Fallback"]) {
      expect(TOKENS_CSS).toContain(`font-family: "${fallback}"`);
    }
    expect(TOKENS_CSS.match(/size-adjust:/g)).toHaveLength(3);
  });
});

describe("WCAG contrast, computed", () => {
  const bases = ["--base-gray", "--base-sky", "--base-lavender"];
  const textTokens = [
    "--text-body",
    "--text-brand",
    "--text-brand-alt",
    "--text-success",
    "--text-error",
    "--text-warning",
    "--text-info",
    "--text-blue",
  ];

  it("every text token passes 4.5:1 on every base (no rounding)", () => {
    for (const text of textTokens) {
      for (const base of bases) {
        const ratio = contrast(tokenHex(text), tokenHex(base));
        expect(ratio, `${text} on ${base} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("text-on-fill passes 4.5:1 on every semantic fill, pumpkin, and highlight", () => {
    for (const fill of ["--success", "--warning", "--error", "--info", "--pumpkin", "--highlight"]) {
      const ratio = contrast(tokenHex("--text-on-fill"), tokenHex(fill));
      expect(ratio, `text-on-fill on ${fill} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("white passes 4.5:1 on purple, amethyst, and both hero ends", () => {
    for (const bg of ["--purple", "--amethyst", "--hero-start", "--hero-end"]) {
      const ratio = contrast(tokenHex("--on-color"), tokenHex(bg));
      expect(ratio, `white on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("every base background has relative luminance at least 0.6", () => {
    for (const base of bases) {
      expect(luminance(tokenHex(base)), base).toBeGreaterThanOrEqual(0.6);
    }
  });
});

describe("CSS lint", () => {
  it("has no color-scheme queries anywhere: one theme exists", () => {
    for (const { name, css } of ALL_CSS) {
      expect(css, name).not.toContain("prefers-color-scheme");
    }
  });

  it("has no raw hex values outside tokens.css", () => {
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
    for (const { name, css } of ALL_CSS) {
      if (name === "tokens.css") continue;
      expect(stripComments(css).match(hexPattern), name).toBeNull();
    }
  });

  it("has no raw hex color literals in TSX sources", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith(".tsx") || path.endsWith(".ts")) files.push(path);
      }
    };
    walk(WEB_SRC);
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
    for (const file of files) {
      expect(stripComments(readFileSync(file, "utf8")).match(hexPattern), file).toBeNull();
    }
  });

  it("color declarations resolve only to text tokens, text-on-fill, on-color, inherit, or currentColor", () => {
    const allowed = new Set([
      ...[
        "--text-body",
        "--text-brand",
        "--text-brand-alt",
        "--text-success",
        "--text-error",
        "--text-warning",
        "--text-info",
        "--text-blue",
      ].map((t) => `var(${t})`),
      "var(--text-on-fill)",
      "var(--on-color)",
      "inherit",
      "currentcolor",
    ]);
    for (const { name, css } of ALL_CSS) {
      for (const rule of parseRules(css)) {
        for (const decl of rule.declarations.split(";")) {
          const match = /^\s*color\s*:\s*(.+?)\s*$/.exec(decl);
          if (!match || match[1] === undefined) continue;
          expect(allowed.has(match[1].toLowerCase()), `${name} ${rule.selector} color: ${match[1]}`).toBe(true);
        }
      }
    }
  });

  it("white text appears only on purple, amethyst, or the hero gradient", () => {
    for (const { name, css } of ALL_CSS) {
      for (const rule of parseRules(css)) {
        if (!/color\s*:\s*var\(--on-color\)/.test(rule.declarations)) continue;
        const heroContext = /hero|header-band|monster/i.test(rule.selector);
        const darkFill = /background[^:]*:\s*(var\(--purple\)|var\(--amethyst\)|var\(--hero-gradient\))/i.test(rule.declarations);
        expect(heroContext || darkFill, `${name} ${rule.selector}`).toBe(true);
      }
    }
  });

  it("the hero gradient is used only by the header band", () => {
    for (const { name, css } of ALL_CSS) {
      for (const rule of parseRules(css)) {
        if (!rule.declarations.includes("var(--hero-gradient)")) continue;
        expect(rule.selector, name).toMatch(/header-band/);
      }
    }
  });

  it("only the primary button uses --pumpkin in CSS", () => {
    for (const { name, css } of ALL_CSS) {
      for (const rule of parseRules(css)) {
        if (!rule.declarations.includes("var(--pumpkin)")) continue;
        expect(rule.selector, name).toBe(".btn-primary");
      }
    }
  });

  it("the primary button uses --text-on-fill text on the --pumpkin fill", () => {
    const primitives = ALL_CSS.find((f) => f.name === "primitives.css")!;
    const rule = parseRules(primitives.css).find((r) => r.selector === ".btn-primary")!;
    expect(rule).toBeDefined();
    expect(rule.declarations).toContain("background: var(--pumpkin)");
    expect(rule.declarations).toContain("color: var(--text-on-fill)");
  });

  it("--electric appears only in allow-listed small components, never as text", () => {
    const allowedSelector = /dot|bolt|spark|stamp|focus/i;
    for (const { name, css } of ALL_CSS) {
      if (name === "tokens.css") continue;
      for (const rule of parseRules(css)) {
        for (const decl of rule.declarations.split(";")) {
          if (!decl.includes("var(--electric)")) continue;
          expect(/^\s*color\s*:/.test(decl), `${name} ${rule.selector}: electric as text`).toBe(false);
          expect(allowedSelector.test(rule.selector), `${name} ${rule.selector}`).toBe(true);
        }
      }
    }
  });

  it("page and panel backgrounds all have luminance at least 0.6", () => {
    const structural = /^(body|html|\.panel|\.page|\.panels|main|section)/;
    for (const { name, css } of ALL_CSS) {
      for (const rule of parseRules(css)) {
        if (!structural.test(rule.selector)) continue;
        for (const decl of rule.declarations.split(";")) {
          const match = /^\s*background(?:-color)?\s*:\s*var\((--[\w-]+)\)\s*$/.exec(decl);
          if (!match || match[1] === undefined) continue;
          expect(luminance(tokenHex(match[1])), `${name} ${rule.selector} ${match[1]}`).toBeGreaterThanOrEqual(0.6);
        }
      }
    }
  });

  it("the focus indicator pairs a --text-body outline with an --electric ring", () => {
    const global = ALL_CSS.find((f) => f.name === "global.css")!;
    const rule = parseRules(global.css).find((r) => r.selector === ":focus-visible")!;
    expect(rule).toBeDefined();
    expect(rule.declarations).toContain("var(--text-body)");
    expect(rule.declarations).toContain("var(--electric)");
  });

  it("font-family declarations outside @font-face reference only the three font tokens", () => {
    for (const { name, css } of ALL_CSS) {
      const withoutFaces = stripComments(css).replace(/@font-face\s*\{[^}]*\}/g, "");
      for (const rule of parseRules(withoutFaces)) {
        for (const decl of rule.declarations.split(";")) {
          const match = /^\s*font-family\s*:\s*(.+?)\s*$/.exec(decl);
          if (!match || match[1] === undefined) continue;
          expect(match[1], `${name} ${rule.selector}`).toMatch(/^var\(--font-(display|body|mono)\)$/);
        }
      }
    }
  });

  it("--font-mono is referenced only by code, hash, and terminal surfaces", () => {
    const allowedCss = new Set(["global.css"]);
    for (const { name, css } of ALL_CSS) {
      if (name === "tokens.css") continue; // the definition site
      if (!css.includes("--font-mono")) continue;
      expect(allowedCss.has(name), name).toBe(true);
    }
    const allowedTsx = new Set(["DecisionPanel.tsx", "AuditPanel.tsx"]);
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) out.push(...walk(path));
        else if (path.endsWith(".tsx")) out.push(path);
      }
      return out;
    };
    for (const file of walk(WEB_SRC)) {
      if (!readFileSync(file, "utf8").includes("font-mono")) continue;
      expect(allowedTsx.has(file.split("/").pop()!), file).toBe(true);
    }
  });

  it("reduced-motion handling exists", () => {
    const global = ALL_CSS.find((f) => f.name === "global.css")!;
    expect(global.css).toContain("prefers-reduced-motion: reduce");
    expect(global.css).toContain(".shot");
  });
});
