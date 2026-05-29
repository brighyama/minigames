// Pure roulette logic — European single-zero wheel (37 pockets, 0–36).
// No React, no Supabase. Mirrors the blackjack approach so a server can later
// own the RNG + payouts; for now everything runs client-side in preview mode.

export type Color = 'red' | 'black' | 'green'

/** Physical pocket order on a European wheel, clockwise starting at 0. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]

export const POCKET_COUNT = WHEEL_ORDER.length // 37

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
])

export function colorOf(n: number): Color {
  if (n === 0) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}

export function pocketIndex(n: number): number {
  return WHEEL_ORDER.indexOf(n)
}

// ---- Bets --------------------------------------------------------------

export type BetDef = {
  id: string
  /** Net odds to 1 (e.g. 35 means 35:1; total return on win is stake×(payout+1)). */
  payout: number
  covers: (winning: number) => boolean
  label: string
}

/**
 * Resolve a bet id to its definition. Ids:
 *   s-<n>      straight up (35:1)
 *   red/black  color (1:1)
 *   even/odd   parity (1:1)
 *   low/high   1–18 / 19–36 (1:1)
 *   d-1/2/3    dozens (2:1)
 *   c-top/mid/bot  columns (2:1)
 */
export function betDef(id: string): BetDef {
  if (id.startsWith('s-')) {
    const n = parseInt(id.slice(2), 10)
    return { id, payout: 35, label: `${n}`, covers: (w) => w === n }
  }
  switch (id) {
    case 'red':
      return { id, payout: 1, label: 'Red', covers: (w) => colorOf(w) === 'red' }
    case 'black':
      return { id, payout: 1, label: 'Black', covers: (w) => colorOf(w) === 'black' }
    case 'even':
      return { id, payout: 1, label: 'Even', covers: (w) => w !== 0 && w % 2 === 0 }
    case 'odd':
      return { id, payout: 1, label: 'Odd', covers: (w) => w % 2 === 1 }
    case 'low':
      return { id, payout: 1, label: '1–18', covers: (w) => w >= 1 && w <= 18 }
    case 'high':
      return { id, payout: 1, label: '19–36', covers: (w) => w >= 19 && w <= 36 }
    case 'd-1':
      return { id, payout: 2, label: '1st 12', covers: (w) => w >= 1 && w <= 12 }
    case 'd-2':
      return { id, payout: 2, label: '2nd 12', covers: (w) => w >= 13 && w <= 24 }
    case 'd-3':
      return { id, payout: 2, label: '3rd 12', covers: (w) => w >= 25 && w <= 36 }
    case 'c-top':
      return { id, payout: 2, label: '2:1', covers: (w) => w !== 0 && w % 3 === 0 }
    case 'c-mid':
      return { id, payout: 2, label: '2:1', covers: (w) => w % 3 === 2 }
    case 'c-bot':
      return { id, payout: 2, label: '2:1', covers: (w) => w % 3 === 1 }
    default:
      // Unknown id — never wins.
      return { id, payout: 0, label: id, covers: () => false }
  }
}

export type BetMap = Record<string, number>

export type RoundResult = {
  winning: number
  totalWagered: number
  /** Total returned to the player (winning stakes × (payout+1)). */
  totalReturn: number
  /** Net change this round: totalReturn − totalWagered. */
  net: number
  /** Bet ids that won. */
  winningBetIds: string[]
}

export function settleRound(bets: BetMap, winning: number): RoundResult {
  let totalWagered = 0
  let totalReturn = 0
  const winningBetIds: string[] = []
  for (const [id, amount] of Object.entries(bets)) {
    if (amount <= 0) continue
    totalWagered += amount
    const def = betDef(id)
    if (def.covers(winning)) {
      totalReturn += amount * (def.payout + 1)
      winningBetIds.push(id)
    }
  }
  return {
    winning,
    totalWagered,
    totalReturn,
    net: totalReturn - totalWagered,
    winningBetIds,
  }
}

/** Abbreviate a points amount: 1000→"1K", 2500→"2.5K", 100000→"100K". */
export function abbrev(n: number): string {
  if (n >= 1000) {
    const k = n / 1000
    return (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'K'
  }
  return `${n}`
}
