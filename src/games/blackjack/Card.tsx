import { CasinoCard } from '../../components/CasinoCard'
import type { Card as CardT } from './lib'

type Props = {
  card?: CardT
  /** When true, renders a face-down card back. `card` is ignored. */
  faceDown?: boolean
  /** Index in a fanned hand — used for stagger animation. */
  index?: number
}

export function Card({ card, faceDown, index = 0 }: Props) {
  return <CasinoCard card={card} faceDown={faceDown} index={index} className="bj-card" />
}
