import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { terminal } from "./terminal.ts";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), terminal()],
  // A second dev server must not start on the next port: it would rebuild the shared dependency
  // cache under the first one, whose pages then fail to load code split out of it (mermaid diagrams).
  server: { host: "127.0.0.1", strictPort: true },
  // Find every dependency at startup. Otherwise the first page load finds more, and Vite
  // reloads the page, dropping a lab that is starting.
  optimizeDeps: { entries: ["app/**/*.{ts,tsx}"] },
  resolve: {
    tsconfigPaths: true,
  },
});
