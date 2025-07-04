import { defineConfig } from "vite";
import solid from "solid-start/vite";

export default defineConfig({
  plugins: [
    solid({ 
      ssr: false,
      solid: {
        generate: "dom",
        hydratable: false
      },
      adapter: "solid-start-cloudflare-pages"
    })
  ],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  ssr: {
    noExternal: true
  }
});