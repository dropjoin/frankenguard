import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../src/web/src/App.js";
import { baseState, makeMockClient } from "./harness.js";

// Frozen-state theming at the App level: the page frame class, the
// info banner with its explanation line, the info rail on Controls,
// and the FROZEN pill in the header.

describe("frozen theming", () => {
  it("frames the page, shows the blocked banner, and rails Controls when frozen", async () => {
    const client = makeMockClient({ getState: async () => baseState({ frozen: true }) });
    const { container } = render(<App client={client} />);
    await waitFor(() => expect(document.querySelector(".panels-grid")).not.toBeNull());
    expect(container.querySelector(".page-frozen")).not.toBeNull();
    expect(screen.getByText("All payments are blocked.")).toBeInTheDocument();
    expect(document.querySelector(".frozen-explainer")?.textContent).toContain("freeze switch is on");
    expect(document.querySelector(".controls-frozen")).not.toBeNull();
    expect(screen.getByText("FROZEN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Frozen system/ })).toBeEnabled();
  });

  it("shows none of the frozen treatment when unfrozen", async () => {
    const client = makeMockClient({ getState: async () => baseState({ frozen: false }) });
    const { container } = render(<App client={client} />);
    await waitFor(() => expect(document.querySelector(".panels-grid")).not.toBeNull());
    expect(container.querySelector(".page-frozen")).toBeNull();
    expect(screen.queryByText("All payments are blocked.")).toBeNull();
    expect(document.querySelector(".controls-frozen")).toBeNull();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Frozen system/ })).toBeDisabled();
  });
});
