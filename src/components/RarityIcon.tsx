import type { Rarity } from '../lib/themes'

const STAR_PATH =
  'M8 1l1.9 4.6 5.1.5-3.9 3.5 1.1 5L8 12l-4.2 2.6 1.1-5L1 6.6l5.1-.5L8 1z'

const CROWN_PATH = 'M3 14L13 14L14 4L11 8L8 2L5 8L2 4Z'

export function RarityIcon({ rarity }: { rarity: Rarity }) {
  if (rarity === 'gold') {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        className="rarity-symbol rarity-symbol-crown"
      >
        <path d={CROWN_PATH} />
      </svg>
    )
  }
  const count = rarity === 'blue' ? 1 : rarity === 'purple' ? 2 : 3
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className="rarity-symbol rarity-symbol-star"
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </>
  )
}

export function rarityLabel(rarity: Rarity): string {
  if (rarity === 'gold') return 'Exclusive'
  const count = rarity === 'blue' ? 1 : rarity === 'purple' ? 2 : 3
  return `${count} star${count > 1 ? 's' : ''}`
}
