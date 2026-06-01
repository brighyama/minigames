// Pure case-opening logic -- no React, no Supabase. The case is a weighted
// distribution over chip multipliers and cosmetic unlocks. Signed-in opens are
// settled by `public.cases_open`; this client copy drives the reel visuals and
// the signed-out demo.
//
// IMPORTANT: CASE.items is mirrored exactly in supabase/schema.sql. Keep the
// same item order, weights, multipliers, cosmetic IDs, and duplicate values.

export type Rarity = 'green' | 'blue' | 'purple' | 'red' | 'gold'
export type RewardKind = 'chips' | 'cosmetic'
export type CosmeticKind = 'theme' | 'deck'

export const RARITY_LABEL: Record<Rarity, string> = {
  green: '1 star',
  blue: '2 stars',
  purple: '3 stars',
  red: '4 stars',
  gold: 'exclusive',
}

// Matches the site's rarity palette (see App.css rarity-* colors).
export const RARITY_COLOR: Record<Rarity, string> = {
  green: '#44d17a',
  blue: '#4ea1ff',
  purple: '#b86bff',
  red: '#ff5b5b',
  gold: '#ffd764',
}

export const RARITIES: Rarity[] = ['green', 'blue', 'purple', 'red', 'gold']

type BaseCaseItem = {
  rarity: Rarity
  /** Relative draw weight. The full table sums to 10000. */
  weight: number
}

export type ChipCaseItem = BaseCaseItem & {
  kind: 'chips'
  /** Payout factor on the wager. 0 = total loss. */
  multiplier: number
}

export type CosmeticCaseItem = BaseCaseItem & {
  kind: 'cosmetic'
  cosmeticKind: CosmeticKind
  cosmeticId: string
  cosmeticName: string
  /** Duplicate cosmetics pay this flat net profit, plus the original wager back. */
  duplicateProfit: number
}

export type CaseItem = ChipCaseItem | CosmeticCaseItem

export type CaseDef = {
  id: string
  name: string
  tagline: string
  /** Items in a FIXED order -- the server returns an index into this list. */
  items: CaseItem[]
}

// One canonical case. Multipliers alone have EV ~= 1.173; cosmetics are
// unlocks first, with generous flat duplicate-profit rewards by rarity.
export const CASE: CaseDef = {
  id: 'arcade',
  name: 'Arcade Case',
  tagline: 'multipliers and cosmetics',
  items: [
    { kind: 'chips', rarity: 'green', multiplier: 0, weight: 1700 },
    { kind: 'chips', rarity: 'green', multiplier: 0.4, weight: 2450 },
    {
      kind: 'cosmetic',
      rarity: 'green',
      cosmeticKind: 'theme',
      cosmeticId: 'mint',
      cosmeticName: 'mint theme',
      duplicateProfit: 100,
      weight: 350,
    },
    { kind: 'chips', rarity: 'blue', multiplier: 0.85, weight: 2400 },
    { kind: 'chips', rarity: 'blue', multiplier: 1.2, weight: 880 },
    {
      kind: 'cosmetic',
      rarity: 'blue',
      cosmeticKind: 'deck',
      cosmeticId: 'mono',
      cosmeticName: 'mono deck',
      duplicateProfit: 300,
      weight: 220,
    },
    { kind: 'chips', rarity: 'purple', multiplier: 2.5, weight: 1200 },
    {
      kind: 'cosmetic',
      rarity: 'purple',
      cosmeticKind: 'theme',
      cosmeticId: 'prism',
      cosmeticName: 'prism theme',
      duplicateProfit: 1200,
      weight: 300,
    },
    { kind: 'chips', rarity: 'red', multiplier: 7.5, weight: 220 },
    {
      kind: 'cosmetic',
      rarity: 'red',
      cosmeticKind: 'deck',
      cosmeticId: 'royal',
      cosmeticName: 'royal deck',
      duplicateProfit: 5000,
      weight: 180,
    },
    { kind: 'chips', rarity: 'gold', multiplier: 50, weight: 60 },
    {
      kind: 'cosmetic',
      rarity: 'gold',
      cosmeticKind: 'theme',
      cosmeticId: 'casino-royale',
      cosmeticName: 'casino royale theme',
      duplicateProfit: 20000,
      weight: 40,
    },
  ],
}

export function totalWeight(def: CaseDef): number {
  return def.items.reduce((s, it) => s + it.weight, 0)
}

/** Drop chance of an item, 0-1. */
export function chanceOf(def: CaseDef, item: CaseItem): number {
  return item.weight / totalWeight(def)
}

/** Combined drop chance for a rarity tier, 0-1. */
export function rarityChanceOf(def: CaseDef, rarity: Rarity): number {
  const rarityWeight = def.items
    .filter((it) => it.rarity === rarity)
    .reduce((s, it) => s + it.weight, 0)
  return rarityWeight / totalWeight(def)
}

/** Weighted random draw -- returns the index of the chosen item (local/demo). */
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

const VISUAL_RARITY_WEIGHT: Record<Rarity, number> = {
  green: 1,
  blue: 1.15,
  purple: 2,
  red: 2.2,
  gold: 2.5,
}

// The scrolling reel is presentation, not odds. Use boosted rarity weights so
// higher-tier tiles appear often enough to be exciting, while still rarer than
// common/blue tiles.
function pickVisualItemIndex(
  def: CaseDef,
  previousIndex: number | undefined,
  remainingByRarity: Partial<Record<Rarity, number>>,
): number {
  const visualWeights = def.items.map((item, index) => {
    if ((remainingByRarity[item.rarity] ?? Number.POSITIVE_INFINITY) <= 0) return 0
    const repeatPenalty = index === previousIndex ? 0.55 : 1
    return item.weight * VISUAL_RARITY_WEIGHT[item.rarity] * repeatPenalty
  })
  const total = visualWeights.reduce((s, w) => s + w, 0)
  if (total <= 0) return pickItemIndex(def)
  let r = Math.random() * total
  for (let i = 0; i < visualWeights.length; i++) {
    r -= visualWeights[i]
    if (r < 0) {
      const rarity = def.items[i].rarity
      if (remainingByRarity[rarity] !== undefined) remainingByRarity[rarity]!--
      return i
    }
  }
  return def.items.length - 1
}

// Build a reel of item indices for the spin animation: random (weighted) filler
// everywhere except the landing slot, which is forced to the real winner.
export function buildReel(def: CaseDef, winnerIndex: number): number[] {
  const reel: number[] = []
  const remainingByRarity: Partial<Record<Rarity, number>> = {
    red: 1,
    gold: Math.random() < 0.2 ? 1 : 0,
  }
  for (let i = 0; i < REEL_LENGTH; i++) {
    const previous = reel[i - 1]
    reel.push(
      i === REEL_LANDING
        ? winnerIndex
        : pickVisualItemIndex(def, previous, remainingByRarity),
    )
  }
  return reel
}

export function itemMultiplier(item: CaseItem): number {
  return item.kind === 'chips' ? item.multiplier : 0
}

export function itemLabel(item: CaseItem): string {
  if (item.kind === 'chips') return formatMultiplier(item.multiplier)
  return item.cosmeticName
}

/** "10x", "1.5x", "0.25x", "0x". */
export function formatMultiplier(m: number): string {
  return `${Number.isInteger(m) ? m : m.toFixed(m < 1 ? 2 : 1)}x`
}

/** Abbreviate a points amount: 1000->"1K", 2500->"2.5K". */
export function abbrev(n: number): string {
  if (n >= 1000) {
    const k = n / 1000
    return (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'K'
  }
  return `${n}`
}
