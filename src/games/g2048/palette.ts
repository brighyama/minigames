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

  // --- Green tier ---
  // Aqua — pale cyan diving into teal and deep blue, bright aqua goal.
  aqua: {
    tiles: [
      '#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee',
      '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63', '#8ff7e6',
    ],
    super: '#a5f3fc',
  },
  // Sakura — blossom pinks deepening to plum, soft rose goal.
  sakura: {
    tiles: [
      '#fff1f5', '#ffe4ec', '#fbcfe0', '#f9a8c9', '#f472a6',
      '#ec4899', '#db2777', '#be185d', '#9d174d', '#5e2750', '#ffc2d1',
    ],
    super: '#ffe4ec',
  },

  // --- Blue tier ---
  // Sunset — warm peach → orange → magenta dusk, golden goal.
  sunset: {
    tiles: [
      '#fff1e6', '#ffe0c2', '#ffc89e', '#ffa86b', '#ff8c42',
      '#fb6a1c', '#ea3a6f', '#d4145a', '#a50d52', '#6e0a44', '#ffd36e',
    ],
    super: '#ffe9c2',
  },
  // Glacier — pale ice blues sinking into slate and deep navy, icy goal.
  glacier: {
    tiles: [
      '#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8',
      '#0ea5e9', '#0284c7', '#2c5364', '#1e3a4c', '#0f2027', '#8fe3ff',
    ],
    super: '#bae6fd',
  },

  // --- Purple tier ---
  // Amethyst — lavender to deep violet, luminous orchid goal.
  amethyst: {
    tiles: [
      '#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa',
      '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#2f0743', '#c9a3ff',
    ],
    super: '#ddd6fe',
  },
  // Verdant — mint to deep forest emerald, vivid spring-green goal.
  verdant: {
    tiles: [
      '#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399',
      '#10b981', '#059669', '#237a57', '#065f46', '#093028', '#7dffb0',
    ],
    super: '#a7f3d0',
  },

  // --- Red tier ---
  // Synthwave — deep violet base striped with neon purple, magenta and cyan;
  // hot-pink goal. Deliberately electric.
  synthwave: {
    tiles: [
      '#1f1147', '#2d1a5e', '#3b2370', '#5b2a9e', '#7c3aed',
      '#b026ff', '#e0218a', '#05d9e8', '#00b3c4', '#b3134f', '#ff2a6d',
    ],
    super: '#05d9e8',
  },
  // Inferno — charred embers climbing through fire to a molten-yellow goal.
  inferno: {
    tiles: [
      '#241010', '#3a1610', '#571c0d', '#79220b', '#9c2c08',
      '#c43c06', '#ef5305', '#ff6d00', '#ff8c00', '#ffaa00', '#ffd000',
    ],
    super: '#fff0a3',
  },

  // --- Gold tier ---
  // Celestial — cosmic indigo ascending through twilight into warm gold.
  celestial: {
    tiles: [
      '#15103f', '#20184f', '#2c2266', '#3d3088', '#5648ab',
      '#7a5fd0', '#b08fe0', '#d4af37', '#e0bc4e', '#f0cf6e', '#ffe7a3',
    ],
    super: '#fff3cf',
  },
  // Eclipse — black to violet with a piercing cyan flare midway, orchid goal.
  eclipse: {
    tiles: [
      '#111118', '#1a1422', '#241a30', '#321f45', '#4a2a6b',
      '#6336a0', '#7b4397', '#00f0ff', '#00c4d4', '#5a2a8c', '#b06bff',
    ],
    super: '#00f0ff',
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
