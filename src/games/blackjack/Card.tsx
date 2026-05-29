import type { Card as CardT, Suit } from './lib'

const SUIT_GLYPH: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

type Props = {
  card?: CardT
  /** When true, renders a face-down card back. `card` is ignored. */
  faceDown?: boolean
  /** Index in a fanned hand — used for stagger animation. */
  index?: number
}

export function Card({ card, faceDown, index = 0 }: Props) {
  if (faceDown || !card) {
    return (
      <div
        className="bj-card is-back"
        style={{ animationDelay: `${index * 60}ms` }}
        aria-label="Face-down card"
      />
    )
  }
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
  return (
    <div
      className={`bj-card ${isRed ? 'is-red' : 'is-black'}`}
      style={{ animationDelay: `${index * 60}ms` }}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <div className="bj-card-corner top">
        <span className="bj-card-rank">{card.rank}</span>
        <span className="bj-card-suit">{SUIT_GLYPH[card.suit]}</span>
      </div>
      <div className="bj-card-center">{SUIT_GLYPH[card.suit]}</div>
      <div className="bj-card-corner bottom">
        <span className="bj-card-rank">{card.rank}</span>
        <span className="bj-card-suit">{SUIT_GLYPH[card.suit]}</span>
      </div>
    </div>
  )
}
