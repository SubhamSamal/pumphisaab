import { defineConfig } from "vitest/config";

// Unit tests for pure TypeScript only (src/lib, src/calc, scripts).
// React Native components are checked in the gallery screen, not here.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
