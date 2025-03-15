import { defineConfig, presetUno, transformerVariantGroup } from 'unocss'

export default defineConfig({
  presets: [
    presetUno()
  ],
  transformers: [
    transformerVariantGroup(),
  ],
  extendTheme: theme => {
    const gray = theme.colors!.gray as any
    gray["850"] = "#18212F";
    gray["750"] = "#2B3544";

    (theme as any).animation['spin-slow'] = 'spin 3s linear infinite'

    const fontFamily = theme.fontFamily!
    fontFamily["sans"] = 'Poppins, sans-serif'
  }
})
