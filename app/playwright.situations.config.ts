import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

// The situations in FEATURES.md, each walked in a browser against a copy of the app of its own
// (tests/browser/serve.sh): a stand-in lab and an empty progress database, so these tests can
// start, reset and stop labs without touching the learner's. One at a time, since they share that lab.
const dir = process.env.CKA_SITUATIONS ?? path.join(os.tmpdir(), "cka-situations");
process.env.CKA_SITUATIONS = dir;

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "*.situations.ts",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5301" },
  webServer: {
    command: "tests/browser/serve.sh",
    url: "http://127.0.0.1:5301",
    env: { CKA_SITUATIONS: dir, CKA_LAB_IDLE_MINUTES: "0.1" },
    reuseExistingServer: false,
    // The dev server starts itself again as a child and passes SIGTERM on to it; a forced stop
    // would leave that child holding the test run open.
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    timeout: 120_000,
  },
});
