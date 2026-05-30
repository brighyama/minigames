import type { Rarity } from './themes'

/**
 * A card deck reskins playing cards used in card games (blackjack, future
 * poker/etc.). Active deck writes a set of CSS variables on `:root`, mirroring
 * how themes work. Card.tsx + styles.css consume these variables.
 *
 * The first deck is the default (always unlocked).
 */
export type CardDeck = {
  id: string
  name: string
  /** Card face background. */
  face: string
  /** Color used for ♥ and ♦ pips/ranks. */
  red: string
  /** Color used for ♠ and ♣ pips/ranks. */
  black: string
  /** CSS for the face-down card back (any valid background value). */
  back: string
  /** Optional border color shown around each card face. */
  border?: string
  /** Optional font-family override for ranks. */
  font?: string
  locked?: boolean
  cost?: number
  rarity?: Rarity
}

export const cardDecks: CardDeck[] = [
  // -------- Default --------
  {
    id: 'classic',
    name: 'classic',
    face: '#ffffff',
    red: '#c5283d',
    black: '#1a1a1a',
    back: 'repeating-linear-gradient(45deg, #2d3a8c 0, #2d3a8c 6px, #1a2466 6px, #1a2466 12px)',
    border: 'rgba(0, 0, 0, 0.1)',
  },

  // -------- Locked decks --------
  {
    id: 'mono',
    name: 'mono',
    face: '#0e0e12',
    red: '#e6e6e6',
    black: '#9aa0a6',
    back: 'linear-gradient(135deg, #1a1a20 0%, #2c2c34 100%)',
    border: 'rgba(255, 255, 255, 0.16)',
    locked: true,
    cost: 100,
    rarity: 'green',
  },
  {
    id: 'neon',
    name: 'neon',
    face: '#0a0a18',
    red: '#ff3e8a',
    black: '#00ffd5',
    back: 'linear-gradient(135deg, #ff3e8a 0%, #00ffd5 100%)',
    border: 'rgba(255, 62, 138, 0.55)',
    font: '"Courier New", ui-monospace, monospace',
    locked: true,
    cost: 10_000,
    rarity: 'purple',
  },
  {
    id: 'royal',
    name: 'royal',
    face: '#fff6e0',
    red: '#8b0a1a',
    black: '#1c1845',
    back:
      'repeating-linear-gradient(60deg, #8b0a1a 0 4px, #1c1845 4px 8px, #d4af37 8px 12px)',
    border: '#d4af37',
    font: 'Georgia, "Times New Roman", serif',
    locked: true,
    cost: 100_000,
    rarity: 'red',
  },
]
