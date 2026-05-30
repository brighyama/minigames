// Per-theme 2048 tile palettes. The four default themes (classic, forest,
// lilac, mono) are intentionally absent here — they fall back to the classic
// 2048 colors defined in styles.css.
//
// Each unlockable theme gets a *curated* 11-color set (one per tile value) that
// stays in the theme's color family but deliberately mixes light and dark
// shades and rotates through complementary hues, rather than a single gradient.
// The 2048 tile is the theme's signature color so reaching the goal pops, and
// `super` covers anything beyond 2048. Tile text color is chosen automatically
// from each background's luminance so contrast is always readable.

const TILE_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048] as const

type PaletteSpec = {
  /** Exactly 11 colors, one per entry of TILE_VALUES (2 … 2048). */
  tiles: [string, string, string, string, string, string, string, string, string, string, string]
  /** Color for tiles beyond 2048. */
  super: string
}

const SPECS: Record<string, PaletteSpec> = {
  // Mint — greens that drift through teal and cyan, light low tiles, deep
  // mid tiles, bright signature mint at the goal.
  mint: {
    tiles: [
      '#ecfdf5', '#bbf7d0', '#6ee7b7', '#34d399', '#10b981',
      '#0ea5a4', '#0891b2', '#0e7490', '#047857', '#065f46', '#34e89e',
    ],
    super: '#a7f3d0',
  },
  // Candy — pinks blooming into magenta and purple, with a hot-pink goal.
  candy: {
    tiles: [
      '#fdf2ff', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899',
      '#db2777', '#c026d3', '#a855f7', '#7c3aed', '#6d28d9', '#ff6ec4',
    ],
    super: '#e9d5ff',
  },
  // Ember — warm peaches → orange → red, with an amber/gold pop midway and a
  // glowing ember goal.
  ember: {
    tiles: [
      '#fff7ed', '#fed7aa', '#fdba74', '#fb923c', '#f97316',
      '#ea580c', '#dc2626', '#b91c1c', '#fbbf24', '#92400e', '#ff5e3a',
    ],
    super: '#ffe08a',
  },
  // Midnight — periwinkle → indigo → violet, lighter pops near the top.
  midnight: {
    tiles: [
      '#eef2ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1',
      '#4f46e5', '#4338ca', '#7c3aed', '#6d28d9', '#3730a3', '#a78bfa',
    ],
    super: '#c4b5fd',
  },
  // Noir — grayscale from near-white to near-black, then gold accents for the
  // high-value "exclusive" tiles.
  noir: {
    tiles: [
      '#f5f5f5', '#d4d4d4', '#a3a3a3', '#737373', '#525252',
      '#404040', '#262626', '#1c1c1c', '#bfa14a', '#d4af37', '#f5d77a',
    ],
    super: '#ffffff',
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
