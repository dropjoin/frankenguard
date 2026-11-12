import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DecisionPanel } from "../../src/web/src/components/DecisionPanel.js";
import {
  approvedProposal,
  baseState,
  blockedProposal,
  invalidProposal,
  makeMockClient,
  proposalBundle,
  renderWithClient,
} from "./harness.js";

const RULE_LABELS_IN_ORDER = ["Freeze switch", "Recipient allowlist", "Per-transaction cap", "Daily cap"];

function renderDecisions(
  state = baseState({ recentProposals: [blockedProposal(), approvedProposal(), invalidProposal()] }),
  client = makeMockClient(),
  extra: { agentIds?: ReadonlySet<string>; ghostState?: "idle" | "approved" | "blocked" | "frozen" | "verified" } = {},
) {
  const onSelect = vi.fn();
  const utils = renderWithClient(
    <DecisionPanel
      agentProposalIds={extra.agentIds ?? new Set()}
      ghostState={extra.ghostState ?? "blocked"}
      onSelect={onSelect}
      selectedId={null}
      state={state}
    />,
    client,
  );
  return { ...utils, client, onSelect };
}

describe("decision cards", () => {
  it("renders all four rule rows in fixed order for approved and blocked cards", () => {
    const { container } = renderDecisions();
    const cards = container.querySelectorAll(".decision-card");
    expect(cards).toHaveLength(3);
    for (const card of [cards[0], cards[1]]) {
      const labels = [...card!.querySelectorAll(".rule-row-label")].map((el) => el.textContent);
      expect(labels).toEqual(RULE_LABELS_IN_ORDER);
    }
  });

  it("pairs every rule row with an icon and a text message", () => {
    const { container } = renderDecisions();
    const rows = container.querySelectorAll(".rule-row");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelector(".rule-badge")).not.toBeNull();
      expect(row.querySelector(".rule-message")?.textContent?.length).toBeGreaterThan(0);
    }
  });

  it("shows the blocked copy and the failing reason on blocked cards", () => {
    renderDecisions();
    expect(screen.getByText("Caught by FrankenGuard!")).toBeInTheDocument();
    expect(screen.getByText(/Failed on Recipient not allowed/)).toBeInTheDocument();
  });

  it("shows reason codes in mono for every rule", () => {
    const { container } = renderDecisions();
    const codes = [...container.querySelectorAll(".reason-code")].map((el) => el.textContent);
    expect(codes).toContain("RECIPIENT_NOT_ALLOWED");
    expect(codes).toContain("PER_TX_CAP_EXCEEDED");
    expect(codes).toContain("WITHIN_DAILY_CAP");
  });

  it("renders the decision-level note for INVALID_PROPOSAL with no rule rows", () => {
    const { container } = renderDecisions();
    const cards = container.querySelectorAll(".decision-card");
    const invalidCard = cards[2]!;
    expect(invalidCard.querySelectorAll(".rule-row")).toHaveLength(0);
    expect(within(invalidCard as HTMLElement).getByText(/No rule ran for this proposal/)).toBeInTheDocument();
    expect(within(invalidCard as HTMLElement).getByText("INVALID_PROPOSAL")).toBeInTheDocument();
  });

  it("marks proposals from the last agent run with the agent badge", () => {
    renderDecisions(baseState({ recentProposals: [approvedProposal()] }), makeMockClient(), {
      agentIds: new Set([approvedProposal().proposalId]),
    });
    expect(screen.getByText("Agent proposal")).toBeInTheDocument();
  });

  it("announces the latest decision through the aria-live region", () => {
    const { container } = renderDecisions();
    const live = container.querySelector("[aria-live]");
    expect(live?.textContent).toContain("Latest decision: blocked");
    expect(live?.textContent).toContain("Recipient not allowed");
  });

  it("lights the four lab stamps for the latest decision", () => {
    const { container } = renderDecisions();
    const stamps = container.querySelectorAll(".stamp");
    expect([...stamps].map((el) => el.textContent)).toEqual(["Freeze", "Allowlist", "Per-tx", "Daily"]);
    expect(stamps[0]).toHaveClass("stamp-pass");
    expect(stamps[1]).toHaveClass("stamp-fail");
    expect(stamps[0]).toHaveClass("stamp-lit");
  });

  it("shows the empty state when no decisions exist", () => {
    renderDecisions(baseState({ recentProposals: [] }));
    expect(screen.getByText("The monster is sleeping.")).toBeInTheDocument();
  });

  it("calls onSelect when a card header is toggled", () => {
    const { onSelect } = renderDecisions();
    const toggles = screen.getAllByRole("button", { expanded: false });
    fireEvent.click(toggles[0]!);
    expect(onSelect).toHaveBeenCalledWith(blockedProposal().proposalId);
  });
});

describe("proposal detail and agent text", () => {
  it("loads and shows the bundle when a card is selected", async () => {
    const client = makeMockClient();
    const onSelect = vi.fn();
    renderWithClient(
      <DecisionPanel
        agentProposalIds={new Set()}
        ghostState="approved"
        onSelect={onSelect}
        selectedId={approvedProposal().proposalId}
        state={baseState({ recentProposals: [approvedProposal()] })}
      />,
      client,
    );
    expect(await screen.findByText("acme-corp")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("Office supplies")).toBeInTheDocument();
  });

  it("renders hostile agent text as literal text, creating no DOM elements", async () => {
    const evilMemo = '<img src=x onerror=alert(1)> <script>alert(2)</script>';
    const client = makeMockClient({
      getProposal: async () => proposalBundle({ memo: evilMemo }),
    });
    const { container } = renderWithClient(
      <DecisionPanel
        agentProposalIds={new Set()}
        ghostState="approved"
        onSelect={() => {}}
        selectedId={approvedProposal().proposalId}
        state={baseState({ recentProposals: [approvedProposal()] })}
      />,
      client,
    );
    expect(await screen.findByText(evilMemo)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });
});
