// Pure Tetris engine — no React, no Supabase. Implements the guideline
// mechanics that give the game its "TETR.IO" feel: Super Rotation System (SRS)
// with wall kicks, a 7-bag randomizer, T-spin detection, and line clearing.
//
// Coordinate system: the board is WIDTH x HEIGHT cells, row-major in a flat
// Uint8Array (0 = empty, 1..7 = a locked piece colored by type). y grows
// DOWNWARD (row 0 is the top). The top BUFFER rows are hidden; only the bottom
// VISIBLE rows are drawn. Pieces spawn in the hidden buffer and fall into view.

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

export const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

/** Cell value written into the board for each type (1..7). 0 stays "empty". */
export const TYPE_ID: Record<PieceType, number> = {
  I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7,
}

export const WIDTH = 10
/** Total rows, including the hidden spawn buffer above the visible field. */
export const HEIGHT = 40
/** Rows actually drawn (the bottom VISIBLE rows of the board). */
export const VISIBLE = 20
/** Index of the first visible row. Rows above this are the hidden buffer. */
export const HIDDEN = HEIGHT - VISIBLE

// Rotation states for each tetromino, as filled [col,row] cells inside a local
// bounding box (3x3 for JLSTZ, 4x4 for I, 2x2-ish for O). States are ordered
// 0=spawn, 1=clockwise, 2=180, 3=counter-clockwise, matching SRS.
type Cell = [number, number]
const SHAPES: Record<PieceType, Cell[][]> = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
}

// SRS wall-kick offsets, expressed in screen coordinates (y grows downward, so
// these are the standard guideline tables with the y component negated). Keyed
// by "<from><to>" rotation indices. Each entry is tried in order; the first one
// that doesn't collide is the rotation result.
const KICKS_JLSTZ: Record<string, Cell[]> = {
  '01': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '10': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '12': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '21': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '23': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '32': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '30': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '03': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
}
const KICKS_I: Record<string, Cell[]> = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
}
// 180-degree rotation kicks (TETR.IO allows 180 spins; SRS proper does not).
// A compact symmetric table: try in place, then small nudges.
const KICKS_180: Cell[] = [[0, 0], [0, -1], [1, 0], [-1, 0], [1, -1], [-1, -1], [0, 1]]

export type Piece = {
  type: PieceType
  /** Rotation state 0..3. */
  rot: number
  /** Bounding-box top-left position on the board. */
  x: number
  y: number
}

export type Board = Uint8Array

export function createBoard(): Board {
  return new Uint8Array(WIDTH * HEIGHT)
}

export function idx(x: number, y: number): number {
  return y * WIDTH + x
}

/** Absolute board cells occupied by a piece in its current state. */
export function pieceCells(p: Piece): Cell[] {
  return SHAPES[p.type][p.rot].map(([cx, cy]) => [p.x + cx, p.y + cy] as Cell)
}

/** True if the piece overlaps a wall, the floor, or a filled cell. */
export function collides(board: Board, p: Piece): boolean {
  for (const [x, y] of pieceCells(p)) {
    if (x < 0 || x >= WIDTH || y >= HEIGHT) return true
    // y < 0 is above the board top — treat as a collision.
    if (y < 0) return true
    if (board[idx(x, y)] !== 0) return true
  }
  return false
}

/** Spawn a piece in the hidden buffer, centered horizontally. */
export function spawnPiece(type: PieceType): Piece {
  // 3x3 / 4x4 boxes both center at x=3 on a 10-wide field. Spawn so the piece's
  // lowest cells sit just above the visible field (one row peeking in).
  const y = type === 'I' ? HIDDEN - 3 : HIDDEN - 2
  return { type, rot: 0, x: 3, y }
}

/** Move by (dx,dy) if the result is legal; returns the moved piece or null. */
export function tryMove(board: Board, p: Piece, dx: number, dy: number): Piece | null {
  const next = { ...p, x: p.x + dx, y: p.y + dy }
  return collides(board, next) ? null : next
}

export type RotateResult = { piece: Piece; kick: number } | null

/**
 * Rotate using SRS wall kicks. dir: +1 = CW, -1 = CCW, 2 = 180. Returns the
 * rotated piece plus the index of the kick that succeeded (0 = no kick), or
 * null if every kick collides. The kick index feeds T-spin detection.
 */
export function tryRotate(board: Board, p: Piece, dir: 1 | -1 | 2): RotateResult {
  if (p.type === 'O') return null
  const from = p.rot
  const to = (from + (dir === 2 ? 2 : dir) + 4) % 4
  let kicks: Cell[]
  if (dir === 2) kicks = KICKS_180
  else kicks = (p.type === 'I' ? KICKS_I : KICKS_JLSTZ)[`${from}${to}`]
  for (let i = 0; i < kicks.length; i++) {
    const [kx, ky] = kicks[i]
    const next: Piece = { ...p, rot: to, x: p.x + kx, y: p.y + ky }
    if (!collides(board, next)) return { piece: next, kick: i }
  }
  return null
}

/** Drop the piece straight down to its resting position. */
export function hardDropPosition(board: Board, p: Piece): Piece {
  let cur = p
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = tryMove(board, cur, 0, 1)
    if (!next) return cur
    cur = next
  }
}

/** Write a piece's cells into the board (mutates `board`). */
export function lockPiece(board: Board, p: Piece): void {
  const id = TYPE_ID[p.type]
  for (const [x, y] of pieceCells(p)) {
    if (y >= 0 && y < HEIGHT && x >= 0 && x < WIDTH) board[idx(x, y)] = id
  }
}

/**
 * Remove all full rows (mutates `board`, shifting everything above down and
 * inserting empty rows at the top). Returns the cleared row indices (top-down).
 */
export function clearLines(board: Board): number[] {
  const cleared: number[] = []
  for (let y = 0; y < HEIGHT; y++) {
    let full = true
    for (let x = 0; x < WIDTH; x++) {
      if (board[idx(x, y)] === 0) { full = false; break }
    }
    if (full) cleared.push(y)
  }
  if (cleared.length === 0) return cleared
  const clearedSet = new Set(cleared)
  const rows: Uint8Array[] = []
  for (let y = 0; y < HEIGHT; y++) {
    if (!clearedSet.has(y)) rows.push(board.slice(y * WIDTH, y * WIDTH + WIDTH))
  }
  board.fill(0)
  // Re-stack surviving rows at the bottom, leaving empty rows on top.
  let dest = HEIGHT - rows.length
  for (const row of rows) {
    board.set(row, dest * WIDTH)
    dest++
  }
  return cleared
}

export type TSpin = 'none' | 'mini' | 'full'

/**
 * Detect a T-spin using the 3-corner rule. Only valid when the last successful
 * action was a rotation. A T-spin requires 3+ of the four corners around the
 * T's center to be blocked; it's "full" when both front corners are blocked (or
 * the rotation used the special wide kick), otherwise "mini".
 */
export function detectTSpin(board: Board, p: Piece, lastWasRotation: boolean, kick: number): TSpin {
  if (p.type !== 'T' || !lastWasRotation) return 'none'
  // Center of the T's 3x3 box.
  const cx = p.x + 1
  const cy = p.y + 1
  const blocked = (dx: number, dy: number): boolean => {
    const x = cx + dx
    const y = cy + dy
    if (x < 0 || x >= WIDTH || y >= HEIGHT || y < 0) return true
    return board[idx(x, y)] !== 0
  }
  // The four diagonal corners.
  const tl = blocked(-1, -1)
  const tr = blocked(1, -1)
  const bl = blocked(-1, 1)
  const br = blocked(1, 1)
  const count = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0)
  if (count < 3) return 'none'
  // The two "front" corners depend on which way the T points (rot state).
  // rot 0 points up -> front = top corners; 1 right; 2 down; 3 left.
  const fronts: Record<number, [boolean, boolean]> = {
    0: [tl, tr],
    1: [tr, br],
    2: [bl, br],
    3: [tl, bl],
  }
  const [f1, f2] = fronts[p.rot]
  // Both front corners filled -> full T-spin. The far wide kick (index 4 in the
  // JLSTZ table, the TST-style kick) also promotes a mini to a full.
  if ((f1 && f2) || kick === 4) return 'full'
  return 'mini'
}

/** Fisher-Yates shuffle returning a new array. */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 7-bag randomizer: an endless queue where every group of 7 contains each
 * tetromino exactly once, so droughts and floods are impossible.
 */
export class SevenBag {
  private queue: PieceType[] = []

  /** Ensure at least `n` pieces are available to preview. */
  private fill(n: number): void {
    while (this.queue.length < n) this.queue.push(...shuffle(PIECE_TYPES))
  }

  /** Peek the next `n` upcoming pieces without consuming them. */
  peek(n: number): PieceType[] {
    this.fill(n)
    return this.queue.slice(0, n)
  }

  /** Take the next piece. */
  next(): PieceType {
    this.fill(1)
    return this.queue.shift()!
  }
}

/** Number of lines a clear is worth as "attack" (for combo/stat display). */
export function clearLabel(lines: number, tspin: TSpin, perfect: boolean): string {
  if (perfect) return 'perfect clear'
  if (tspin === 'full') {
    return ['t-spin', 't-spin single', 't-spin double', 't-spin triple'][lines] ?? 't-spin'
  }
  if (tspin === 'mini') return lines > 0 ? 't-spin mini' : ''
  return ['', 'single', 'double', 'triple', 'tetris'][lines] ?? ''
}

/** True if this clear continues a back-to-back chain (tetris or any t-spin clear). */
export function isB2BClear(lines: number, tspin: TSpin): boolean {
  if (lines === 0) return false
  return lines === 4 || tspin === 'full' || tspin === 'mini'
}
