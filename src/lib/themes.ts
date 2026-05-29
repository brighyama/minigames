/**
 * Rarity tiers — keyed by glow color so the value maps directly to a CSS
 * class (`rarity-blue`, etc.). Visual indicator:
 *   green  = 1 star
 *   blue   = 2 stars
 *   purple = 3 stars
 *   red    = 4 stars
 *   gold   = crown ("exclusive")
 *
 * Cost tiers scale roughly exponentially: green ~100, blue ~1K, purple ~10K,
 * red ~100K, gold ~1M. Mirrors the chip denominations in blackjack.
 */
export type Rarity = 'green' | 'blue' | 'purple' | 'red' | 'gold'

export type Theme = {
  id: string
  name: string
  start: string
  stop: string
  /** True if the theme starts locked and must be unlocked (e.g., in the shop). */
  locked?: boolean
  /** Shop price in points. Only meaningful when locked. */
  cost?: number
  /** Glow tier shown around the theme tile and on the shop card. */
  rarity?: Rarity
  /** Hint shown on the locked tile if no shop entry is configured. */
  unlockHint?: string
  /** Override the main text color. Defaults to white. */
  text?: string
  /** Override the title/card-title font family. */
  font?: string
  /** Optional CSS text-shadow / glow applied to titles. */
  titleShadow?: string
  /**
   * Primary accent color, exposed as `--accent-1`. Used for game-state
   * highlights, button fills, etc. (e.g., the "wait" screen in the reaction
   * test). Defaults to red.
   */
  accent1?: string
  /**
   * Secondary accent color, exposed as `--accent-2`. Contrasting counterpart
   * to `accent1` (e.g., the "go" screen in the reaction test). Defaults to
   * green.
   */
  accent2?: string
}

export const DEFAULT_ACCENT_1 = '#c0392b'
export const DEFAULT_ACCENT_2 = '#27ae60'

/**
 * The first entry is the default theme for brand-new users.
 *
 * Order in the sidebar grid follows this array: unlocked themes appear
 * first, locked themes fill the remaining tiles.
 */
export const themes: Theme[] = [
  // ---------- Unlocked by default ----------
  { id: 'classic', name: 'Classic', start: '#1a2980', stop: '#26d0ce' },
  { id: 'forest',  name: 'Forest',  start: '#134e5e', stop: '#71b280' },
  { id: 'lilac',   name: 'Lilac',   start: '#8a89b8', stop: '#bb8cdba8' },
  { id: 'mono',    name: 'Mono',    start: '#1f1f23', stop: '#3a3a44' },

  // ---------- Locked (purchasable in the shop) ----------
  {
    id: 'mint',
    name: 'Mint',
    start: '#0f3443',
    stop: '#34e89e',
    locked: true,
    cost: 100,
    rarity: 'green',
    accent1: '#082a26',
    accent2: '#34e89e',
  },
  {
    id: 'candy',
    name: 'Candy',
    start: '#ff6ec4',
    stop: '#7873f5',
    locked: true,
    cost: 1_000,
    rarity: 'blue',
    accent1: '#3a2a8a',
    accent2: '#ff6ec4',
  },
  {
    id: 'ember',
    name: 'Ember',
    start: '#3a1c1c',
    stop: '#ff5e3a',
    locked: true,
    cost: 10_000,
    rarity: 'purple',
    accent1: '#2a1010',
    accent2: '#ff5e3a',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    start: '#0f0c29',
    stop: '#302b63',
    locked: true,
    cost: 100_000,
    rarity: 'red',
    accent1: '#0a0716',
    accent2: '#7c3aed',
  },
  {
    id: 'noir',
    name: 'Noir',
    start: '#000000',
    stop: '#434343',
    locked: true,
    cost: 1_000_000,
    rarity: 'gold',
    accent1: '#000000',
    accent2: '#ffffff',
  },
]
