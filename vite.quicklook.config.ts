import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/**
 * Builds the macOS Quick Look preview bundle: one IIFE plus one stylesheet,
 * which scripts/build-quicklook.mjs then inlines into a single self-contained
 * preview.html. Nothing is fetched at runtime — the extension's WKWebView gets
 * one HTML string and no network origin it is allowed to reach.
 */
export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      // No Tauri runtime inside a Quick Look extension.
      "@tauri-apps/api/core": path.resolve("src/quicklook/tauri-stub.ts"),
    },
  },
  build: {
    outDir: "build-quicklook",
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: path.resolve("src/quicklook/preview.ts"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "preview.js",
        assetFileNames: "preview.[ext]",
      },
    },
  },
});
