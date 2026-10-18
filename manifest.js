export default function manifest() {
  return {
    name: "وقتي", short_name: "وقتي", lang: "ar", dir: "rtl",
    start_url: "/services", display: "standalone",
    background_color: "#EEF3F2", theme_color: "#0E7C7B",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
