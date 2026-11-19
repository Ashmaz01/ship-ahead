import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Fonts are inlined so the game also runs where only its own page can load (artifact preview, WebView).
  build: { chunkSizeWarningLimit: 2000, assetsInlineLimit: 40000 },
});
