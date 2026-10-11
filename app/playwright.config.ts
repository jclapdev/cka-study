import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

// Clicks through the app the way a learner does, against a copy of its own (tests/browser/serve.sh)
// so the tests' visits and check-offs never land in the learner's progress. CKA_URL points them at a
// running app instead, which writes into that app's progress.
const dir = process.env.CKA_SITUATIONS ?? path.join(os.tmpdir(), "cka-browser");

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "*.e2e.ts",
  timeout: 120_000,
  fullyParallel: true,
  use: { baseURL: process.env.CKA_URL ?? "http://127.0.0.1:5301" },
  webServer: process.env.CKA_URL
    ? undefined
    : {
        command: "tests/browser/serve.sh",
        url: "http://127.0.0.1:5301",
        env: { CKA_SITUATIONS: dir },
        reuseExistingServer: false,
        gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
        timeout: 120_000,
      },
});
