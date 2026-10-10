import { defineConfig } from "@playwright/test";

// Clicks through the running app the way a learner does. Start the app first (Getting started),
// or point CKA_URL at a dev server.
export default defineConfig({
  testDir: "tests/browser",
  testMatch: "*.e2e.ts",
  timeout: 120_000,
  fullyParallel: true,
  use: { baseURL: process.env.CKA_URL ?? "http://127.0.0.1:5173" },
});
