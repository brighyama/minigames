// Pure minesweeper logic — no React, no Supabase. The board is a flat array of
// cells indexed `row * cols + col`. All mutating helpers clone the board so the
// component can treat state immutably.

export type Difficulty = 'easy' | 'medium' | 'hard'

export type DifficultyDef = {
  id: Difficulty
  label: string
  cols: number
  rows: number
  mines: number
}

// Classic Windows minesweeper presets (well-known so the leaderboard times are
// comparable to the rest of the world's).
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: { id: 'easy', label: 'easy', cols: 9, rows: 9, mines: 10 },
  medium: { id: 'medium', label: 'medium', cols: 16, rows: 16, mines: 40 },
  hard: { id: 'hard', label: 'hard', cols: 25, rows: 25, mines: 120 },
}

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard']

export type CellState = 'hidden' | 'revealed' | 'flagged'

export type Cell = {
  mine: boolean
  /** Count of mines in the 8 neighbours. Meaningful once mines are placed. */
  adjacent: number
  state: CellState
}

export type Board = {
  cols: number
  rows: number
  mines: number
  cells: Cell[]
  /** False until the first reveal places mines (first-click safety). */
  seeded: boolean
}

export function createBoard(def: DifficultyDef): Board {
  const cells: Cell[] = Array.from({ length: def.cols * def.rows }, () => ({
    mine: false,
    adjacent: 0,
    state: 'hidden' as CellState,
  }))
  return { cols: def.cols, rows: def.rows, mines: def.mines, cells, seeded: false }
}

function cloneBoard(board: Board): Board {
  return { ...board, cells: board.cells.map((c) => ({ ...c })) }
}

/** Indices of the (up to 8) neighbours of `index`. */
export function neighbors(index: number, cols: number, rows: number): number[] {
  const r = Math.floor(index / cols)
  const c = index % cols
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      out.push(nr * cols + nc)
    }
  }
  return out
}

// Place mines on a fresh board, guaranteeing `safeIndex` and its neighbours are
// never mined so the first click always opens a pocket. Recomputes adjacency.
function seedMines(board: Board, safeIndex: number): void {
  const { cols, rows, mines, cells } = board
  const total = cols * rows
  const forbidden = new Set<number>([safeIndex, ...neighbors(safeIndex, cols, rows)])

  // If the board is too small to keep the whole 3x3 safe (e.g. tiny custom
  // sizes), fall back to only protecting the clicked cell.
  const protect = total - forbidden.size >= mines ? forbidden : new Set([safeIndex])

  const candidates: number[] = []
  for (let i = 0; i < total; i++) if (!protect.has(i)) candidates.push(i)

  // Fisher–Yates partial shuffle: pick the first `mines` after shuffling.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  for (let m = 0; m < mines; m++) cells[candidates[m]].mine = true

  for (let i = 0; i < total; i++) {
    if (cells[i].mine) continue
    cells[i].adjacent = neighbors(i, cols, rows).filter((n) => cells[n].mine).length
  }
  board.seeded = true
}

export type RevealResult = {
  board: Board
  /** True if a mine was uncovered (game over). */
  hitMine: boolean
}

// Reveal `index`. Seeds mines on the first reveal (first-click safety). A blank
// (0-adjacent) cell flood-fills its neighbours. Flagged cells are ignored.
export function reveal(board: Board, index: number): RevealResult {
  const next = cloneBoard(board)
  if (!next.seeded) seedMines(next, index)

  const cell = next.cells[index]
  if (cell.state !== 'hidden') return { board: next, hitMine: false }

  if (cell.mine) {
    cell.state = 'revealed'
    return { board: next, hitMine: true }
  }

  const stack = [index]
  while (stack.length) {
    const i = stack.pop()!
    const c = next.cells[i]
    if (c.state === 'revealed' || c.mine) continue
    if (c.state === 'flagged') continue
    c.state = 'revealed'
    if (c.adjacent === 0) {
      for (const n of neighbors(i, next.cols, next.rows)) {
        if (next.cells[n].state === 'hidden') stack.push(n)
      }
    }
  }
  return { board: next, hitMine: false }
}

// Chord: clicking a revealed number whose adjacent-flag count equals its number
// reveals all its non-flagged hidden neighbours at once. Returns hitMine if one
// of those neighbours was a wrongly-deduced mine.
export function chord(board: Board, index: number): RevealResult {
  const cell = board.cells[index]
  if (cell.state !== 'revealed' || cell.adjacent === 0) {
    return { board, hitMine: false }
  }
  const ns = neighbors(index, board.cols, board.rows)
  const flagged = ns.filter((n) => board.cells[n].state === 'flagged').length
  if (flagged !== cell.adjacent) return { board, hitMine: false }

  let result: RevealResult = { board, hitMine: false }
  for (const n of ns) {
    if (result.board.cells[n].state === 'hidden') {
      const r = reveal(result.board, n)
      result = { board: r.board, hitMine: result.hitMine || r.hitMine }
    }
  }
  return result
}

export function toggleFlag(board: Board, index: number): Board {
  const cell = board.cells[index]
  if (cell.state === 'revealed') return board
  const next = cloneBoard(board)
  next.cells[index].state = cell.state === 'flagged' ? 'hidden' : 'flagged'
  return next
}

/** Won when every non-mine cell is revealed. */
export function hasWon(board: Board): boolean {
  if (!board.seeded) return false
  return board.cells.every((c) => c.mine || c.state === 'revealed')
}

export function flagCount(board: Board): number {
  return board.cells.reduce((n, c) => n + (c.state === 'flagged' ? 1 : 0), 0)
}

// On loss, expose every mine and mark the flags that were wrong. Used purely
// for the reveal-all display when the player hits a mine.
export function revealAllMines(board: Board): Board {
  const next = cloneBoard(board)
  for (const c of next.cells) {
    if (c.mine && c.state !== 'flagged') c.state = 'revealed'
  }
  return next
}

/** "M:SS" once past a minute, otherwise plain seconds. */
export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}`
}
