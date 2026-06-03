export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export type Card = {
  rank: Rank
  suit: Suit
}

export type RoundId = 1 | 2 | 3 | 4

export type Guess =
  | 'red'
  | 'black'
  | 'higher'
  | 'lower'
  | 'inside'
  | 'outside'
  | Suit

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

export const ROUND_MULTIPLIER: Record<RoundId, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 20,
}

export const SUIT_LABEL: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
}

export function newDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ rank, suit })
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function cardValue(card: Card): number {
  if (card.rank === 'A') return 14
  if (card.rank === 'K') return 13
  if (card.rank === 'Q') return 12
  if (card.rank === 'J') return 11
  return Number(card.rank)
}

export function colorOf(card: Card): 'red' | 'black' {
  return card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'
}

export function draw(deck: Card[]): Card {
  const card = deck.shift()
  if (!card) throw new Error('deck is empty')
  return card
}

export function isCorrectGuess(round: RoundId, guess: Guess, cards: Card[], drawn: Card): boolean {
  if (round === 1) return guess === colorOf(drawn)
  if (round === 2) {
    const first = cards[0]
    if (!first) return false
    return guess === 'higher'
      ? cardValue(drawn) >= cardValue(first)
      : guess === 'lower' && cardValue(drawn) < cardValue(first)
  }
  if (round === 3) {
    const [first, second] = cards
    if (!first || !second) return false
    const low = Math.min(cardValue(first), cardValue(second))
    const high = Math.max(cardValue(first), cardValue(second))
    const value = cardValue(drawn)
    const inside = value > low && value < high
    return guess === 'inside' ? inside : guess === 'outside' && !inside
  }
  return guess === drawn.suit
}

export function nextRound(round: RoundId): RoundId | null {
  return round === 4 ? null : ((round + 1) as RoundId)
}

export function payoutFor(wager: number, round: RoundId): number {
  return wager * ROUND_MULTIPLIER[round]
}

export function abbrev(n: number): string {
  if (n >= 1000) {
    const k = n / 1000
    return (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'K'
  }
  return `${n}`
}
