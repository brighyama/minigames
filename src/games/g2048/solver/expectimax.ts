// Default 2048 solver: depth-limited expectimax search over a hand-tuned
// heuristic. This is intentionally self-contained and dependency-free so it can
// serve as a baseline you can later benchmark your own algorithms against.
//
// Search model:
//   - MAX nodes  = the player choosing one of four moves.
//   - CHANCE nodes = the game dropping a random tile (2 at 90%, 4 at 10%) onto
//     a uniformly-random empty cell.
// The value of a position is the expected heuristic score under optimal play to
// a fixed depth, where depth adapts to how full the board is (fuller boards have
// less branching, so we can afford to look deeper).

import { move, type Board, type Dir } from '../lib'
import type { Solver } from './types'

const DIRS: Dir[] = ['up', 'down', 'left', 'right']

// Snake/gradient positional weights (row-major). Rewards arranging tiles in a
// descending "snake" anchored in the top-left corner — the standard strong
// shape for 2048.
const SNAKE = [
  15, 14, 13, 12,
   8,  9, 10, 11,
   7,  6,  5,  4,
   0,  1,  2,  3,
]

function countEmpty(b: Board): number {
  let n = 0
  for (let i = 0; i < 16; i++) if (b[i] === 0) n++
  return n
}

function emptyIndices(b: Board): number[] {
  const out: number[] = []
  for (let i = 0; i < 16; i++) if (b[i] === 0) out.push(i)
  return out
}

/** Tiles dotted with the snake weights (in log space to keep magnitudes sane). */
function gradient(b: Board): number {
  let s = 0
  for (let i = 0; i < 16; i++) if (b[i] !== 0) s += SNAKE[i] * Math.log2(b[i])
  return s
}

/** Penalize roughness between neighbouring tiles (smoother boards merge easier). */
function smoothness(b: Board): number {
  let s = 0
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = b[r * 4 + c]
      if (v === 0) continue
      const lv = Math.log2(v)
      const right = b[r * 4 + c + 1]
      const down = b[(r + 1) * 4 + c]
      if (c < 3 && right !== 0) s -= Math.abs(lv - Math.log2(right))
      if (r < 3 && down !== 0) s -= Math.abs(lv - Math.log2(down))
    }
  }
  return s
}

/** Static evaluation of a board (higher = better for the player). */
function evaluate(b: Board): number {
  return gradient(b) * 1.0 + countEmpty(b) * 2.7 + smoothness(b) * 0.3
}

export type ExpectimaxOptions = {
  /** Override how search depth is chosen from the number of empty cells. */
  depthFor?: (empties: number) => number
}

function defaultDepth(empties: number): number {
  if (empties >= 6) return 2
  if (empties >= 3) return 3
  return 4
}

export function createExpectimaxSolver(opts: ExpectimaxOptions = {}): Solver {
  const depthFor = opts.depthFor ?? defaultDepth

  // MAX node: the player picks the move with the highest expected value.
  function maxNode(b: Board, depth: number): number {
    if (depth <= 0) return evaluate(b)
    let best = -Infinity
    for (const d of DIRS) {
      const res = move(b, d)
      if (!res.moved) continue
      const v = chanceNode(res.board, depth - 1)
      if (v > best) best = v
    }
    // No legal move from here → terminal loss; bias the solver away from it.
    return best === -Infinity ? evaluate(b) - 1e6 : best
  }

  // CHANCE node: average over every possible random tile drop.
  function chanceNode(b: Board, depth: number): number {
    if (depth <= 0) return evaluate(b)
    const cells = emptyIndices(b)
    if (cells.length === 0) return evaluate(b)
    let total = 0
    for (const idx of cells) {
      for (const [val, p] of [
        [2, 0.9],
        [4, 0.1],
      ] as const) {
        const child = b.slice()
        child[idx] = val
        total += p * maxNode(child, depth)
      }
    }
    return total / cells.length
  }

  return {
    name: 'Expectimax',
    chooseMove(board: Board): Dir | null {
      const depth = depthFor(countEmpty(board))
      let best: Dir | null = null
      let bestVal = -Infinity
      for (const d of DIRS) {
        const res = move(board, d)
        if (!res.moved) continue
        const v = chanceNode(res.board, depth - 1)
        if (v > bestVal) {
          bestVal = v
          best = d
        }
      }
      return best
    },
  }
}
