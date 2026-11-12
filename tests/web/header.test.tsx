import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HeaderBand } from "../../src/web/src/components/HeaderBand.js";

describe("HeaderBand", () => {
  it("renders the wordmark, tagline, ghost, and agent badge", () => {
    render(<HeaderBand agentMode="scripted" frozen={false} onReset={() => {}} />);
    expect(screen.getByText("FrankenGuard")).toBeInTheDocument();
    expect(screen.getByText("An agent proposes. Old rules dispose.")).toBeInTheDocument();
    expect(document.querySelector("header svg")).not.toBeNull();
    expect(screen.getByText("SCRIPTED AGENT")).toBeInTheDocument();
  });

  it("shows the ACTIVE pill when unfrozen and the FROZEN pill when frozen", () => {
    const { rerender } = render(<HeaderBand agentMode="scripted" frozen={false} onReset={() => {}} />);
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    rerender(<HeaderBand agentMode="scripted" frozen onReset={() => {}} />);
    expect(screen.getByText("FROZEN")).toBeInTheDocument();
    expect(screen.queryByText("ACTIVE")).toBeNull();
  });

  it("shows the LIVE AGENT badge in live mode", () => {
    render(<HeaderBand agentMode="live" frozen={false} onReset={() => {}} />);
    expect(screen.getByText("LIVE AGENT")).toBeInTheDocument();
  });

  it("calls onReset from the Reset button, and disables it while loading", () => {
    const onReset = vi.fn();
    const { rerender } = render(<HeaderBand agentMode="scripted" frozen={false} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(onReset).toHaveBeenCalledOnce();
    rerender(<HeaderBand agentMode="scripted" frozen={false} onReset={onReset} resetDisabled />);
    expect(screen.getByRole("button", { name: "Reset demo" })).toBeDisabled();
  });
});
