import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Purity guard (R2.3): the engine must not import storage, services,
// agents, or API code, must not touch Node I/O builtins, and must not
// reference the clock, randomness, or fetch. The checker below is the
// enforcement; the fixture test proves it bites, so a green run on the
// real code means something.

const FORBIDDEN_IMPORT_PREFIXES = ["../db/", "../services/", "../agents/", "../api/"];
const NODE_BUILTINS = new Set([
  "fs",
  "fs/promises",
  "path",
  "crypto",
  "http",
  "https",
  "net",
  "os",
  "child_process",
  "worker_threads",
]);

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function checkEngineSource(source: string): string[] {
  const violations: string[] = [];
  const code = stripComments(source);

  const importRe = /(?:import\s+[^'"]*?from\s+|require\(\s*)["']([^"']+)["']/g;
  for (const match of code.matchAll(importRe)) {
    const specifier = match[1] ?? "";
    if (specifier.startsWith("node:") || NODE_BUILTINS.has(specifier)) {
      violations.push(`node builtin import: ${specifier}`);
    }
    if (FORBIDDEN_IMPORT_PREFIXES.some((prefix) => specifier.startsWith(prefix))) {
      violations.push(`forbidden layer import: ${specifier}`);
    }
  }
  if (/\bDate\b/.test(code)) violations.push("references Date");
  if (/Math\.random/.test(code)) violations.push("references Math.random");
  if (/\bfetch\s*\(/.test(code)) violations.push("references fetch");
  if (/\bprocess\./.test(code)) violations.push("references process");
  return violations;
}

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFiles(path));
    else if (entry.name.endsWith(".ts")) out.push(path);
  }
  return out;
}

describe("engine purity guard", () => {
  it("passes on the real engine code", () => {
    const engineDir = fileURLToPath(new URL("../../src/engine", import.meta.url));
    const files = listTsFiles(engineDir);
    expect(files.length).toBeGreaterThan(0);
    const problems: string[] = [];
    for (const file of files) {
      for (const violation of checkEngineSource(readFileSync(file, "utf8"))) {
        problems.push(`${file}: ${violation}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("fails on a deliberately impure fixture", () => {
    const dir = mkdtempSync(join(tmpdir(), "fg-purity-"));
    try {
      const bad = join(dir, "bad.ts");
      writeFileSync(
        bad,
        [
          'import { readFileSync } from "node:fs";',
          'import { openDb } from "../db/migrate.js";',
          "export const t = Date.now();",
          "export const r = Math.random();",
          "export const p = fetch('/x');",
          "",
        ].join("\n"),
      );
      const violations = checkEngineSource(readFileSync(bad, "utf8"));
      expect(violations).toContain("node builtin import: node:fs");
      expect(violations).toContain("forbidden layer import: ../db/migrate.js");
      expect(violations).toContain("references Date");
      expect(violations).toContain("references Math.random");
      expect(violations).toContain("references fetch");

      const good = join(dir, "good.ts");
      writeFileSync(good, "export function add(a: number, b: number): number {\n  return a + b;\n}\n");
      expect(checkEngineSource(readFileSync(good, "utf8"))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
