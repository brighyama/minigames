/**
 * Rarity tiers — keyed by glow color so the value maps directly to a CSS
 * class (`rarity-blue`, etc.). Visual indicator:
 *   green  = 1 star
 *   blue   = 2 stars
 *   purple = 3 stars
 *   red    = 4 stars
 *   gold   = crown ("exclusive")
 *
 * Cost tiers (collectible ladder, priced per-item within each rarity):
 *   green  ~40–60     blue  ~150–250    purple ~600–900
 *   red    ~2k–3k     gold  ~8k–12k
 * Each item is priced individually so picks within a tier feel distinct.
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
  { id: 'classic', name: 'classic', start: '#1a2980', stop: '#26d0ce' },
  { id: 'forest',  name: 'forest',  start: '#134e5e', stop: '#71b280' },
  { id: 'lilac',   name: 'lilac',   start: '#8a89b8', stop: '#bb8cdba8' },
  { id: 'mono',    name: 'mono',    start: '#1f1f23', stop: '#3a3a44' },

  // ---------- Locked (purchasable in the shop) ----------
  // Grouped by rarity. Each theme is priced individually within its tier;
  // higher tiers layer on more flourish (text/font overrides, then title
  // glows) so the pricier themes feel distinctly more special.

  // --- Green (40–60): clean two-color gradients, accent only. ---
  {
    id: 'mint',
    name: 'mint',
    start: '#0f3443',
    stop: '#34e89e',
    locked: true,
    cost: 40,
    rarity: 'green',
    accent1: '#082a26',
    accent2: '#34e89e',
  },
  {
    id: 'aqua',
    name: 'aqua',
    start: '#0b486b',
    stop: '#3edfcf',
    locked: true,
    cost: 50,
    rarity: 'green',
    accent1: '#06303f',
    accent2: '#8ff7e6',
  },
  {
    id: 'sakura',
    name: 'sakura',
    start: '#5e2750',
    stop: '#f78ca0',
    locked: true,
    cost: 60,
    rarity: 'green',
    accent1: '#3a1730',
    accent2: '#ffc2d1',
  },

  // --- Blue (150–250): bolder gradients + a tuned text color. ---
  {
    id: 'candy',
    name: 'candy',
    start: '#ff6ec4',
    stop: '#7873f5',
    locked: true,
    cost: 150,
    rarity: 'blue',
    accent1: '#3a2a8a',
    accent2: '#ff6ec4',
  },
  {
    id: 'sunset',
    name: 'sunset',
    start: '#ee0979',
    stop: '#ff6a00',
    locked: true,
    cost: 200,
    rarity: 'blue',
    accent1: '#7a1f3d',
    accent2: '#ffd36e',
    text: '#fff4ec',
  },
  {
    id: 'glacier',
    name: 'glacier',
    start: '#0f2027',
    stop: '#2c5364',
    locked: true,
    cost: 250,
    rarity: 'blue',
    accent1: '#0a1419',
    accent2: '#8fe3ff',
    text: '#eaf6ff',
  },

  // --- Purple (600–900): rich palettes, full text theming. ---
  {
    id: 'ember',
    name: 'ember',
    start: '#3a1c1c',
    stop: '#ff5e3a',
    locked: true,
    cost: 600,
    rarity: 'purple',
    accent1: '#2a1010',
    accent2: '#ff5e3a',
    text: '#fff0ea',
  },
  {
    id: 'amethyst',
    name: 'amethyst',
    start: '#41295a',
    stop: '#2f0743',
    locked: true,
    cost: 750,
    rarity: 'purple',
    accent1: '#180a2a',
    accent2: '#c9a3ff',
    text: '#f1e7ff',
  },
  {
    id: 'verdant',
    name: 'verdant',
    start: '#093028',
    stop: '#237a57',
    locked: true,
    cost: 900,
    rarity: 'purple',
    accent1: '#04150f',
    accent2: '#7dffb0',
    text: '#e9fff2',
  },

  // --- Red (2k–3k): neon palettes with a glowing title + display font. ---
  {
    id: 'midnight',
    name: 'midnight',
    start: '#0f0c29',
    stop: '#302b63',
    locked: true,
    cost: 2_000,
    rarity: 'red',
    accent1: '#0a0716',
    accent2: '#7c3aed',
    text: '#e7e3ff',
    titleShadow: '0 0 18px rgba(124, 58, 237, 0.7)',
  },
  {
    id: 'synthwave',
    name: 'synthwave',
    start: '#1a0033',
    stop: '#d4145a',
    locked: true,
    cost: 2_500,
    rarity: 'red',
    accent1: '#05d9e8',
    accent2: '#ff2a6d',
    text: '#e8f9ff',
    font: "'JetBrains Mono', ui-monospace, monospace",
    titleShadow: '0 0 18px rgba(255, 42, 109, 0.7)',
  },
  {
    id: 'inferno',
    name: 'inferno',
    start: '#15090b',
    stop: '#ff4e00',
    locked: true,
    cost: 3_000,
    rarity: 'red',
    accent1: '#3a0d05',
    accent2: '#ffd000',
    text: '#fff1e6',
    titleShadow: '0 0 18px rgba(255, 110, 30, 0.65)',
  },

  // --- Gold (8k–12k): the showpieces — premium gradients, bespoke fonts,
  //     strong glows. The "exclusive" tier. ---
  {
    id: 'noir',
    name: 'noir',
    start: '#000000',
    stop: '#434343',
    locked: true,
    cost: 8_000,
    rarity: 'gold',
    accent1: '#000000',
    accent2: '#ffffff',
    text: '#f5f5f5',
    font: "'JetBrains Mono', ui-monospace, monospace",
    titleShadow: '0 0 20px rgba(255, 255, 255, 0.45)',
  },
  {
    id: 'celestial',
    name: 'celestial',
    start: '#0b0033',
    stop: '#ffcf6e',
    locked: true,
    cost: 10_000,
    rarity: 'gold',
    accent1: '#1a0f3d',
    accent2: '#ffe7a3',
    text: '#fff7e0',
    font: "Georgia, 'Times New Roman', serif",
    titleShadow: '0 0 24px rgba(255, 214, 120, 0.85)',
  },
  {
    id: 'eclipse',
    name: 'eclipse',
    start: '#000000',
    stop: '#7b4397',
    locked: true,
    cost: 12_000,
    rarity: 'gold',
    accent1: '#00f0ff',
    accent2: '#b06bff',
    text: '#eafaff',
    font: "'JetBrains Mono', ui-monospace, monospace",
    titleShadow: '0 0 24px rgba(123, 67, 151, 0.85)',
  },
]
