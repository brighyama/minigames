type CasinoSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs'

type CardLike = {
  rank: string
  suit: CasinoSuit
}

const SUIT_GLYPH: Record<CasinoSuit, string> = {
  spades: '\u2660',
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
}

type Props = {
  card?: CardLike
  className?: string
  faceDown?: boolean
  index?: number
}

export function CasinoCard({ card, className = '', faceDown, index = 0 }: Props) {
  const delay = { animationDelay: `${index * 60}ms` }

  if (faceDown || !card) {
    return (
      <div
        className={`casino-card ${className} is-back`.trim()}
        style={delay}
        aria-label="Face-down card"
      />
    )
  }

  const glyph = SUIT_GLYPH[card.suit]
  const color = card.suit === 'hearts' || card.suit === 'diamonds' ? 'is-red' : 'is-black'

  return (
    <div
      className={`casino-card ${className} ${color}`.trim()}
      style={delay}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <div className="casino-card-corner">
        <span className="casino-card-rank">{card.rank}</span>
        <span className="casino-card-suit">{glyph}</span>
      </div>
      <div className="casino-card-center">{glyph}</div>
      <div className="casino-card-corner is-bottom">
        <span className="casino-card-rank">{card.rank}</span>
        <span className="casino-card-suit">{glyph}</span>
      </div>
    </div>
  )
}
