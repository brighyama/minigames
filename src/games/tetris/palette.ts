// Tetromino colors for the canvas renderer.
//
// Design note: unlike 2048's tiles, the seven pieces keep a *constant, vivid
// hue identity* across every theme (cyan I, yellow O, purple T, green S, red Z,
// blue J, orange L). Distinguishing pieces by color is a gameplay requirement —
// recoloring them per theme would make the board harder to read — so theme
// integration instead happens around the pieces: the board panel is translucent
// (the active theme's page gradient shows through), and the grid, board glow,
// and line-clear flash are driven by the theme's --accent-1/--accent-2 vars in
// styles.css. The pieces themselves stay readable on any background.

import { TYPE_ID, type PieceType } from './lib'

/** Vivid, mutually-distinguishable guideline colors, one per tetromino. */
export const PIECE_COLORS: Record<PieceType, string> = {
  I: '#22d3d3',
  O: '#f4c430',
  T: '#b15bd8',
  S: '#46c84a',
  Z: '#ef4444',
  J: '#4a6cf0',
  L: '#f59331',
}

/** Lighter top-edge highlight per piece, for a subtle beveled look. */
export const PIECE_HIGHLIGHTS: Record<PieceType, string> = {
  I: '#7defef',
  O: '#ffe488',
  T: '#d49bf0',
  S: '#8ce98f',
  Z: '#f79a9a',
  J: '#90a4f7',
  L: '#fbc488',
}

/** Reverse lookup: board cell id (1..7) -> piece type. */
const ID_TO_TYPE: PieceType[] = []
for (const t of Object.keys(TYPE_ID) as PieceType[]) ID_TO_TYPE[TYPE_ID[t]] = t

export function typeForId(id: number): PieceType | null {
  return ID_TO_TYPE[id] ?? null
}
