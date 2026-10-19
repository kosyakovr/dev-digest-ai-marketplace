import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import catalogPlugin from "./catalog/vite-plugin-catalog.mjs";
import { SITE_BASE } from "./catalog/config.mjs";

// The marketplace repository root (one level above site/). The catalog is generated from it.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  base: SITE_BASE,
  plugins: [react(), catalogPlugin({ repoRoot, base: SITE_BASE })],
  server: { port: 5173, open: SITE_BASE },
  test: { environment: "node" },
});
