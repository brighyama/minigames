import { Card } from './Card'
import { handTotal, type Card as CardT, type PlayerHand } from './lib'

type Props = {
  /** Cards to render. */
  cards: CardT[]
  /** When set, last card is rendered face-down (for dealer hole card). */
  hideLast?: boolean
  /** Label above the hand. */
  label: string
  /** Optional bet badge shown next to label. */
  bet?: number
  /** Optional badge text (e.g. "BLACKJACK", "BUST"). */
  badge?: string
  /** When true, draws a glow ring around the hand (active split hand). */
  active?: boolean
  /** When true, hides the total badge (useful while dealing). */
  hideTotal?: boolean
}

export function Hand({
  cards,
  hideLast,
  label,
  bet,
  badge,
  active,
  hideTotal,
}: Props) {
  const visible = hideLast ? cards.slice(0, -1) : cards
  const { total, soft } = handTotal(visible)
  const totalLabel =
    visible.length === 0
      ? ''
      : soft && total !== 21
        ? `${total - 10}/${total}`
        : `${total}`

  return (
    <div className={`bj-hand ${active ? 'is-active' : ''}`}>
      <div className="bj-hand-label">
        <span>{label}</span>
        {bet !== undefined && (
          <span className="bj-hand-bet">{bet.toLocaleString()}</span>
        )}
        {badge && <span className="bj-hand-badge">{badge}</span>}
      </div>
      <div className="bj-hand-cards">
        {cards.map((c, i) => (
          <Card
            key={i}
            card={c}
            faceDown={hideLast && i === cards.length - 1}
            index={i}
          />
        ))}
      </div>
      {!hideTotal && totalLabel && (
        <div className="bj-hand-total">{totalLabel}</div>
      )}
    </div>
  )
}

/** Convenience: derive a badge string from a hand's status. */
export function badgeFor(hand: PlayerHand): string | undefined {
  switch (hand.status) {
    case 'blackjack':
      return 'BLACKJACK'
    case 'busted':
      return 'BUST'
    case 'surrendered':
      return 'SURRENDER'
    case 'standing':
      return undefined
    default:
      return undefined
  }
}
