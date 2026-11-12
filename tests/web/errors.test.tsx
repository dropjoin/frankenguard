import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError, SandboxExpiredError } from "../../src/web/src/api.js";
import { ErrorNotice } from "../../src/web/src/components/ErrorNotice.js";

describe("ErrorNotice", () => {
  it("offers a fresh sandbox for an expired session, in a warning banner", () => {
    const onFreshSandbox = vi.fn();
    const { container } = render(<ErrorNotice error={new SandboxExpiredError()} onFreshSandbox={onFreshSandbox} />);
    expect(container.querySelector(".banner-warning")).not.toBeNull();
    expect(screen.getByText(/sandbox expired/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start a new sandbox" }));
    expect(onFreshSandbox).toHaveBeenCalledOnce();
  });

  it("shows the retry-after wait for rate limits, in a warning banner", () => {
    const onRetry = vi.fn();
    const { container } = render(
      <ErrorNotice error={new ApiError("RATE_LIMITED", 429, "slow down", 30)} onRetry={onRetry} />,
    );
    expect(container.querySelector(".banner-warning")).not.toBeNull();
    expect(screen.getByText(/Try again in 30 seconds/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows a warning banner without a wait when no Retry-After was sent", () => {
    render(<ErrorNotice error={new ApiError("RATE_LIMITED", 429, "slow down")} onRetry={() => {}} />);
    expect(screen.getByText("Too many requests too fast.")).toBeInTheDocument();
  });

  it("prompts a reset when the sandbox limit is reached", () => {
    const onFreshSandbox = vi.fn();
    const { container } = render(
      <ErrorNotice
        error={new ApiError("SANDBOX_LIMIT_REACHED", 429, "limit reached")}
        onFreshSandbox={onFreshSandbox}
      />,
    );
    expect(container.querySelector(".banner-warning")).not.toBeNull();
    expect(screen.getByText(/hit its limit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a new sandbox" })).toBeInTheDocument();
  });

  it("shows an error banner for audit outages, stating nothing executed", () => {
    const { container } = render(
      <ErrorNotice error={new ApiError("AUDIT_UNAVAILABLE", 503, "audit down")} onRetry={() => {}} />,
    );
    expect(container.querySelector(".banner-error")).not.toBeNull();
    expect(screen.getByText(/nothing was executed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows an error banner for network failures", () => {
    const { container } = render(<ErrorNotice error={new TypeError("fetch failed")} onRetry={() => {}} />);
    expect(container.querySelector(".banner-error")).not.toBeNull();
    expect(screen.getByText(/Could not reach the server/)).toBeInTheDocument();
  });

  it("shows the server message for other API errors", () => {
    render(<ErrorNotice error={new ApiError("INVALID_INPUT", 422, "caps: bad value")} onRetry={() => {}} />);
    expect(screen.getByText("caps: bad value")).toBeInTheDocument();
  });
});
