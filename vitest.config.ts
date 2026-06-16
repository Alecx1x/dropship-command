import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests for /lib live next to or under /tests; integration tests for
    // API routes also live under /tests (see CLAUDE.md project layout).
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
    environment: "node",
  },
});
