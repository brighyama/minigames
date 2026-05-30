import { Chess, type Color, type Move } from 'chess.js'

export type EngineLevel = 'casual' | 'standard' | 'expert'

export const ENGINE_LEVELS: Array<{ id: EngineLevel; name: string; description: string }> = [
  { id: 'casual', name: 'Casual', description: 'Likes captures, checks, and promotions.' },
  { id: 'standard', name: 'Standard', description: 'Looks one reply ahead.' },
  { id: 'expert', name: 'Expert', description: 'Searches deeper and values position.' },
]

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20_000,
}

const CENTER_SQUARES = new Set(['d4', 'e4', 'd5', 'e5', 'c3', 'd3', 'e3', 'f3', 'c6', 'd6', 'e6', 'f6'])

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function moveTacticalScore(move: Move): number {
  let score = 0
  if (move.captured) score += PIECE_VALUE[move.captured] - PIECE_VALUE[move.piece] * 0.08
  if (move.promotion) score += PIECE_VALUE[move.promotion] - PIECE_VALUE.p
  if (move.san.includes('+')) score += 55
  if (move.san.includes('#')) score += 50_000
  if (CENTER_SQUARES.has(move.to)) score += 14
  return score
}

function evaluate(chess: Chess, engineColor: Color): number {
  if (chess.isCheckmate()) return chess.turn() === engineColor ? -999_999 : 999_999
  if (chess.isDraw()) return 0

  let score = 0
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue
      const sign = piece.color === engineColor ? 1 : -1
      score += sign * PIECE_VALUE[piece.type]
    }
  }

  for (const move of chess.moves({ verbose: true })) {
    const sign = chess.turn() === engineColor ? 1 : -1
    score += sign * (CENTER_SQUARES.has(move.to) ? 2 : 0)
  }

  return score
}

function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  engineColor: Color,
  deadline: number,
): number {
  if (Date.now() > deadline || depth === 0 || chess.isGameOver()) return evaluate(chess, engineColor)

  const maximizingEngine = chess.turn() === engineColor
  const moves = chess
    .moves({ verbose: true })
    .sort((a, b) => moveTacticalScore(b) - moveTacticalScore(a))

  if (maximizingEngine) {
    let best = -Infinity
    for (const move of moves) {
      if (Date.now() > deadline) break
      chess.move(move)
      best = Math.max(best, minimax(chess, depth - 1, alpha, beta, engineColor, deadline))
      chess.undo()
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return best
  }

  let best = Infinity
  for (const move of moves) {
    if (Date.now() > deadline) break
    chess.move(move)
    best = Math.min(best, minimax(chess, depth - 1, alpha, beta, engineColor, deadline))
    chess.undo()
    beta = Math.min(beta, best)
    if (beta <= alpha) break
  }
  return best
}

export function chooseEngineMove(
  position: Chess,
  level: EngineLevel,
  engineColor: Color,
  maxMs = 2500,
): Move | null {
  const chess = new Chess(position.fen())
  const moves = chess
    .moves({ verbose: true })
    .sort((a, b) => moveTacticalScore(b) - moveTacticalScore(a))
  if (moves.length === 0) return null

  if (level === 'casual') {
    const scored = moves
      .map((move) => ({ move, score: moveTacticalScore(move) + Math.random() * 24 }))
      .sort((a, b) => b.score - a.score)
    return Math.random() < 0.72 ? scored[0].move : randomItem(moves)
  }

  const depth = level === 'standard' ? 1 : 2
  const deadline = Date.now() + maxMs
  let bestScore = -Infinity
  let bestMoves: Move[] = [moves[0]]

  for (const move of moves) {
    if (Date.now() > deadline) break
    chess.move(move)
    const noise = level === 'standard' ? Math.random() * 45 : Math.random() * 12
    const score =
      minimax(chess, depth, -Infinity, Infinity, engineColor, deadline) +
      moveTacticalScore(move) * 0.2 +
      noise
    chess.undo()

    if (score > bestScore + 0.001) {
      bestScore = score
      bestMoves = [move]
    } else if (Math.abs(score - bestScore) < 0.001) {
      bestMoves.push(move)
    }
  }

  return randomItem(bestMoves)
}

export function chooseRandomEngineMove(position: Chess): Move | null {
  const moves = position.moves({ verbose: true })
  return moves.length > 0 ? randomItem(moves) : null
}
