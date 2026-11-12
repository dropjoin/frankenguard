import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DecisionPanel } from "../../src/web/src/components/DecisionPanel.js";
import { approvedProposal, baseState, blockedProposal, makeMockClient, renderWithClient } from "./harness.js";

// Motion caps, checked against the actual CSS: decision entrance at
// most 250ms, freeze wipe at most 500ms, sparks and stamps at most
// 400ms. Reduced motion disables everything through the universal
// rule in global.css, so the final state always renders.

const THEME_DIR = join(process.cwd(), "src/web/src/theme");

function durationsIn(css: string): number[] {
  return [...css.matchAll(/(\d+(?:\.\d+)?)ms/g)].map((m) => Number(m[1]));
}

describe("motion durations", () => {
  it("keeps the decision entrance at or under 250ms", () => {
    const motion = readFileSync(join(THEME_DIR, "motion.css"), "utf8");
    const entrance = /\.decision-card-enter\s*\{[^}]*\}/.exec(motion)?.[0] ?? "";
    for (const ms of durationsIn(entrance)) expect(ms).toBeLessThanOrEqual(250);
    expect(entrance).toContain("decision-in");
  });

  it("keeps the blocked wiggle at or under 400ms", () => {
    const motion = readFileSync(join(THEME_DIR, "motion.css"), "utf8");
    const wiggle = /\.decision-card-blocked-enter\s*\{[^}]*\}/.exec(motion)?.[0] ?? "";
    for (const ms of durationsIn(wiggle)) expect(ms).toBeLessThanOrEqual(400);
    expect(wiggle).toContain("blocked-wiggle");
  });

  it("keeps the freeze frame-wipe at or under 500ms", () => {
    const layout = readFileSync(join(THEME_DIR, "layout.css"), "utf8");
    const wipe = /\.page-frozen::after\s*\{[^}]*\}/.exec(layout)?.[0] ?? "";
    for (const ms of durationsIn(wipe)) expect(ms).toBeLessThanOrEqual(500);
    expect(wipe).toContain("frame-wipe");
  });

  it("keeps stamps and sparks at or under 400ms", () => {
    const motion = readFileSync(join(THEME_DIR, "motion.css"), "utf8");
    for (const selector of [/\.stamp-lit\s*\{[^}]*\}/, /\.verify-sparks \.bolt-icon\s*\{[^}]*\}/]) {
      const block = selector.exec(motion)?.[0] ?? "";
      expect(block).not.toBe("");
      for (const ms of durationsIn(block)) expect(ms).toBeLessThanOrEqual(400);
    }
  });

  it("disables all motion under prefers-reduced-motion", () => {
    const global = readFileSync(join(THEME_DIR, "global.css"), "utf8");
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/.exec(global)?.[0] ?? "";
    expect(block).toContain("animation-duration: 0.01ms");
    expect(block).toContain("transition-duration: 0.01ms");
  });
});

describe("motion classes", () => {
  it("applies the entrance class to the latest card and the wiggle to a blocked latest card", () => {
    const { container, unmount } = renderWithClient(
      <DecisionPanel
        agentProposalIds={new Set()}
        ghostState="approved"
        onSelect={() => {}}
        selectedId={null}
        state={baseState({ recentProposals: [approvedProposal()] })}
      />,
      makeMockClient(),
    );
    expect(container.querySelector(".decision-card-enter")).not.toBeNull();
    expect(container.querySelector(".decision-card-blocked-enter")).toBeNull();
    unmount();
    const blocked = renderWithClient(
      <DecisionPanel
        agentProposalIds={new Set()}
        ghostState="blocked"
        onSelect={() => {}}
        selectedId={null}
        state={baseState({ recentProposals: [blockedProposal()] })}
      />,
      makeMockClient(),
    );
    expect(blocked.container.querySelector(".decision-card-blocked-enter")).not.toBeNull();
  });

  it("staggers the stamp sequence with increasing delays", () => {
    const { container } = renderWithClient(
      <DecisionPanel
        agentProposalIds={new Set()}
        ghostState="blocked"
        onSelect={() => {}}
        selectedId={null}
        state={baseState({ recentProposals: [blockedProposal()] })}
      />,
      makeMockClient(),
    );
    const delays = [...container.querySelectorAll(".stamp-lit")].map((el) =>
      (el as HTMLElement).style.animationDelay,
    );
    expect(delays).toEqual(["0ms", "90ms", "180ms", "270ms"]);
  });
});
