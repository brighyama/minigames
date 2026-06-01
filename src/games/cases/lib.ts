// Pure case-opening logic — no React, no Supabase. A "case" is a weighted
// distribution over reward tiers; opening it wagers points and pays
// `wager × multiplier` of whichever tier is drawn.
//
// IMPORTANT: the case tables here are mirrored exactly in SQL
// (`public.cases_open` in supabase/schema.sql). The server owns the RNG +
// payout for signed-in players; this client copy only drives the reel visuals
// and the signed-out demo. Keep the two in sync — same item order (so the
// returned index maps to the same tier), same weights, same multipliers.

export type Rarity = 'green' | 'blue' | 'purple' | 'red' | 'gold'

export const RARITY_LABEL: Record<Rarity, string> = {
  green: 'common',
  blue: 'uncommon',
  purple: 'rare',
  red: 'mythical',
  gold: 'legendary',
}

// Matches the site's rarity palette (see App.css rarity-* colors).
export const RARITY_COLOR: Record<Rarity, string> = {
  green: '#44d17a',
  blue: '#4ea1ff',
  purple: '#b86bff',
  red: '#ff5b5b',
  gold: '#ffd764',
}

export type CaseItem = {
  rarity: Rarity
  /** Payout factor on the wager. 0 = total loss. */
  multiplier: number
  /** Relative draw weight (integers; per-case they sum to 10000). */
  weight: number
}

export type CaseDef = {
  id: string
  name: string
  tagline: string
  /** Items in a FIXED order — the server returns an index into this list. */
  items: CaseItem[]
}

// Each case's items sum to weight 10000. The expected return (Σ p·mult) is kept
// below 1 for a house edge: standard ≈0.93, classified ≈0.95, covert ≈0.905.
export const CASES: CaseDef[] = [
  {
    id: 'standard',
    name: 'Standard Case',
    tagline: 'steady odds, gentle swings',
    items: [
      { rarity: 'green', multiplier: 0.2, weight: 4050 },
      { rarity: 'blue', multiplier: 0.75, weight: 3500 },
      { rarity: 'purple', multiplier: 1.5, weight: 1700 },
      { rarity: 'red', multiplier: 3, weight: 600 },
      { rarity: 'gold', multiplier: 10, weight: 150 },
    ],
  },
  {
    id: 'classified',
    name: 'Classified Case',
    tagline: 'bigger hits, sharper falls',
    items: [
      { rarity: 'green', multiplier: 0.1, weight: 4730 },
      { rarity: 'blue', multiplier: 0.6, weight: 3300 },
      { rarity: 'purple', multiplier: 1.8, weight: 1300 },
      { rarity: 'red', multiplier: 5, weight: 600 },
      { rarity: 'gold', multiplier: 25, weight: 70 },
    ],
  },
  {
    id: 'covert',
    name: 'Covert Case',
    tagline: 'high risk — chase the 50×',
    items: [
      { rarity: 'green', multiplier: 0, weight: 6000 },
      { rarity: 'blue', multiplier: 0.5, weight: 2500 },
      { rarity: 'purple', multiplier: 2, weight: 1050 },
      { rarity: 'red', multiplier: 8, weight: 400 },
      { rarity: 'gold', multiplier: 50, weight: 50 },
    ],
  },
]

export function caseById(id: string): CaseDef {
  return CASES.find((c) => c.id === id) ?? CASES[0]
}

export function totalWeight(def: CaseDef): number {
  return def.items.reduce((s, it) => s + it.weight, 0)
}

/** Drop chance of an item, 0–1. */
export function chanceOf(def: CaseDef, item: CaseItem): number {
  return item.weight / totalWeight(def)
}

/** Weighted random draw — returns the index of the chosen item (local/demo). */
export function pickItemIndex(def: CaseDef): number {
  const total = totalWeight(def)
  let r = Math.random() * total
  for (let i = 0; i < def.items.length; i++) {
    r -= def.items[i].weight
    if (r < 0) return i
  }
  return def.items.length - 1
}

export const REEL_LENGTH = 56
/** Index in the reel that lands under the center pointer. */
export const REEL_LANDING = 50

// Build a reel of item indices for the spin animation: random (weighted) filler
// everywhere except the landing slot, which is forced to the real winner.
export function buildReel(def: CaseDef, winnerIndex: number): number[] {
  const reel: number[] = []
  for (let i = 0; i < REEL_LENGTH; i++) {
    reel.push(i === REEL_LANDING ? winnerIndex : pickItemIndex(def))
  }
  return reel
}

/** "10×", "1.5×", "0.2×", "0×". */
export function formatMultiplier(m: number): string {
  return `${Number.isInteger(m) ? m : m.toFixed(m < 1 ? 2 : 1)}×`
}

/** Abbreviate a points amount: 1000→"1K", 2500→"2.5K". */
export function abbrev(n: number): string {
  if (n >= 1000) {
    const k = n / 1000
    return (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'K'
  }
  return `${n}`
}
