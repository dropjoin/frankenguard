import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Bolt, GhostMascot, JackOLantern, MonsterHead, Snowflake, StitchBorder, SutureDivider, type GhostState } from "../../src/web/src/components/art/index.js";

describe("GhostMascot", () => {
  const states: GhostState[] = ["idle", "approved", "blocked", "frozen", "verified"];
  it.each(states)("renders the %s state as decorative SVG", (state) => {
    const { container } = render(<GhostMascot state={state} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("matches snapshots for every state", () => {
    for (const state of states) {
      const { container } = render(<GhostMascot state={state} />);
      expect(container.firstChild).toMatchSnapshot(state);
    }
  });

  it("renders a distinct badge for blocked and verified", () => {
    const blocked = render(<GhostMascot state="blocked" />).container.innerHTML;
    const verified = render(<GhostMascot state="verified" />).container.innerHTML;
    expect(blocked).toContain("var(--pumpkin)");
    expect(verified).toContain("var(--success)");
    expect(blocked).not.toBe(verified);
  });
});

describe("art kit", () => {
  it("renders the monster head, bolt, divider, icons, and stitch border", () => {
    const { container } = render(
      <div>
        <MonsterHead />
        <Bolt />
        <SutureDivider />
        <JackOLantern />
        <Snowflake />
        <StitchBorder>stitched</StitchBorder>
      </div>,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(5);
    expect(container.textContent).toContain("stitched");
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("matches a snapshot for the monster head", () => {
    const { container } = render(<MonsterHead />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("keeps total art weight under 60 KB", () => {
    const artDir = join(process.cwd(), "src/web/src/components/art");
    const favicon = join(process.cwd(), "src/web/public/favicon.svg");
    let total = statSync(favicon).size;
    for (const file of readdirSync(artDir)) {
      total += statSync(join(artDir, file)).size;
    }
    expect(total).toBeLessThan(60 * 1024);
  });

  it("uses only token colors in SVG fills and strokes (no raw hex in art sources)", () => {
    const artDir = join(process.cwd(), "src/web/src/components/art");
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
    for (const file of readdirSync(artDir)) {
      const source = readFileSync(join(artDir, file), "utf8");
      expect(source.match(hexPattern), file).toBeNull();
    }
    // Every fill/stroke value is a token var, currentColor, or none.
    const { container } = render(
      <div>
        <GhostMascot state="verified" />
        <MonsterHead />
        <Bolt />
        <JackOLantern />
        <Snowflake />
      </div>,
    );
    for (const el of container.querySelectorAll("[fill], [stroke]")) {
      for (const attr of ["fill", "stroke"]) {
        const value = el.getAttribute(attr);
        if (value === null) continue;
        expect(value, `${el.tagName} ${attr}`).toMatch(/^(var\(--[\w-]+\)|currentColor|none)$/);
      }
    }
  });
});
