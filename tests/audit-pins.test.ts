import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Pins for audit fixes that live in files, not code. Each assertion
// names the finding it guards so a future edit that reopens one
// fails loudly here instead of silently at deploy time.

function repoFile(name: string): string {
  return readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");
}

describe("audit pins", () => {
  it("L7: .dockerignore excludes local env files, keeping the .env.example exception", () => {
    const lines = repoFile(".dockerignore")
      .split("\n")
      .map((line) => line.trim());
    expect(lines).toContain(".env");
    expect(lines).toContain(".env.*");
    expect(lines).toContain("!.env.example");
  });
});
