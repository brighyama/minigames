export type Theme = {
  id: string
  name: string
  start: string
  stop: string
  /** True if the theme starts locked and must be unlocked (e.g., in the shop). */
  locked?: boolean
  /** Shop price in points. Only meaningful when locked. */
  cost?: number
  /** Hint shown on the locked tile if no shop entry is configured. */
  unlockHint?: string
  /** Override the main text color. Defaults to white. */
  text?: string
  /** Override the title/card-title font family. */
  font?: string
  /** Optional CSS text-shadow / glow applied to titles. */
  titleShadow?: string
  /** Reaction game "wait" background. Defaults to red. */
  reactionWait?: string
  /** Reaction game "go" background. Defaults to green. */
  reactionGo?: string
}

export const DEFAULT_REACTION_WAIT = '#c0392b'
export const DEFAULT_REACTION_GO = '#27ae60'

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
  { id: 'lilac',   name: 'Lilac',   start: '#b993d6', stop: '#8ca6db' },
  { id: 'mono',    name: 'Mono',    start: '#1f1f23', stop: '#3a3a44' },

  // ---------- Locked (purchasable in the shop) ----------
  {
    id: 'mint',
    name: 'Mint',
    start: '#0f3443',
    stop: '#34e89e',
    locked: true,
    cost: 100,
    reactionWait: '#082a26',
    reactionGo: '#34e89e',
  },
  {
    id: 'candy',
    name: 'Candy',
    start: '#ff6ec4',
    stop: '#7873f5',
    locked: true,
    cost: 200,
    reactionWait: '#3a2a8a',
    reactionGo: '#ff6ec4',
  },
  {
    id: 'ember',
    name: 'Ember',
    start: '#3a1c1c',
    stop: '#ff5e3a',
    locked: true,
    cost: 350,
    reactionWait: '#2a1010',
    reactionGo: '#ff5e3a',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    start: '#0f0c29',
    stop: '#302b63',
    locked: true,
    cost: 500,
    reactionWait: '#0a0716',
    reactionGo: '#7c3aed',
  },
  {
    id: 'noir',
    name: 'Noir',
    start: '#000000',
    stop: '#434343',
    locked: true,
    cost: 750,
    reactionWait: '#000000',
    reactionGo: '#ffffff',
  },
]
