// Per-sandbox hard limits (R7.17, design 6.5). A sandbox that hits
// one stops accepting writes; the visitor resets to start over.

export const MAX_PROPOSALS_PER_SANDBOX = 500;
export const MAX_AUDIT_ENTRIES_PER_SANDBOX = 2000;
export const MAX_ALLOWLIST_ENTRIES = 50;
