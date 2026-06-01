// Per-theme 2048 tile palettes. Default themes (classic, forest, mono) are
// intentionally absent here; they fall back to the classic colors in styles.css.

const TILE_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048] as const

type PaletteSpec = {
  /** Exactly 11 colors, one per entry of TILE_VALUES (2 ... 2048). */
  tiles: [string, string, string, string, string, string, string, string, string, string, string]
  /** Color for tiles beyond 2048. */
  super: string
}

const SPECS: Record<string, PaletteSpec> = {
  mint: {
    tiles: [
      '#ecfdf5', '#bbf7d0', '#6ee7b7', '#34d399', '#10b981',
      '#0ea5a4', '#0891b2', '#0e7490', '#047857', '#065f46', '#34e89e',
    ],
    super: '#a7f3d0',
  },
  notebook: {
    tiles: [
      '#f8fafc', '#e7edf7', '#d5deec', '#b7c6dc', '#91a4bf',
      '#61789b', '#41526d', '#2f3b50', '#f5c84b', '#d99f24', '#61a0ff',
    ],
    super: '#fff3b0',
  },
  arcade: {
    tiles: [
      '#eafff2', '#b8f7ce', '#8cf3b4', '#5affa1', '#34d17a',
      '#16a35f', '#0f7c49', '#1c5a3f', '#ffd166', '#ff9f1c', '#5affa1',
    ],
    super: '#ffd166',
  },
  candy: {
    tiles: [
      '#fdf2ff', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899',
      '#db2777', '#c026d3', '#a855f7', '#7c3aed', '#6d28d9', '#ff6ec4',
    ],
    super: '#e9d5ff',
  },
  sunset: {
    tiles: [
      '#fff1e6', '#ffe0c2', '#ffc89e', '#ffa86b', '#ff8c42',
      '#fb6a1c', '#ea3a6f', '#d4145a', '#a50d52', '#6e0a44', '#ffd36e',
    ],
    super: '#ffe9c2',
  },
  blueprint: {
    tiles: [
      '#eaf6ff', '#bfe8ff', '#8fd9ff', '#73d3ff', '#39bff2',
      '#168fc7', '#0e6a99', '#123a5d', '#ffb000', '#d68400', '#73d3ff',
    ],
    super: '#ffd166',
  },
  aurora: {
    tiles: [
      '#effcff', '#bff8ef', '#8af3e1', '#5eead4', '#22c7c7',
      '#2090b0', '#3b6cb8', '#6d5bd0', '#8b5cf6', '#a855f7', '#5eead4',
    ],
    super: '#c4b5fd',
  },
  prism: {
    tiles: [
      '#fbf8ff', '#d9f8ff', '#9aecff', '#32dcff', '#b8f24b',
      '#ffcc66', '#ff9f6e', '#ff6b9d', '#ff4ca3', '#8b5cf6', '#32dcff',
    ],
    super: '#ffcc66',
  },
  overgrowth: {
    tiles: [
      '#ecfdf5', '#d1fae5', '#a7f3d0', '#7dffb0', '#34d399',
      '#10b981', '#059669', '#237a57', '#14583f', '#07150f', '#7dffb0',
    ],
    super: '#a7f3d0',
  },
  midnight: {
    tiles: [
      '#eef2ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1',
      '#4f46e5', '#4338ca', '#7c3aed', '#6d28d9', '#3730a3', '#a78bfa',
    ],
    super: '#c4b5fd',
  },
  synthwave: {
    tiles: [
      '#1f1147', '#2d1a5e', '#3b2370', '#5b2a9e', '#7c3aed',
      '#b026ff', '#e0218a', '#05d9e8', '#00b3c4', '#b3134f', '#ff2a6d',
    ],
    super: '#05d9e8',
  },
  voltage: {
    tiles: [
      '#f8fbff', '#dce9ff', '#a7c8ff', '#6ba0ff', '#2c7bff',
      '#1f55c8', '#17357c', '#111827', '#faff00', '#c7d900', '#2c7bff',
    ],
    super: '#faff00',
  },
  noir: {
    tiles: [
      '#f5f5f5', '#d4d4d4', '#a3a3a3', '#737373', '#525252',
      '#404040', '#262626', '#1c1c1c', '#bfa14a', '#d4af37', '#f5d77a',
    ],
    super: '#ffffff',
  },
  celestial: {
    tiles: [
      '#15103f', '#20184f', '#2c2266', '#3d3088', '#5648ab',
      '#7a5fd0', '#b08fe0', '#d4af37', '#e0bc4e', '#f0cf6e', '#ffe7a3',
    ],
    super: '#fff3cf',
  },
  'casino-royale': {
    tiles: [
      '#fff7df', '#e8d38a', '#d7bf74', '#b99a45', '#0f6a43',
      '#0d4a31', '#093322', '#5a1018', '#7f1d1d', '#b91c1c', '#ffd764',
    ],
    super: '#fff0a3',
  },
}

/** Every CSS variable this module manages, so we can fully clear it on switch. */
const ALL_VARS: string[] = (() => {
  const names: string[] = []
  for (const v of TILE_VALUES) names.push(`--g2048-bg-${v}`, `--g2048-fg-${v}`)
  names.push('--g2048-bg-super', '--g2048-fg-super')
  return names
})()

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '')
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ]
}

/** WCAG relative luminance (0 = black, 1 = white). */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Pick a near-black or near-white text color for readability on `bg`. */
function textFor(bg: string): string {
  return luminance(bg) > 0.5 ? '#1b1b1b' : '#fbfbfb'
}

/**
 * Apply (or clear) the 2048 tile palette for a theme on the given root element.
 * Default themes clear the variables so the CSS fallbacks (classic colors) win.
 */
export function applyTilePalette(root: HTMLElement, themeId: string): void {
  for (const name of ALL_VARS) root.style.removeProperty(name)
  const spec = SPECS[themeId]
  if (!spec) return
  TILE_VALUES.forEach((v, i) => {
    const bg = spec.tiles[i]
    root.style.setProperty(`--g2048-bg-${v}`, bg)
    root.style.setProperty(`--g2048-fg-${v}`, textFor(bg))
  })
  root.style.setProperty('--g2048-bg-super', spec.super)
  root.style.setProperty('--g2048-fg-super', textFor(spec.super))
}
