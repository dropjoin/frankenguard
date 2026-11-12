import { describe, expect, it } from "vitest";

describe("scaffold", () => {
  it("runs on Node 20 or newer", () => {
    const major = Number(process.versions.node.split(".")[0]);
    expect(major).toBeGreaterThanOrEqual(20);
  });
});
