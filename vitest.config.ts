import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // infra/ is a separate CDK package with its own deps and a Lambda entry
    // resolved via process.cwd(); run its suite with `cd infra && npx vitest`.
    exclude: ["node_modules", ".next", "infra/**"],
    testTimeout: 30_000,
  },
});
