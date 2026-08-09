import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2018",
    assetsInlineLimit: 8192
  },
  server: { port: 5173, open: true }
});
