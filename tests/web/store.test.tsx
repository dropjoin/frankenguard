import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "../../src/web/src/App.js";
import { SandboxExpiredError, type FrankenguardApi } from "../../src/web/src/api.js";
import type { StateResponse } from "../../src/shared/types.js";

// Store states with a mocked client: loading, first-visit sandbox
// creation, error with retry, and the expired-sandbox offer. The
// SIMULATED MONEY ONLY banner is asserted in every state: it is
// always rendered.

const READY_STATE: StateResponse = {
  sandboxId: "sandbox-1",
  configVersion: 1,
  perTxCapCents: 50_000,
  dailyCapCents: 100_000,
  frozen: false,
  allowlist: [{ key: "acme-corp", label: "Acme Corp" }],
  dailySpentCents: 0,
  dailyRemainingCents: 100_000,
  windowStart: "2026-11-13T00:00:00.000Z",
  windowEnd: "2026-11-14T00:00:00.000Z",
  proposalCount: 0,
  paymentCount: 0,
  paymentTotalCents: 0,
  recentProposals: [],
  agentMode: "scripted",
  auditHead: { entries: 1, headHash: "abc" },
};

function mockClient(overrides: Partial<FrankenguardApi> = {}): FrankenguardApi {
  return {
    createSandbox: vi.fn(async () => ({ sandboxId: "sandbox-1" })),
    resetSandbox: vi.fn(async () => ({ sandboxId: "sandbox-2" })),
    getState: vi.fn(async () => READY_STATE),
    submitProposal: vi.fn(),
    getProposal: vi.fn(),
    updateCaps: vi.fn(),
    addRecipient: vi.fn(),
    removeRecipient: vi.fn(),
    setFrozen: vi.fn(),
    listAudit: vi.fn(),
    verifyAudit: vi.fn(),
    ...overrides,
  } as FrankenguardApi;
}

describe("App store states", () => {
  it("shows the loading state while state is pending", async () => {
    const client = mockClient({ getState: vi.fn(() => new Promise<StateResponse>(() => {})) });
    render(<App client={client} />);
    expect(await screen.findByText("Opening your sandbox…")).toBeInTheDocument();
    expect(screen.getByText(/SIMULATED MONEY ONLY/)).toBeInTheDocument();
  });

  it("creates a sandbox on first visit when no cookie exists, then renders ready", async () => {
    const getState = vi.fn(async () => READY_STATE).mockRejectedValueOnce(new SandboxExpiredError());
    const client = mockClient({ getState });
    render(<App client={client} />);
    await waitFor(() => expect(document.querySelector(".panels-grid")).not.toBeNull());
    expect(client.createSandbox).toHaveBeenCalledOnce();
    expect(screen.getByText(/SIMULATED MONEY ONLY/)).toBeInTheDocument();
  });

  it("shows the error state with a retry button when loading fails", async () => {
    const client = mockClient({ getState: vi.fn(async () => { throw new Error("network down"); }) });
    render(<App client={client} />);
    expect(await screen.findByText("network down")).toBeInTheDocument();
    expect(screen.getByText(/SIMULATED MONEY ONLY/)).toBeInTheDocument();
    const getState = client.getState as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(getState).toHaveBeenCalledTimes(2));
  });

  it("offers a fresh sandbox when the session expires mid-visit", async () => {
    const getState = vi.fn(async () => READY_STATE);
    const client = mockClient({ getState });
    render(<App client={client} />);
    await waitFor(() => expect(document.querySelector(".panels-grid")).not.toBeNull());
    // The session dies: the next refresh gets a 401.
    getState.mockRejectedValueOnce(new SandboxExpiredError());
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    // Reset calls resetSandbox (mocked OK) then refresh, which 401s.
    expect(await screen.findByText(/Your sandbox expired/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a new sandbox" })).toBeInTheDocument();
    expect(screen.getByText(/SIMULATED MONEY ONLY/)).toBeInTheDocument();
  });

  it("starting a fresh sandbox from the expired state recovers to ready", async () => {
    const getState = vi.fn(async () => READY_STATE);
    const client = mockClient({ getState });
    render(<App client={client} />);
    await waitFor(() => expect(document.querySelector(".panels-grid")).not.toBeNull());
    getState.mockRejectedValueOnce(new SandboxExpiredError());
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(await screen.findByText(/Your sandbox expired/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start a new sandbox" }));
    await waitFor(() => expect(document.querySelector(".panels-grid")).not.toBeNull());
    expect(client.createSandbox).toHaveBeenCalled();
  });
});
