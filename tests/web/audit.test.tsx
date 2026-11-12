import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuditPanel } from "../../src/web/src/components/AuditPanel.js";
import { auditEntry, baseState, makeMockClient, renderWithClient } from "./harness.js";

function entriesFixture(count: number) {
  return Array.from({ length: count }, (_, i) =>
    auditEntry(i + 1, {
      type: i % 3 === 0 ? "DECISION_MADE" : i % 3 === 1 ? "PAYMENT_EXECUTED" : "PROPOSAL_RECEIVED",
      payload:
        i % 3 === 0
          ? { outcome: i % 2 === 0 ? "APPROVED" : "REJECTED", reason: "APPROVED" }
          : { recipient: "acme-corp", amountCents: 10_000 },
    }),
  );
}

function renderAudit(
  state = baseState(),
  client = makeMockClient({ listAudit: async () => ({ entries: entriesFixture(6), nextAfterSeq: null }) }),
  extra: { selectedId?: string | null; onVerified?: (ok: boolean) => void } = {},
) {
  const onSelect = vi.fn();
  const onVerified = extra.onVerified ?? vi.fn();
  const utils = renderWithClient(
    <AuditPanel onSelect={onSelect} onVerified={onVerified} selectedId={extra.selectedId ?? null} state={state} />,
    client,
  );
  return { ...utils, client, onSelect, onVerified };
}

describe("timeline", () => {
  it("loads entries on mount and renders type chips", async () => {
    const { container } = renderAudit();
    expect(await screen.findByText("Decision · Approved")).toBeInTheDocument();
    expect(screen.getAllByText("Payment")).toHaveLength(2);
    expect(screen.getAllByText("Received")).toHaveLength(2);
    expect(container.querySelectorAll(".audit-entry")).toHaveLength(6);
  });

  it("shows the empty state when the log is empty", async () => {
    renderAudit(baseState(), makeMockClient({ listAudit: async () => ({ entries: [], nextAfterSeq: null }) }));
    expect(await screen.findByText("No receipts yet.")).toBeInTheDocument();
  });

  it("places a support ghost after every fifth timeline line", async () => {
    const { container } = renderAudit();
    await screen.findByText("Decision · Approved");
    expect(container.querySelectorAll(".audit-ghost")).toHaveLength(1);
  });

  it("highlights entries linked to the selected proposal", async () => {
    const { container } = renderAudit(baseState(), undefined, { selectedId: "01K9APPROVED000000000001" });
    await screen.findByText("Decision · Approved");
    expect(container.querySelectorAll(".audit-entry-linked")).toHaveLength(6);
  });

  it("expands a payload in the light terminal block, escaped as text", async () => {
    const evil = auditEntry(1, { payload: { memo: "<script>alert(1)</script>", nested: { a: 1 } } });
    const { container } = renderAudit(
      baseState(),
      makeMockClient({ listAudit: async () => ({ entries: [evil], nextAfterSeq: null }) }),
    );
    await screen.findByText("Received");
    fireEvent.click(screen.getByRole("button", { name: "Show payload" }));
    const block = container.querySelector(".terminal-block");
    expect(block?.textContent).toContain("<script>alert(1)</script>");
    expect(container.querySelector("script")).toBeNull();
  });

  it("marks an entry whose payload could not be parsed, and says so instead of showing an empty payload", async () => {
    const corrupt = auditEntry(1, { payload: {}, payloadParseError: true });
    renderAudit(
      baseState(),
      makeMockClient({ listAudit: async () => ({ entries: [corrupt], nextAfterSeq: null }) }),
    );
    expect(await screen.findByText("Unparseable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show payload" }));
    expect(
      await screen.findByText("This entry's stored payload is not valid JSON, so its contents can't be shown."),
    ).toBeInTheDocument();
  });

  it("loads older entries through the cursor", async () => {
    const client = makeMockClient({
      listAudit: async (query) =>
        query.afterSeq === undefined
          ? { entries: entriesFixture(2), nextAfterSeq: 2 }
          : { entries: [auditEntry(3)], nextAfterSeq: null },
    });
    const { container } = renderAudit(baseState(), client);
    await screen.findByText("Decision · Approved");
    fireEvent.click(screen.getByRole("button", { name: "Load older entries" }));
    await waitFor(() => expect(container.querySelectorAll(".audit-entry")).toHaveLength(3));
    expect(vi.mocked(client.listAudit)).toHaveBeenCalledWith(expect.objectContaining({ afterSeq: 2 }));
  });
});

describe("filters", () => {
  it("calls the API with the outcome filter", async () => {
    const { client } = renderAudit();
    await screen.findByText("Decision · Approved");
    vi.mocked(client.listAudit).mockClear();
    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "REJECTED" } });
    await waitFor(() =>
      expect(vi.mocked(client.listAudit)).toHaveBeenCalledWith(expect.objectContaining({ outcome: "REJECTED" })),
    );
  });

  it("calls the API with the reason code filter", async () => {
    const { client } = renderAudit();
    await screen.findByText("Decision · Approved");
    vi.mocked(client.listAudit).mockClear();
    fireEvent.change(screen.getByLabelText("Reason code"), { target: { value: "DAILY_CAP_EXCEEDED" } });
    await waitFor(() =>
      expect(vi.mocked(client.listAudit)).toHaveBeenCalledWith(
        expect.objectContaining({ code: "DAILY_CAP_EXCEEDED" }),
      ),
    );
  });

  it("calls the API with the recipient filter after Apply", async () => {
    const { client } = renderAudit();
    await screen.findByText("Decision · Approved");
    vi.mocked(client.listAudit).mockClear();
    fireEvent.change(screen.getByLabelText("Recipient"), { target: { value: "globex-corp" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() =>
      expect(vi.mocked(client.listAudit)).toHaveBeenCalledWith(expect.objectContaining({ recipient: "globex-corp" })),
    );
  });
});

describe("verify chain", () => {
  it("renders the intact state with count and head hash, and reports verified", async () => {
    const onVerified = vi.fn();
    const { container } = renderAudit(
      baseState(),
      makeMockClient({
        listAudit: async () => ({ entries: entriesFixture(6), nextAfterSeq: null }),
        verifyAudit: async () => ({ ok: true, entries: 6, headHash: "aabbccddeeff00112233445566778899" }),
      }),
      { onVerified },
    );
    await screen.findByText("Decision · Approved");
    fireEvent.click(screen.getByRole("button", { name: "Verify chain" }));
    expect(await screen.findByText("Chain intact")).toBeInTheDocument();
    expect(screen.getByText(/6 entries verified/)).toBeInTheDocument();
    expect(screen.getByText("aabbccdd…8899")).toBeInTheDocument();
    expect(container.querySelector(".verify-result-ok")).not.toBeNull();
    expect(container.querySelectorAll(".verify-sparks svg")).toHaveLength(2);
    expect(onVerified).toHaveBeenCalledWith(true);
  });

  it("renders the broken state, outlines the offending row, and reports not verified", async () => {
    const onVerified = vi.fn();
    const { container } = renderAudit(
      baseState(),
      makeMockClient({
        listAudit: async () => ({ entries: entriesFixture(6), nextAfterSeq: null }),
        verifyAudit: async () => ({ ok: false, entries: 6, headHash: "deadbeef", brokenAtSeq: 3 }),
      }),
      { onVerified },
    );
    await screen.findByText("Decision · Approved");
    fireEvent.click(screen.getByRole("button", { name: "Verify chain" }));
    expect(await screen.findByText("Chain broken")).toBeInTheDocument();
    expect(screen.getByText(/broke at entry #3/)).toBeInTheDocument();
    expect(container.querySelector(".audit-entry-broken")).not.toBeNull();
    expect(container.querySelector(".torn-stitch")).not.toBeNull();
    expect(onVerified).toHaveBeenCalledWith(false);
  });

  it("states the truncation caveat in the open", async () => {
    renderAudit();
    await screen.findByText("Decision · Approved");
    expect(screen.getByText(/cannot detect entries removed from the end/)).toBeInTheDocument();
  });

  it("offers the proposal link to select an entry's proposal", async () => {
    const { onSelect } = renderAudit();
    await screen.findByText("Decision · Approved");
    const firstEntry = document.querySelector(".audit-entry")!;
    fireEvent.click(within(firstEntry as HTMLElement).getByRole("button", { name: /Proposal / }));
    expect(onSelect).toHaveBeenCalledWith("01K9APPROVED000000000001");
  });
});
