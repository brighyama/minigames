import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import { BackButton } from '../../components/BackButton'
import {
  chooseEngineMove,
  chooseRandomEngineMove,
  ENGINE_LEVELS,
  type EngineLevel,
} from './lib'
import './styles.css'

type Piece = {
  color: Color
  type: PieceSymbol
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

type TimeControlId = 'none' | '1+1' | '3+2' | '5'
type PieceThemeId = 'classic' | 'walnut' | 'frost' | 'neon'

const TIME_CONTROLS: Array<{
  id: TimeControlId
  name: string
  initialMs: number | null
  incrementMs: number
}> = [
  { id: 'none', name: 'No time', initialMs: null, incrementMs: 0 },
  { id: '1+1', name: '1+1', initialMs: 60_000, incrementMs: 1_000 },
  { id: '3+2', name: '3+2', initialMs: 180_000, incrementMs: 2_000 },
  { id: '5', name: '5', initialMs: 300_000, incrementMs: 0 },
]

const PIECE_THEMES: Array<{ id: PieceThemeId; name: string }> = [
  { id: 'classic', name: 'Classic' },
  { id: 'walnut', name: 'Walnut' },
  { id: 'frost', name: 'Frost' },
  { id: 'neon', name: 'Neon' },
]

const PIECE_LABEL: Record<PieceSymbol, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
}

function cloneGame(source: Chess) {
  const next = new Chess()
  const pgn = source.pgn()
  if (pgn) next.loadPgn(pgn)
  return next
}

function otherColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

function initialClocks(timeControlId: TimeControlId) {
  const timeControl = TIME_CONTROLS.find((item) => item.id === timeControlId) ?? TIME_CONTROLS[0]
  const initial = timeControl.initialMs ?? 0
  return { w: initial, b: initial }
}

function squareAt(row: number, col: number, orientation: Color): Square {
  if (orientation === 'b') {
    return `${FILES[7 - col]}${row + 1}` as Square
  }
  return `${FILES[col]}${8 - row}` as Square
}

function isLightSquare(square: Square) {
  const fileIndex = FILES.indexOf(square[0] as (typeof FILES)[number])
  const rankIndex = Number(square[1]) - 1
  return (fileIndex + rankIndex) % 2 === 1
}

function formatClock(ms: number) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function PieceIcon({ piece }: { piece: Piece }) {
  const title = `${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_LABEL[piece.type]}`
  return (
    <svg className="chess-piece-icon" viewBox="0 0 64 64" role="img" aria-label={title}>
      <title>{title}</title>
      {piece.type === 'p' && (
        <>
          <circle cx="32" cy="17" r="9" />
          <path d="M23 28h18l4 19H19z" />
          <path d="M16 49h32v8H16z" />
        </>
      )}
      {piece.type === 'r' && (
        <>
          <path d="M18 10h8v7h5v-7h8v7h7v12H18z" />
          <path d="M23 29h18l3 20H20z" />
          <path d="M16 50h32v8H16z" />
        </>
      )}
      {piece.type === 'n' && (
        <>
          <path d="M20 50h28v8H16z" />
          <path d="M22 49c2-14 4-25 16-38l12 7-4 7 5 8-8 5-7-5-5 16z" />
          <circle cx="39" cy="22" r="2.2" className="chess-piece-cut" />
        </>
      )}
      {piece.type === 'b' && (
        <>
          <path d="M32 7l11 14-6 23H27l-6-23z" />
          <path d="M22 45h20l4 5H18z" />
          <path d="M16 52h32v6H16z" />
          <path d="M30 18l7 7" className="chess-piece-line" />
        </>
      )}
      {piece.type === 'q' && (
        <>
          <path d="M14 18l9 25h18l9-25-10 10-8-16-8 16z" />
          <circle cx="14" cy="17" r="4" />
          <circle cx="32" cy="10" r="4" />
          <circle cx="50" cy="17" r="4" />
          <path d="M20 45h24l4 6H16z" />
          <path d="M16 53h32v5H16z" />
        </>
      )}
      {piece.type === 'k' && (
        <>
          <path d="M29 7h6v10h9v6h-9v9h-6v-9h-9v-6h9z" />
          <path d="M22 34h20l4 16H18z" />
          <path d="M16 52h32v6H16z" />
        </>
      )}
    </svg>
  )
}

function statusText(
  chess: Chess,
  engineThinking: boolean,
  userColor: Color,
  timedOut: Color | null,
  started: boolean,
) {
  if (!started) return 'Click the board to start.'
  if (timedOut) return timedOut === userColor ? 'Time. Engine wins.' : 'Time. You win!'
  if (chess.isCheckmate()) {
    return chess.turn() === userColor ? 'Checkmate. Engine wins.' : 'Checkmate. You win!'
  }
  if (chess.isDraw()) return 'Draw.'
  if (engineThinking) return 'Engine is thinking...'
  if (chess.turn() !== userColor) return 'Engine to move.'
  return chess.isCheck() ? 'Your move. You are in check.' : 'Your move.'
}

export function ChessGame() {
  const [game, setGame] = useState(() => new Chess())
  const [selected, setSelected] = useState<Square | null>(null)
  const [level, setLevel] = useState<EngineLevel>('casual')
  const [timeControlId, setTimeControlId] = useState<TimeControlId>('none')
  const [pieceThemeId, setPieceThemeId] = useState<PieceThemeId>('classic')
  const [clocks, setClocks] = useState(() => initialClocks('none'))
  const [timedOut, setTimedOut] = useState<Color | null>(null)
  const [userColor, setUserColor] = useState<Color>('w')
  const [started, setStarted] = useState(false)
  const engineTimer = useRef<number | null>(null)
  const clockTickRef = useRef(0)
  const clocksRef = useRef(clocks)

  const engineColor = otherColor(userColor)
  const timeControl = TIME_CONTROLS.find((item) => item.id === timeControlId) ?? TIME_CONTROLS[0]
  const engineThinking = started && game.turn() === engineColor && !game.isGameOver() && !timedOut
  const legalMoves = useMemo(() => {
    if (!started || !selected || game.turn() !== userColor || game.isGameOver() || timedOut) return []
    return game.moves({ square: selected, verbose: true })
  }, [game, selected, started, timedOut, userColor])
  const legalTargets = useMemo(() => new Set(legalMoves.map((move) => move.to)), [legalMoves])
  const lastMove = game.history({ verbose: true }).at(-1)

  const setClockState = useCallback((next: { w: number; b: number }) => {
    clocksRef.current = next
    setClocks(next)
  }, [])

  const addIncrement = useCallback((mover: Color) => {
    if (timeControl.incrementMs <= 0) return
    const current = clocksRef.current
    setClockState({
      ...current,
      [mover]: current[mover] + timeControl.incrementMs,
    })
  }, [setClockState, timeControl.incrementMs])

  useEffect(() => {
    if (!started || game.turn() !== engineColor || game.isGameOver() || timedOut) return
    engineTimer.current = window.setTimeout(() => {
      if (game.turn() !== engineColor || game.isGameOver() || timedOut) return
      const firstWhiteMove = engineColor === 'w' && game.history().length === 0
      const move = firstWhiteMove
        ? chooseRandomEngineMove(game)
        : chooseEngineMove(game, level, engineColor, level === 'expert' ? 2200 : 900)
      if (!move) return
      const next = cloneGame(game)
      const mover = game.turn()
      next.move(move)
      setGame(next)
      addIncrement(mover)
      setSelected(null)
    }, engineColor === 'w' && game.history().length === 0 ? 320 : level === 'expert' ? 140 : 360)

    return () => {
      if (engineTimer.current) window.clearTimeout(engineTimer.current)
    }
  }, [addIncrement, engineColor, game, level, started, timedOut])

  useEffect(() => {
    if (!started || !timeControl.initialMs || game.isGameOver() || timedOut) return

    clockTickRef.current = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      const elapsed = now - clockTickRef.current
      clockTickRef.current = now
      const activeColor = game.turn()
      const current = clocksRef.current
      const nextMs = Math.max(0, current[activeColor] - elapsed)
      setClockState({ ...current, [activeColor]: nextMs })
      if (nextMs === 0) setTimedOut(activeColor)
    }, 250)

    return () => window.clearInterval(id)
  }, [game, setClockState, started, timeControl.initialMs, timedOut])

  const reset = () => {
    setUserColor((current) => otherColor(current))
    setGame(new Chess())
    setSelected(null)
    setTimedOut(null)
    setStarted(false)
    setClockState(initialClocks(timeControlId))
  }

  const changeTimeControl = (next: TimeControlId) => {
    setTimeControlId(next)
    setTimedOut(null)
    setClockState(initialClocks(next))
  }

  const startGame = () => {
    setStarted(true)
  }

  const selectOrMove = (square: Square, piece: Piece | null) => {
    if (game.isGameOver() || timedOut) return

    if (!started) {
      startGame()
      if (userColor !== game.turn()) return
    }

    if (engineThinking || game.turn() !== userColor) return

    if (selected && legalTargets.has(square)) {
      const next = cloneGame(game)
      const mover = game.turn()
      next.move({ from: selected, to: square, promotion: 'q' })
      setGame(next)
      setSelected(null)
      addIncrement(mover)
      return
    }

    if (piece?.color === userColor) {
      const moves = game.moves({ square, verbose: true })
      setSelected(moves.length > 0 ? square : null)
      return
    }

    setSelected(null)
  }

  return (
    <main className="chess-container">
      <BackButton label="Exit" />

      <section className="chess-shell" aria-label="Chess game">
        <div className="chess-topbar">
          <div>
            <h1 className="chess-title">Chess</h1>
            <p className="chess-status">
              {statusText(game, engineThinking, userColor, timedOut, started)}
            </p>
          </div>

          <div className="chess-controls" aria-label="Chess controls">
            <label className="chess-select-label">
              Level
              <select
                className="chess-select"
                value={level}
                onChange={(event) => setLevel(event.target.value as EngineLevel)}
                disabled={started}
              >
                {ENGINE_LEVELS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="chess-select-label">
              Time
              <select
                className="chess-select chess-time-select"
                value={timeControlId}
                onChange={(event) => changeTimeControl(event.target.value as TimeControlId)}
                disabled={started}
              >
                {TIME_CONTROLS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="chess-select-label">
              Pieces
              <select
                className="chess-select chess-piece-select"
                value={pieceThemeId}
                onChange={(event) => setPieceThemeId(event.target.value as PieceThemeId)}
              >
                {PIECE_THEMES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="chess-button" onClick={reset}>
              New game
            </button>
          </div>
        </div>

        <div className="chess-layout">
          <div className={`chess-board pieces-${pieceThemeId}`} aria-label="Chess board">
            {Array.from({ length: 8 }, (_, rowIndex) =>
              Array.from({ length: 8 }, (_, colIndex) => {
                const square = squareAt(rowIndex, colIndex, userColor)
                const piece = game.get(square) ?? null
                const isLight = isLightSquare(square)
                const isSelected = selected === square
                const isLegal = legalTargets.has(square)
                const isLastMove = lastMove?.from === square || lastMove?.to === square
                const canPick =
                  piece?.color === userColor &&
                  game.turn() === userColor &&
                  started &&
                  !engineThinking &&
                  !timedOut

                return (
                  <button
                    key={square}
                    type="button"
                    className={[
                      'chess-square',
                      isLight ? 'is-light' : 'is-dark',
                      isSelected ? 'is-selected' : '',
                      isLegal ? 'is-legal' : '',
                      piece && isLegal ? 'is-capture-target' : '',
                      isLastMove ? 'is-last-move' : '',
                      canPick ? 'can-pick' : '',
                    ].join(' ')}
                    onClick={() => selectOrMove(square, piece)}
                    aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_LABEL[piece.type]}` : ''}`}
                  >
                    <span className="chess-square-coord file">{rowIndex === 7 ? square[0] : ''}</span>
                    <span className="chess-square-coord rank">{colIndex === 0 ? square[1] : ''}</span>
                    {piece && <PieceIcon piece={piece} />}
                  </button>
                )
              }),
            )}
            {!started && (
              <div className="chess-start-overlay" aria-hidden="true">
                Click the board to start
              </div>
            )}
          </div>

          <aside className="chess-side">
            <div className="chess-panel chess-clock-panel">
              <span className="chess-panel-label">Clock</span>
              <div className="chess-clock-row">
                <span>White</span>
                <strong className={started && game.turn() === 'w' && !game.isGameOver() && !timedOut ? 'is-active' : ''}>
                  {timeControl.initialMs ? formatClock(clocks.w) : 'No time'}
                </strong>
              </div>
              <div className="chess-clock-row">
                <span>Black</span>
                <strong className={started && game.turn() === 'b' && !game.isGameOver() && !timedOut ? 'is-active' : ''}>
                  {timeControl.initialMs ? formatClock(clocks.b) : 'No time'}
                </strong>
              </div>
              <p className="chess-side-note">
                You are playing {userColor === 'w' ? 'White' : 'Black'}{started ? '.' : ' after start.'}
              </p>
            </div>

            <div className="chess-panel">
              <span className="chess-panel-label">Engine</span>
              <strong>{ENGINE_LEVELS.find((item) => item.id === level)?.name}</strong>
              <p>{ENGINE_LEVELS.find((item) => item.id === level)?.description}</p>
            </div>

            <div className="chess-panel chess-moves">
              <span className="chess-panel-label">Moves</span>
              <ol>
                {game.history().length === 0 ? (
                  <li className="chess-empty-move">No moves yet</li>
                ) : (
                  game.history().map((move, index) => (
                    <li key={`${move}-${index}`}>{move}</li>
                  ))
                )}
              </ol>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
