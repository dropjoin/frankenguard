import { ApiError, SandboxExpiredError } from "../api.js";
import { Banner, Button } from "./primitives.js";

// ErrorNotice: one mapping from failure to message + action, shared
// by every panel. Warning banners for expired/rate-limited/limited
// sandboxes, error banners for audit outages and network failures.
// Every notice carries a pumpkin action button, never a dead end.

export interface ErrorNoticeAction {
  label: string;
  onClick: () => void;
}

export function describeError(error: unknown): {
  variant: "warning" | "error";
  message: string;
} {
  if (error instanceof SandboxExpiredError) {
    return {
      variant: "warning",
      message:
        "Your sandbox expired. Nothing was lost that mattered: start a fresh one and keep playing.",
    };
  }
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED") {
      const wait =
        error.retryAfterSeconds !== null
          ? ` Try again in ${error.retryAfterSeconds} seconds.`
          : "";
      return { variant: "warning", message: `Too many requests too fast.${wait}` };
    }
    if (error.code === "SANDBOX_LIMIT_REACHED") {
      return {
        variant: "warning",
        message:
          "This sandbox hit its limit for proposals or audit entries. Start a fresh sandbox to continue.",
      };
    }
    if (error.code === "AUDIT_UNAVAILABLE") {
      return {
        variant: "error",
        message:
          "The audit trail is unavailable, so nothing was executed. The ledger is never written without its receipt.",
      };
    }
    return { variant: "error", message: error.message };
  }
  if (error instanceof TypeError) {
    return {
      variant: "error",
      message: "Could not reach the server. Check your connection and try again.",
    };
  }
  return {
    variant: "error",
    message: error instanceof Error ? error.message : "Something went wrong.",
  };
}

export function ErrorNotice({
  error,
  onRetry,
  onFreshSandbox,
}: {
  error: unknown;
  onRetry?: () => void;
  onFreshSandbox?: () => void;
}) {
  const { variant, message } = describeError(error);
  const needsFreshSandbox =
    error instanceof SandboxExpiredError ||
    (error instanceof ApiError && error.code === "SANDBOX_LIMIT_REACHED");
  return (
    <div className="error-notice">
      <Banner variant={variant}>{message}</Banner>
      {needsFreshSandbox && onFreshSandbox ? (
        <Button onClick={onFreshSandbox}>Start a new sandbox</Button>
      ) : (
        onRetry && <Button onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}
