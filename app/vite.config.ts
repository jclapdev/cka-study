import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { terminal } from "./terminal.ts";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), terminal()],
  server: { host: "127.0.0.1" },
  resolve: {
    tsconfigPaths: true,
  },
});
