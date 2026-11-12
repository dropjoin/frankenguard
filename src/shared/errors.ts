// Domain errors. Services throw these; the API layer maps them to HTTP
// statuses per design 6.4. Nothing outside the API layer knows about
// status codes, and no error message ever carries a secret or a raw
// database complaint to the client.

export class DomainError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

/** Request shape or values the service cannot accept (config routes, non-object bodies). */
export class InvalidInputError extends DomainError {
  constructor(message: string) {
    super("INVALID_INPUT", 422, message);
  }
}

/** Same idempotency key, different body. The original decision stands; the replay is refused. */
export class IdempotencyKeyReusedError extends DomainError {
  constructor() {
    super("IDEMPOTENCY_KEY_REUSED", 409, "idempotency key was already used with a different proposal");
  }
}

/** A recipient that normalizes to an existing allowlist entry. */
export class DuplicateRecipientError extends DomainError {
  constructor() {
    super("DUPLICATE_RECIPIENT", 409, "recipient is already on the allowlist");
  }
}

/** Sandbox cookie missing, unknown, or past expiry. */
export class SandboxExpiredError extends DomainError {
  constructor() {
    super("SANDBOX_EXPIRED", 401, "sandbox session is missing or expired");
  }
}

/** A per-sandbox hard limit (500 proposals, 2,000 audit entries, 50 allowlist entries). */
export class SandboxLimitReachedError extends DomainError {
  constructor(message: string) {
    super("SANDBOX_LIMIT_REACHED", 429, message);
  }
}

/** The audit write failed, so the whole submission rolled back and nothing executed. */
export class AuditUnavailableError extends DomainError {
  constructor() {
    super("AUDIT_UNAVAILABLE", 503, "the audit trail is unavailable; nothing was executed");
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super("NOT_FOUND", 404, `${what} was not found`);
  }
}

export class RateLimitedError extends DomainError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("RATE_LIMITED", 429, "rate limit reached");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
