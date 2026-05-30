// Pure 2048 logic — no React, no Supabase. Board is a flat row-major array of
// length 16; 0 means an empty cell. All functions are pure (they return new
// boards) so the component can keep history/animation state if desired later.

export type Board = number[]
export type Dir = 'up' | 'down' | 'left' | 'right'

export const SIZE = 4
export const WIN_TILE = 2048

export function emptyBoard(): Board {
  return new Array(SIZE * SIZE).fill(0)
}

/** Indices of all empty cells. */
function emptyCells(board: Board): number[] {
  const out: number[] = []
  for (let i = 0; i < board.length; i++) if (board[i] === 0) out.push(i)
  return out
}

/** Add one tile (2 with 90% chance, 4 with 10%) to a random empty cell. */
export function spawn(board: Board): Board {
  const empties = emptyCells(board)
  if (empties.length === 0) return board
  const idx = empties[Math.floor(Math.random() * empties.length)]
  const next = board.slice()
  next[idx] = Math.random() < 0.9 ? 2 : 4
  return next
}

export function newGame(): Board {
  return spawn(spawn(emptyBoard()))
}

/** The four index lines for a direction, ordered front-first (toward the move). */
function lineIndices(dir: Dir): number[][] {
  const lines: number[][] = []
  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const line = [r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3]
      lines.push(dir === 'left' ? line : line.reverse())
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      const line = [c, c + 4, c + 8, c + 12]
      lines.push(dir === 'up' ? line : line.reverse())
    }
  }
  return lines
}

/** Compress + merge a single line toward the front. Returns the new line and
 *  the score gained from merges. */
function slideLine(vals: number[]): { result: number[]; gained: number } {
  const nonzero = vals.filter((v) => v !== 0)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < nonzero.length; i++) {
    if (i + 1 < nonzero.length && nonzero[i] === nonzero[i + 1]) {
      const merged = nonzero[i] * 2
      out.push(merged)
      gained += merged
      i++ // consume the merged partner
    } else {
      out.push(nonzero[i])
    }
  }
  while (out.length < SIZE) out.push(0)
  return { result: out, gained }
}

export type MoveResult = { board: Board; moved: boolean; gained: number }

/** Apply a move. `moved` is false when nothing shifted (an illegal move). */
export function move(board: Board, dir: Dir): MoveResult {
  const next = board.slice()
  let moved = false
  let gained = 0
  for (const idxs of lineIndices(dir)) {
    const vals = idxs.map((i) => board[i])
    const { result, gained: g } = slideLine(vals)
    gained += g
    idxs.forEach((bi, k) => {
      if (next[bi] !== result[k]) moved = true
      next[bi] = result[k]
    })
  }
  return { board: next, moved, gained }
}

/** True while at least one legal move remains. */
export function canMove(board: Board): boolean {
  for (let i = 0; i < board.length; i++) if (board[i] === 0) return true
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r * 4 + c]
      if (c < SIZE - 1 && board[r * 4 + c + 1] === v) return true
      if (r < SIZE - 1 && board[(r + 1) * 4 + c] === v) return true
    }
  }
  return false
}

export function highestTile(board: Board): number {
  return board.reduce((m, v) => (v > m ? v : m), 0)
}

export function hasWon(board: Board): boolean {
  return board.some((v) => v >= WIN_TILE)
}
