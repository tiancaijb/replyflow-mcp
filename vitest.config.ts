import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Allow .js extension imports from source to resolve to .ts in tests
    conditions: ["node"],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Silence console.error in tests (config.ts logs warnings)
    onConsoleLog(_log, _type) {
      return false;
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 80,
        statements: 80,
      },
    },
  },
});
