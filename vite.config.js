import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages يخدم الموقع من /Slotify/ ؛ محليًا يبقى "/"
const BASE = process.env.VITE_BASE || "/";

// ملفات ثابتة تُولَّد من هنا بدل مجلد public (لتبقى الجذر بلا مجلدات)
const files = {
  "sw.js": `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
self.addEventListener("fetch", () => {});`,
  "icon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0E7C7B"/><circle cx="256" cy="256" r="150" fill="none" stroke="#fff" stroke-width="32"/><path d="M256 160v100l66 40" fill="none" stroke="#fff" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "manifest.webmanifest": JSON.stringify({
    name: "وقتي", short_name: "وقتي", lang: "ar", dir: "rtl",
    start_url: BASE + "services", scope: BASE, display: "standalone",
    background_color: "#EEF3F2", theme_color: "#0E7C7B",
    icons: [{ src: BASE + "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  }),
};
const types = { "sw.js": "text/javascript", "icon.svg": "image/svg+xml", "manifest.webmanifest": "application/manifest+json" };

const staticFiles = () => ({
  name: "static-files",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const name = req.url.slice(1).split("?")[0];
      if (files[name]) { res.setHeader("Content-Type", types[name]); res.end(files[name]); } else next();
    });
  },
  generateBundle() {
    for (const [fileName, source] of Object.entries(files)) this.emitFile({ type: "asset", fileName, source });
  },
});

export default defineConfig({ base: BASE, publicDir: false, plugins: [react(), staticFiles()] });
