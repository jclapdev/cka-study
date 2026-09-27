import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./app/db/schema.ts",
  dbCredentials: { url: "./data/progress.db" },
});
