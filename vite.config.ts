import { defineConfig } from "vite";
import solid from "solid-start/vite";
import UnoCSS from "unocss/vite"
import devtools from "solid-devtools/vite"

export default defineConfig({
  plugins: [
    UnoCSS(),
    devtools({
      autoname: false,
      locator: {
        targetIDE: 'webstorm',
        componentLocation: true,
        jsxLocation: true,
      },
    }),
    solid({ ssr: false })
  ],
});
