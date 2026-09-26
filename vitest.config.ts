import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for pure TypeScript only (src/lib, src/calc, scripts, golden cases).
// React Native components are checked in the gallery screen, not here.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
