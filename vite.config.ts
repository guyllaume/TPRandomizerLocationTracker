import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    // Keep image assets compatible with the production CSP (`img-src 'self'`).
    // Vite otherwise embeds small images as `data:` URLs, which Cloudflare blocks.
    assetsInlineLimit: 0,
  },
});
