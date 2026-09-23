import { defineConfig } from "vite";

// Multi-page static site. Output in dist/ can be served by GitHub Pages or Cloudflare Pages as-is.
const page = (f: string) => new URL(f, import.meta.url).pathname;

export default defineConfig({
  base: "/",
  plugins: [],
  build: {
    rollupOptions: {
      input: {
        main: page("./index.html"),
        print: page("./print.html"),
        methodology: page("./methodology.html"),
        independence: page("./independence.html"),
        disclaimer: page("./disclaimer.html"),
      },
    },
  },
  server: { port: 5173, host: "127.0.0.1" },
});
