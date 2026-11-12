import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ControlsPanel } from "../../src/web/src/components/ControlsPanel.js";
import { ApiError } from "../../src/web/src/api.js";
import { baseState, makeMockClient, renderWithClient } from "./harness.js";

function renderControls(state = baseState(), client = makeMockClient()) {
  return { ...renderWithClient(<ControlsPanel state={state} />, client), client };
}

describe("caps form", () => {
  it("rejects a per-transaction cap larger than the daily cap without calling the server", () => {
    const { client } = renderControls();
    fireEvent.change(screen.getByLabelText("Per-transaction cap (USD)"), { target: { value: "2000.00" } });
    fireEvent.change(screen.getByLabelText("Daily cap (USD)"), { target: { value: "1000.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save caps" }));
    expect(screen.getByText(/cannot be larger than the daily cap/)).toBeInTheDocument();
    expect(vi.mocked(client.updateCaps)).not.toHaveBeenCalled();
  });

  it("saves valid caps in integer cents and refetches state", async () => {
    const { client } = renderControls();
    fireEvent.change(screen.getByLabelText("Per-transaction cap (USD)"), { target: { value: "250.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save caps" }));
    await waitFor(() =>
      expect(vi.mocked(client.updateCaps)).toHaveBeenCalledWith({ perTxCapCents: 25_050, dailyCapCents: 100_000 }),
    );
    expect(await screen.findByText(/Caps saved/)).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(client.getState).mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("shows server validation errors inline", async () => {
    const client = makeMockClient({
      updateCaps: async () => {
        throw new ApiError("INVALID_INPUT", 422, "dailyCapCents: must be positive");
      },
    });
    renderControls(baseState(), client);
    fireEvent.click(screen.getByRole("button", { name: "Save caps" }));
    expect(await screen.findByText(/must be positive/)).toBeInTheDocument();
  });
});

describe("allowlist editor", () => {
  it("adds a recipient with its label", async () => {
    const { client } = renderControls();
    fireEvent.change(screen.getByLabelText("Recipient key"), { target: { value: "new-partner" } });
    fireEvent.change(screen.getByLabelText("Label (optional)"), { target: { value: "New Partner" } });
    fireEvent.click(screen.getByRole("button", { name: "Add recipient" }));
    await waitFor(() =>
      expect(vi.mocked(client.addRecipient)).toHaveBeenCalledWith({ recipient: "new-partner", label: "New Partner" }),
    );
  });

  it("shows duplicate errors inline", async () => {
    const client = makeMockClient({
      addRecipient: async () => {
        throw new ApiError("DUPLICATE_RECIPIENT", 409, "recipient is already on the allowlist");
      },
    });
    renderControls(baseState(), client);
    fireEvent.change(screen.getByLabelText("Recipient key"), { target: { value: "acme-corp" } });
    fireEvent.click(screen.getByRole("button", { name: "Add recipient" }));
    expect(await screen.findByText(/already on the allowlist/)).toBeInTheDocument();
  });

  it("removes a recipient from its chip button", async () => {
    const { client } = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Remove Globex Corp" }));
    await waitFor(() =>
      expect(vi.mocked(client.removeRecipient)).toHaveBeenCalledWith({ recipient: "globex-corp" }),
    );
  });
});

describe("freeze switch", () => {
  it("calls the API and reflects the new state", async () => {
    const { client } = renderControls(baseState({ frozen: false }));
    fireEvent.click(screen.getByRole("switch", { name: "Freeze all payments" }));
    await waitFor(() => expect(vi.mocked(client.setFrozen)).toHaveBeenCalledWith({ frozen: true }));
  });

  it("shows the frozen explanation when frozen", () => {
    renderControls(baseState({ frozen: true }));
    expect(screen.getByText(/Frozen. Every proposal is blocked/)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });
});

describe("meter and countdown", () => {
  it("uses the success fill and caption below 70%", () => {
    const { container } = renderControls(baseState({ dailySpentCents: 10_000 }));
    expect(container.querySelector(".meter-fill-success")).not.toBeNull();
    expect(screen.getByText("Plenty of room left today")).toBeInTheDocument();
  });

  it("uses the warning fill and caption at 70-99%", () => {
    const { container } = renderControls(baseState({ dailySpentCents: 70_000 }));
    expect(container.querySelector(".meter-fill-warning")).not.toBeNull();
    expect(screen.getByText("Approaching the daily cap")).toBeInTheDocument();
  });

  it("uses the error fill and cap-reached caption at 100%", () => {
    const { container } = renderControls(baseState({ dailySpentCents: 100_000 }));
    expect(container.querySelector(".meter-fill-error")).not.toBeNull();
    expect(screen.getByText("Cap reached")).toBeInTheDocument();
  });

  it("shows amounts in the display face with the spent total", () => {
    renderControls(baseState({ dailySpentCents: 25_000 }));
    const amounts = document.querySelector(".meter-amounts");
    expect(amounts?.textContent).toContain("$250.00");
    expect(amounts?.textContent).toContain("$1,000.00");
  });

  it("shows the UTC reset countdown", () => {
    const windowEnd = new Date(Date.now() + 5 * 3_600_000 + 30 * 60_000).toISOString();
    renderControls(baseState({ windowEnd }));
    expect(screen.getByText(/Daily window resets in 5h (29|30)m \(UTC midnight\)/)).toBeInTheDocument();
  });

  it("says the window is resetting once the end has passed", () => {
    renderControls(baseState({ windowEnd: new Date(Date.now() - 1000).toISOString() }));
    expect(screen.getByText(/window is resetting/)).toBeInTheDocument();
  });
});
