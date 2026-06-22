import {
  clearLines,
  collides,
  HEIGHT,
  hardDropPosition,
  idx,
  lockPiece,
  pieceCells,
  spawnPiece,
  WIDTH,
  type Board,
  type Piece,
  type PieceType,
  type TSpin,
} from './lib'

/** Board-cell id reserved for neutral garbage blocks. */
export const GARBAGE_ID = 8

export type BotDifficulty = 'rookie' | 'steady' | 'fast' | 'expert'

export type BotConfig = {
  label: string
  description: string
  moveMs: number
  previewMs: number
  mistakeChance: number
  mistakePool: number
}

export const BOT_DIFFICULTIES: Record<BotDifficulty, BotConfig> = {
  rookie: {
    label: 'rookie',
    description: 'slow and messy',
    moveMs: 940,
    previewMs: 180,
    mistakeChance: 0.48,
    mistakePool: 10,
  },
  steady: {
    label: 'steady',
    description: 'clean fundamentals',
    moveMs: 590,
    previewMs: 130,
    mistakeChance: 0.2,
    mistakePool: 5,
  },
  fast: {
    label: 'fast',
    description: 'quick, small mistakes',
    moveMs: 370,
    previewMs: 90,
    mistakeChance: 0.07,
    mistakePool: 3,
  },
  expert: {
    label: 'expert',
    description: 'relentless optimizer',
    moveMs: 235,
    previewMs: 65,
    mistakeChance: 0,
    mistakePool: 1,
  },
}

export const BOT_DIFFICULTY_ORDER: BotDifficulty[] = ['rookie', 'steady', 'fast', 'expert']

export function isBotDifficulty(value: string | null): value is BotDifficulty {
  return value != null && BOT_DIFFICULTY_ORDER.includes(value as BotDifficulty)
}

/**
 * Guideline-inspired versus attack. `combo` is the current consecutive-clear
 * count (first clear = 1); `wasB2B` says the previous clear was difficult.
 */
export function attackForClear(
  lines: number,
  tspin: TSpin,
  combo: number,
  wasB2B: boolean,
  perfect: boolean,
): number {
  if (lines <= 0) return 0

  let attack: number
  if (tspin === 'full') attack = [0, 2, 4, 6][lines] ?? 0
  else if (tspin === 'mini') attack = [0, 1, 2][lines] ?? 0
  else attack = [0, 0, 1, 2, 4][lines] ?? 0

  const difficult = lines === 4 || tspin !== 'none'
  if (difficult && wasB2B) attack += 1

  // Gentle combo ramp: +1 at combo 2, then another line every two clears.
  if (combo > 1) attack += Math.min(5, Math.ceil((combo - 1) / 2))
  if (perfect) attack += 10
  return attack
}

/**
 * Push garbage into the bottom of a board. Each entry is the hole column for
 * one row. Returns true when occupied cells were pushed above the board.
 */
export function addGarbage(board: Board, holes: number[]): boolean {
  if (holes.length === 0) return false
  const count = Math.min(HEIGHT, holes.length)
  let overflow = false
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (board[idx(x, y)] !== 0) overflow = true
    }
  }

  if (count >= HEIGHT) {
    board.fill(GARBAGE_ID)
  } else {
    board.copyWithin(0, count * WIDTH)
    board.fill(0, (HEIGHT - count) * WIDTH)
  }

  for (let row = 0; row < count; row++) {
    const y = HEIGHT - count + row
    const hole = Math.max(0, Math.min(WIDTH - 1, holes[row]))
    for (let x = 0; x < WIDTH; x++) board[idx(x, y)] = x === hole ? 0 : GARBAGE_ID
  }
  return overflow
}

export type BotPlacement = {
  piece: Piece
  score: number
  cleared: number
}

export type BotChoice = {
  useHold: boolean
  placement: BotPlacement
}

function columnMetrics(board: Board) {
  const heights: number[] = []
  let holes = 0
  let coveredHoles = 0

  for (let x = 0; x < WIDTH; x++) {
    let first = HEIGHT
    let blocksAbove = 0
    for (let y = 0; y < HEIGHT; y++) {
      const filled = board[idx(x, y)] !== 0
      if (filled && first === HEIGHT) first = y
      if (filled) blocksAbove++
      else if (first !== HEIGHT) {
        holes++
        coveredHoles += blocksAbove
      }
    }
    heights.push(HEIGHT - first)
  }

  let bumpiness = 0
  let wells = 0
  for (let x = 0; x < WIDTH; x++) {
    if (x > 0) bumpiness += Math.abs(heights[x] - heights[x - 1])
    const left = x === 0 ? heights[x] + 2 : heights[x - 1]
    const right = x === WIDTH - 1 ? heights[x] + 2 : heights[x + 1]
    wells += Math.max(0, Math.min(left, right) - heights[x])
  }

  return {
    aggregateHeight: heights.reduce((sum, height) => sum + height, 0),
    maxHeight: Math.max(...heights),
    holes,
    coveredHoles,
    bumpiness,
    wells,
  }
}

function evaluatePlacement(board: Board, piece: Piece): BotPlacement {
  const test = board.slice()
  lockPiece(test, piece)
  const cleared = clearLines(test).length
  const metrics = columnMetrics(test)

  // A compact, intentionally human-ish evaluator. Holes dominate; line clears
  // and a shallow, smooth surface are rewarded.
  const score =
    cleared * 4.2 -
    metrics.aggregateHeight * 0.42 -
    metrics.maxHeight * 0.8 -
    metrics.holes * 5.8 -
    metrics.coveredHoles * 0.22 -
    metrics.bumpiness * 0.34 +
    metrics.wells * 0.12

  return { piece, score, cleared }
}

export function botPlacements(board: Board, type: PieceType): BotPlacement[] {
  const out: BotPlacement[] = []
  const rotations = type === 'O' ? 1 : 4
  const seen = new Set<string>()

  for (let rot = 0; rot < rotations; rot++) {
    for (let x = -2; x < WIDTH + 2; x++) {
      const start = { ...spawnPiece(type), rot, x }
      if (collides(board, start)) continue
      const landed = hardDropPosition(board, start)
      const cells = pieceCells(landed)
      if (cells.some(([cx, cy]) => cx < 0 || cx >= WIDTH || cy < 0 || cy >= HEIGHT)) continue
      const signature = cells
        .map(([cx, cy]) => `${cx},${cy}`)
        .sort()
        .join('|')
      if (seen.has(signature)) continue
      seen.add(signature)
      out.push(evaluatePlacement(board, landed))
    }
  }

  return out.sort((a, b) => b.score - a.score)
}

/**
 * Pick a legal placement for the bot, optionally considering hold. Weaker
 * difficulties occasionally choose from a wider pool of suboptimal moves.
 */
export function chooseBotPlacement(
  board: Board,
  current: PieceType,
  hold: PieceType | null,
  next: PieceType,
  canHold: boolean,
  difficulty: BotDifficulty,
): BotChoice | null {
  const choices: BotChoice[] = botPlacements(board, current).map((placement) => ({
    useHold: false,
    placement,
  }))

  if (canHold) {
    const heldType = hold ?? next
    choices.push(
      ...botPlacements(board, heldType).map((placement) => ({
        useHold: true,
        placement,
      })),
    )
  }

  choices.sort((a, b) => b.placement.score - a.placement.score)
  if (choices.length === 0) return null

  const config = BOT_DIFFICULTIES[difficulty]
  if (Math.random() >= config.mistakeChance) return choices[0]
  const pool = Math.min(choices.length, config.mistakePool)
  // Bias mistakes toward the better end of the pool instead of pure chaos.
  const index = Math.min(pool - 1, Math.floor(Math.random() * Math.random() * pool))
  return choices[index]
}
