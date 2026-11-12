import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentPanel } from "../../src/web/src/components/AgentPanel.js";
import { ApiError } from "../../src/web/src/api.js";
import { approvedProposal, baseState, invalidProposal, makeMockClient, renderWithClient } from "./harness.js";

function renderAgent(state = baseState(), client = makeMockClient(), onAgentRun = vi.fn(), onManualSubmit = vi.fn()) {
  return {
    ...renderWithClient(
      <AgentPanel onAgentRun={onAgentRun} onManualSubmit={onManualSubmit} state={state} />,
      client,
    ),
    client,
    onAgentRun,
    onManualSubmit,
  };
}

describe("scenario buttons", () => {
  it("runs a scenario through the store and reports the proposal ids", async () => {
    const { client, onAgentRun } = renderAgent();
    fireEvent.click(screen.getByRole("button", { name: /Happy path/ }));
    await waitFor(() => expect(vi.mocked(client.runAgent)).toHaveBeenCalledWith({ scenario: "happy_path" }));
    expect(onAgentRun).toHaveBeenCalledWith([approvedProposal().proposalId]);
  });

  it("disables the frozen scenario until freeze is on, with a visible hint", () => {
    const { unmount } = renderAgent(baseState({ frozen: false }));
    const frozenButton = screen.getByRole("button", { name: /Frozen system/ });
    expect(frozenButton).toBeDisabled();
    expect(screen.getByText(/Turn the freeze switch on in Controls/)).toBeInTheDocument();
    unmount();
    renderAgent(baseState({ frozen: true }));
    expect(screen.getByRole("button", { name: /Frozen system/ })).toBeEnabled();
    expect(screen.queryByText(/Turn the freeze switch on in Controls/)).toBeNull();
  });

  it("disables all scenario buttons while a run is in flight", async () => {
    let resolveRun: (value: unknown) => void = () => {};
    const client = makeMockClient({
      runAgent: () => new Promise((resolve) => { resolveRun = resolve; }) as never,
    });
    renderAgent(baseState(), client);
    fireEvent.click(screen.getByRole("button", { name: /Happy path/ }));
    expect(screen.getByRole("button", { name: /Over per-transaction cap/ })).toBeDisabled();
    resolveRun({ agentMode: "scripted", proposals: [approvedProposal()] });
    await waitFor(() => expect(screen.getByRole("button", { name: /Over per-transaction cap/ })).toBeEnabled());
  });

  it("shows a notice when the live agent falls back to scripted", async () => {
    const client = makeMockClient({
      runAgent: async () => ({ agentMode: "scripted_fallback", proposals: [approvedProposal()] }),
    });
    renderAgent(baseState(), client);
    fireEvent.click(screen.getByRole("button", { name: /Happy path/ }));
    expect(await screen.findByText(/live agent failed/)).toBeInTheDocument();
  });
});

describe("live prompt", () => {
  it("stays off in scripted mode, with an honest note", () => {
    renderAgent(baseState({ agentMode: "scripted" }));
    expect(screen.queryByLabelText(/Ask the agent to propose/)).toBeNull();
    expect(screen.getByText(/live agent is disabled in this demo/)).toBeInTheDocument();
  });

  it("runs a prompt in live mode and requires non-empty text", async () => {
    const client = makeMockClient();
    renderAgent(baseState({ agentMode: "live" }), client);
    const box = screen.getByLabelText(/Ask the agent to propose/);
    fireEvent.click(screen.getByRole("button", { name: "Ask the agent" }));
    expect(await screen.findByText(/Describe the payment/)).toBeInTheDocument();
    fireEvent.change(box, { target: { value: "Pay $40 to Acme Corp" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask the agent" }));
    await waitFor(() =>
      expect(vi.mocked(client.runAgent)).toHaveBeenCalledWith({ prompt: "Pay $40 to Acme Corp" }),
    );
  });
});

describe("manual proposal form", () => {
  function fillForm(recipient: string, amount: string, memo = "") {
    fireEvent.change(screen.getByLabelText("Recipient"), { target: { value: recipient } });
    fireEvent.change(screen.getByLabelText("Amount (USD)"), { target: { value: amount } });
    fireEvent.change(screen.getByLabelText("Memo (optional)"), { target: { value: memo } });
  }

  it("converts dollars to integer cents without float error", async () => {
    const client = makeMockClient();
    renderAgent(baseState(), client);
    fillForm("acme-corp", "19.99", "supplies");
    fireEvent.click(screen.getByRole("button", { name: "Propose payment" }));
    await waitFor(() =>
      expect(vi.mocked(client.submitProposal)).toHaveBeenCalledWith({
        recipient: "acme-corp",
        amountCents: 1999,
        currency: "USD",
        memo: "supplies",
      }),
    );
  });

  it("rejects bad amounts client-side with a field message, without calling the server", () => {
    const client = makeMockClient();
    renderAgent(baseState(), client);
    fillForm("acme-corp", "19.999");
    fireEvent.click(screen.getByRole("button", { name: "Propose payment" }));
    expect(screen.getByText(/more than two decimal places/)).toBeInTheDocument();
    expect(vi.mocked(client.submitProposal)).not.toHaveBeenCalled();
  });

  it("rejects an empty recipient client-side", () => {
    const client = makeMockClient();
    renderAgent(baseState(), client);
    fillForm("", "10.00");
    fireEvent.click(screen.getByRole("button", { name: "Propose payment" }));
    expect(screen.getByText("Recipient is required.")).toBeInTheDocument();
    expect(vi.mocked(client.submitProposal)).not.toHaveBeenCalled();
  });

  it("disables the submit button while a proposal is in flight", async () => {
    let resolveSubmit: (value: unknown) => void = () => {};
    const client = makeMockClient({
      submitProposal: () => new Promise((resolve) => { resolveSubmit = resolve; }) as never,
    });
    renderAgent(baseState(), client);
    fillForm("acme-corp", "10.00");
    fireEvent.click(screen.getByRole("button", { name: "Propose payment" }));
    expect(screen.getByRole("button", { name: "Proposing…" })).toBeDisabled();
    resolveSubmit(approvedProposal());
    await waitFor(() => expect(screen.getByRole("button", { name: "Propose payment" })).toBeEnabled());
  });

  it("renders a field-check notice when the server returns INVALID_PROPOSAL", async () => {
    const client = makeMockClient({ submitProposal: async () => invalidProposal() });
    const { onManualSubmit } = renderAgent(baseState(), client);
    fillForm("acme-corp", "10.00");
    fireEvent.click(screen.getByRole("button", { name: "Propose payment" }));
    expect(await screen.findByText(/rejected this proposal as invalid/)).toBeInTheDocument();
    expect(onManualSubmit).toHaveBeenCalledOnce();
  });

  it("shows the error notice when submission fails", async () => {
    const client = makeMockClient({
      submitProposal: async () => {
        throw new ApiError("RATE_LIMITED", 429, "slow down", 30);
      },
    });
    renderAgent(baseState(), client);
    fillForm("acme-corp", "10.00");
    fireEvent.click(screen.getByRole("button", { name: "Propose payment" }));
    expect(await screen.findByText(/Too many requests/)).toBeInTheDocument();
  });

  it("clears the agent badge set on manual submit", async () => {
    const { onManualSubmit } = renderAgent();
    fillForm("acme-corp", "10.00");
    fireEvent.click(screen.getByRole("button", { name: "Propose payment" }));
    await waitFor(() => expect(onManualSubmit).toHaveBeenCalledOnce());
  });
});
