import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// Vitest runs with globals off, so Testing Library's automatic
// cleanup never registers; without this, renders accumulate across
// tests in a file and queries find duplicates.
afterEach(() => {
  cleanup();
});
