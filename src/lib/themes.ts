/**
 * Rarity tiers -- keyed by glow color so the value maps directly to a CSS
 * class (`rarity-blue`, etc.). Visual indicator:
 *   green  = 1 star
 *   blue   = 2 stars
 *   purple = 3 stars
 *   red    = 4 stars
 *   gold   = crown ("exclusive")
 *
 * Cost tiers (collectible ladder, priced per-item within each rarity):
 *   green  ~40-60     blue  ~150-250    purple ~600-900
 *   red    ~2k-3k     gold  ~8k-12k
 */
export type Rarity = 'green' | 'blue' | 'purple' | 'red' | 'gold'

export type Theme = {
  id: string
  name: string
  /** Full CSS background image/value applied site-wide. */
  background: string
  /** Optional size list for layered patterned backgrounds. */
  backgroundSize?: string
  /** Compact preview used in the sidebar and shop. */
  swatch: string
  /** True if the theme starts locked and must be unlocked in the shop. */
  locked?: boolean
  /** Locked item is visible but cannot be purchased in the shop. */
  caseDropOnly?: boolean
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
  /** Primary accent color, exposed as `--accent-1`. */
  accent1?: string
  /** Secondary accent color, exposed as `--accent-2`. */
  accent2?: string
}

export const DEFAULT_ACCENT_1 = '#c0392b'
export const DEFAULT_ACCENT_2 = '#27ae60'

/**
 * The first entry is the default theme for brand-new users.
 *
 * Order in the sidebar grid follows this array: unlocked themes appear first,
 * locked themes fill the remaining tiles.
 */
export const themes: Theme[] = [
  // ---------- Unlocked by default ----------
  {
    id: 'classic',
    name: 'classic',
    background: 'linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)',
    swatch: 'linear-gradient(135deg, #1a2980, #26d0ce)',
  },
  {
    id: 'forest',
    name: 'forest',
    background:
      'radial-gradient(circle at 20% 20%, rgba(113, 178, 128, 0.32), transparent 30%), linear-gradient(135deg, #134e5e 0%, #1f6a55 48%, #71b280 100%)',
    swatch: 'linear-gradient(135deg, #134e5e, #71b280)',
  },
  {
    id: 'mono',
    name: 'mono',
    background:
      'repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 12px), linear-gradient(135deg, #1f1f23 0%, #3a3a44 100%)',
    swatch: 'linear-gradient(135deg, #1f1f23, #3a3a44)',
  },

  // ---------- Locked (purchasable in the shop) ----------
  // --- Green: readable, restrained patterns. ---
  {
    id: 'mint',
    name: 'mint',
    background:
      'repeating-linear-gradient(135deg, rgba(167, 243, 208, 0.08) 0 2px, transparent 2px 16px), radial-gradient(circle at 80% 10%, rgba(52, 232, 158, 0.22), transparent 32%), linear-gradient(135deg, #0f3443 0%, #134e4a 55%, #34e89e 100%)',
    swatch: 'linear-gradient(135deg, #0f3443, #34e89e)',
    locked: true,
    cost: 40,
    rarity: 'green',
    accent1: '#0f766e',
    accent2: '#34e89e',
  },
  {
    id: 'notebook',
    name: 'notebook',
    background:
      'repeating-linear-gradient(0deg, transparent 0 27px, rgba(97, 160, 255, 0.16) 28px 29px), linear-gradient(90deg, transparent 0 72px, rgba(255, 94, 94, 0.18) 73px 74px, transparent 75px), linear-gradient(135deg, #1d2433 0%, #2f3340 100%)',
    swatch: 'linear-gradient(135deg, #1d2433 0%, #f5c84b 52%, #61a0ff 100%)',
    locked: true,
    cost: 50,
    rarity: 'green',
    accent1: '#f5c84b',
    accent2: '#61a0ff',
    text: '#f5f7fb',
  },
  {
    id: 'arcade',
    name: 'arcade',
    background:
      'radial-gradient(circle, rgba(90, 255, 161, 0.16) 1px, transparent 1.5px), linear-gradient(135deg, #12141d 0%, #18281f 58%, #0f3b2a 100%)',
    swatch: 'radial-gradient(circle, rgba(90, 255, 161, 0.85) 1px, transparent 2px), linear-gradient(135deg, #12141d, #0f3b2a)',
    backgroundSize: '18px 18px, auto',
    locked: true,
    cost: 60,
    rarity: 'green',
    accent1: '#5affa1',
    accent2: '#ffd166',
  },

  // --- Blue: stronger identity, still utilitarian. ---
  {
    id: 'candy',
    name: 'candy',
    background:
      'radial-gradient(circle at 20% 18%, rgba(255, 110, 196, 0.5), transparent 30%), radial-gradient(circle at 85% 72%, rgba(120, 115, 245, 0.52), transparent 34%), linear-gradient(135deg, #20133a 0%, #4b286f 100%)',
    swatch: 'radial-gradient(circle at 25% 20%, #ff6ec4, transparent 38%), linear-gradient(135deg, #ff6ec4, #7873f5)',
    locked: true,
    cost: 150,
    rarity: 'blue',
    accent1: '#ff6ec4',
    accent2: '#7873f5',
  },
  {
    id: 'sunset',
    name: 'sunset',
    background:
      'linear-gradient(180deg, rgba(255, 214, 143, 0.2) 0 12%, transparent 12% 100%), linear-gradient(155deg, #35124a 0%, #b91862 42%, #ff6a00 74%, #ffd36e 100%)',
    swatch: 'linear-gradient(155deg, #35124a, #ee0979 48%, #ff6a00 78%, #ffd36e)',
    locked: true,
    cost: 200,
    rarity: 'blue',
    accent1: '#ee0979',
    accent2: '#ffd36e',
    text: '#fff4ec',
  },
  {
    id: 'blueprint',
    name: 'blueprint',
    background:
      'linear-gradient(rgba(115, 211, 255, 0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(115, 211, 255, 0.14) 1px, transparent 1px), linear-gradient(135deg, #07192e 0%, #0e3a63 100%)',
    swatch: 'linear-gradient(rgba(115, 211, 255, 0.34) 1px, transparent 1px), linear-gradient(90deg, rgba(115, 211, 255, 0.34) 1px, transparent 1px), #0e3a63',
    backgroundSize: '32px 32px, 32px 32px, auto',
    locked: true,
    cost: 250,
    rarity: 'blue',
    accent1: '#73d3ff',
    accent2: '#ffb000',
    text: '#eaf6ff',
  },

  // --- Purple: premium layered palettes. ---
  {
    id: 'aurora',
    name: 'aurora',
    background:
      'radial-gradient(ellipse at 20% 20%, rgba(94, 234, 212, 0.45), transparent 38%), radial-gradient(ellipse at 70% 35%, rgba(168, 85, 247, 0.45), transparent 42%), linear-gradient(135deg, #07111f 0%, #14213d 52%, #281a4d 100%)',
    swatch: 'linear-gradient(135deg, #07111f 0%, #5eead4 42%, #a855f7 100%)',
    locked: true,
    cost: 600,
    rarity: 'purple',
    accent1: '#5eead4',
    accent2: '#a855f7',
    text: '#effcff',
  },
  {
    id: 'prism',
    name: 'prism',
    background:
      'linear-gradient(125deg, transparent 0 16%, rgba(255, 76, 163, 0.2) 16% 28%, transparent 28% 100%), linear-gradient(38deg, transparent 0 42%, rgba(50, 220, 255, 0.18) 42% 56%, transparent 56% 100%), linear-gradient(135deg, #0b0b12 0%, #211734 100%)',
    swatch: 'linear-gradient(125deg, #0b0b12 0 28%, #ff4ca3 28% 45%, #32dcff 45% 68%, #ffcc66 68%)',
    locked: true,
    cost: 750,
    rarity: 'purple',
    accent1: '#ff4ca3',
    accent2: '#32dcff',
    text: '#f8f6ff',
    titleShadow: '0 0 18px rgba(50, 220, 255, 0.45)',
  },
  {
    id: 'overgrowth',
    name: 'overgrowth',
    background:
      'radial-gradient(ellipse at 15% 20%, rgba(125, 255, 176, 0.25), transparent 30%), radial-gradient(ellipse at 80% 75%, rgba(31, 122, 87, 0.42), transparent 38%), repeating-linear-gradient(115deg, rgba(125, 255, 176, 0.06) 0 3px, transparent 3px 19px), linear-gradient(135deg, #07150f 0%, #143828 100%)',
    swatch: 'linear-gradient(135deg, #07150f, #237a57 55%, #7dffb0)',
    locked: true,
    cost: 900,
    rarity: 'purple',
    accent1: '#7dffb0',
    accent2: '#237a57',
    text: '#e9fff2',
  },

  // --- Red: dramatic, high-contrast showpieces. ---
  {
    id: 'midnight',
    name: 'midnight',
    background:
      'radial-gradient(circle at 18% 22%, rgba(124, 58, 237, 0.35), transparent 32%), radial-gradient(circle at 78% 12%, rgba(167, 139, 250, 0.18), transparent 22%), linear-gradient(135deg, #090716 0%, #141129 48%, #302b63 100%)',
    swatch: 'linear-gradient(135deg, #090716, #302b63 70%, #a78bfa)',
    locked: true,
    cost: 2_000,
    rarity: 'red',
    accent1: '#7c3aed',
    accent2: '#a78bfa',
    text: '#e7e3ff',
    titleShadow: '0 0 18px rgba(124, 58, 237, 0.7)',
  },
  {
    id: 'synthwave',
    name: 'synthwave',
    background:
      'linear-gradient(rgba(5, 217, 232, 0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 42, 109, 0.16) 1px, transparent 1px), linear-gradient(155deg, #1a0033 0%, #3b0d63 42%, #d4145a 100%)',
    swatch: 'linear-gradient(135deg, #1a0033 0%, #05d9e8 45%, #ff2a6d 100%)',
    backgroundSize: '34px 34px, 34px 34px, auto',
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
    id: 'voltage',
    name: 'voltage',
    background:
      'linear-gradient(42deg, transparent 0 44%, rgba(250, 255, 0, 0.26) 44% 46%, transparent 46% 100%), linear-gradient(120deg, transparent 0 58%, rgba(44, 123, 255, 0.22) 58% 60%, transparent 60% 100%), linear-gradient(135deg, #07090f 0%, #111827 100%)',
    swatch: 'linear-gradient(135deg, #07090f 0%, #2c7bff 45%, #faff00 100%)',
    locked: true,
    cost: 3_000,
    rarity: 'red',
    accent1: '#faff00',
    accent2: '#2c7bff',
    text: '#f8fbff',
    titleShadow: '0 0 18px rgba(250, 255, 0, 0.55)',
  },

  // --- Gold: exclusive tier. ---
  {
    id: 'noir',
    name: 'noir',
    background:
      'repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0 1px, transparent 1px 80px), linear-gradient(135deg, #000000 0%, #202020 72%, #d8d8d8 100%)',
    swatch: 'linear-gradient(135deg, #000000, #434343 65%, #ffffff)',
    locked: true,
    cost: 8_000,
    rarity: 'gold',
    accent1: '#111111',
    accent2: '#ffffff',
    text: '#f5f5f5',
    font: "'JetBrains Mono', ui-monospace, monospace",
    titleShadow: '0 0 20px rgba(255, 255, 255, 0.45)',
  },
  {
    id: 'celestial',
    name: 'celestial',
    background:
      'radial-gradient(circle at 18% 22%, rgba(255, 231, 163, 0.75) 0 1px, transparent 2px), radial-gradient(circle at 78% 28%, rgba(255, 231, 163, 0.55) 0 1px, transparent 2px), radial-gradient(circle at 50% 80%, rgba(176, 143, 224, 0.28), transparent 34%), linear-gradient(135deg, #08051f 0%, #1d1752 58%, #6d4c8d 100%)',
    swatch: 'radial-gradient(circle at 25% 25%, #ffe7a3 0 2px, transparent 3px), linear-gradient(135deg, #08051f, #1d1752 58%, #ffe7a3)',
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
    id: 'casino-royale',
    name: 'casino royale',
    background:
      'repeating-linear-gradient(45deg, rgba(255, 215, 100, 0.1) 0 1px, transparent 1px 28px), radial-gradient(circle at 50% 10%, rgba(255, 215, 100, 0.22), transparent 34%), linear-gradient(135deg, #061c13 0%, #0c3b29 58%, #5a1018 100%)',
    swatch: 'linear-gradient(135deg, #061c13 0%, #0c3b29 52%, #ffd764 72%, #7f1d1d 100%)',
    locked: true,
    caseDropOnly: true,
    rarity: 'gold',
    accent1: '#ffd764',
    accent2: '#b91c1c',
    text: '#fff7df',
    font: "Georgia, 'Times New Roman', serif",
    titleShadow: '0 0 24px rgba(255, 215, 100, 0.8)',
  },
]
