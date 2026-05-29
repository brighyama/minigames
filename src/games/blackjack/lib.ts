// Pure blackjack logic — no React, no Supabase. The same shapes will later be
// produced server-side, so keep types and totals in sync with what the RPCs
// will return.

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'

export type Card = { rank: Rank; suit: Suit }

export type HandStatus =
  | 'playing'
  | 'standing'
  | 'busted'
  | 'blackjack'
  | 'surrendered'

export type PlayerHand = {
  cards: Card[]
  bet: number
  status: HandStatus
  doubled: boolean
  /** Marks a hand that came from splitting aces — gets one card only. */
  splitAces: boolean
}

export type Outcome =
  | 'win'
  | 'lose'
  | 'push'
  | 'blackjack'
  | 'busted'
  | 'surrendered'

export type SettledHand = {
  hand: PlayerHand
  outcome: Outcome
  /** Net change to balance from THIS hand (excludes original bet that was already taken). */
  payout: number
}

export const NUM_DECKS = 6
export const BLACKJACK_PAYOUT = 1.5 // 3:2
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

export function newShoe(numDecks = NUM_DECKS): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < numDecks; d++) {
    for (const s of SUITS) for (const r of RANKS) cards.push({ rank: r, suit: s })
  }
  // Fisher–Yates
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

export function cardValue(rank: Rank): number {
  if (rank === 'A') return 1 // aces handled in handTotal
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10
  return parseInt(rank, 10)
}

/** Returns the best legal total ≤21 if possible, otherwise the hard total. */
export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const c of cards) {
    if (c.rank === 'A') aces++
    total += cardValue(c.rank)
  }
  // Upgrade aces from 1 → 11 while it doesn't bust.
  let soft = false
  while (aces > 0 && total + 10 <= 21) {
    total += 10
    aces--
    soft = true
  }
  return { total, soft }
}

export function isBlackjack(cards: Card[]): boolean {
  if (cards.length !== 2) return false
  const { total } = handTotal(cards)
  return total === 21
}

export function isBust(cards: Card[]): boolean {
  return handTotal(cards).total > 21
}

export function makeHand(cards: Card[], bet: number): PlayerHand {
  return {
    cards,
    bet,
    status: isBlackjack(cards) ? 'blackjack' : 'playing',
    doubled: false,
    splitAces: false,
  }
}

export function canDouble(hand: PlayerHand, balance: number): boolean {
  return (
    hand.status === 'playing' &&
    hand.cards.length === 2 &&
    !hand.splitAces &&
    balance >= hand.bet
  )
}

export function canSplit(hand: PlayerHand, balance: number): boolean {
  if (hand.status !== 'playing') return false
  if (hand.cards.length !== 2) return false
  if (balance < hand.bet) return false
  return cardValue(hand.cards[0].rank) === cardValue(hand.cards[1].rank)
}

/** Dealer plays: hits to 17. Stands on soft 17 (S17). */
export function playDealer(start: Card[], deck: Card[]): Card[] {
  const hand = [...start]
  while (true) {
    const { total } = handTotal(hand)
    if (total >= 17) break
    const next = deck.shift()
    if (!next) break
    hand.push(next)
  }
  return hand
}

/** Returns outcome + net payout (excluding the already-taken bet). */
export function settleHand(
  hand: PlayerHand,
  dealer: Card[],
): { outcome: Outcome; payout: number } {
  if (hand.status === 'surrendered') {
    return { outcome: 'surrendered', payout: hand.bet / 2 } // refund half
  }
  const playerTotal = handTotal(hand.cards).total
  if (playerTotal > 21) return { outcome: 'busted', payout: 0 }

  const dealerTotal = handTotal(dealer).total
  const dealerBJ = isBlackjack(dealer)
  const playerBJ = hand.status === 'blackjack'

  if (playerBJ && !dealerBJ) {
    return { outcome: 'blackjack', payout: hand.bet + hand.bet * BLACKJACK_PAYOUT }
  }
  if (playerBJ && dealerBJ) return { outcome: 'push', payout: hand.bet }
  if (!playerBJ && dealerBJ) return { outcome: 'lose', payout: 0 }

  if (dealerTotal > 21) return { outcome: 'win', payout: hand.bet * 2 }
  if (playerTotal > dealerTotal) return { outcome: 'win', payout: hand.bet * 2 }
  if (playerTotal === dealerTotal) return { outcome: 'push', payout: hand.bet }
  return { outcome: 'lose', payout: 0 }
}
