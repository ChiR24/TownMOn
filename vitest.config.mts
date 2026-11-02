import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Tests use their own in-memory databases; never the dev database on disk.
  test: { environment: "node", include: ["src/**/*.test.ts"], testTimeout: 30_000, env: { PGLITE_DIR: "memory://", DATABASE_URL: "" } },
});
