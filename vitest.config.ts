import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          environment: "node",
          exclude: ["tests/web/**"],
          include: ["tests/**/*.test.ts"],
          name: "node",
        },
      },
      {
        plugins: [react()],
        test: {
          environment: "jsdom",
          include: ["tests/web/**/*.test.{ts,tsx}"],
          name: "web",
          setupFiles: ["tests/web/setup.ts"],
        },
      },
    ],
  },
});
