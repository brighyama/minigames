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
type PieceStyleId = 'classic' | 'geometric' | 'glyph'

const TIME_CONTROLS: Array<{
  id: TimeControlId
  name: string
  initialMs: number | null
  incrementMs: number
}> = [
  { id: 'none', name: 'no time', initialMs: null, incrementMs: 0 },
  { id: '1+1', name: '1+1', initialMs: 60_000, incrementMs: 1_000 },
  { id: '3+2', name: '3+2', initialMs: 180_000, incrementMs: 2_000 },
  { id: '5', name: '5', initialMs: 300_000, incrementMs: 0 },
]

const PIECE_THEMES: Array<{ id: PieceThemeId; name: string }> = [
  { id: 'classic', name: 'classic' },
  { id: 'walnut', name: 'walnut' },
  { id: 'frost', name: 'frost' },
  { id: 'neon', name: 'neon' },
]

const PIECE_STYLES: Array<{ id: PieceStyleId; name: string }> = [
  { id: 'classic', name: 'classic' },
  { id: 'geometric', name: 'geometric' },
  { id: 'glyph', name: 'glyph' },
]

// Filled Staunton-style silhouettes (viewBox 0 0 512 512). Single path each, so
// they fill with currentColor and respect the piece-color theming like the rest.
// Source: skoll / game-icons.net (CC BY 3.0).
const CLASSIC_PATHS: Record<PieceSymbol, string> = {
  k: 'M405.995 477.15h-300v-60h300v60zm-10.3-107.13h-279.4a96.88 96.88 0 0 1 6.65 31.12h266.1a96.88 96.88 0 0 1 6.65-31.12zm-139.7-241.06a35.76 35.76 0 0 0-35.76 35.76c0 50.16 35.76 99.34 35.76 99.34s35.76-49.18 35.76-99.34a35.76 35.76 0 0 0-35.76-35.76zm8-15.38V94.24h18.36v-16h-18.36V54.85h-16v23.39h-18.36v16h18.36v19.38a51.9 51.9 0 0 1 16-.04zm81.64 51.36a98.74 98.74 0 0 0-38.13 7.61c-3.23 51.75-37.07 98.85-38.58 100.93l-4.93 6.76V354h140c16.57-26.15 40.78-42.41 40.78-90a99.13 99.13 0 0 0-99.14-99.07zm-141.16 7.61a99.16 99.16 0 0 0-137.25 91.51c0 47.55 24.21 63.82 40.78 90h139.99v-73.82l-4.94-6.79c-1.51-2.05-35.34-49.15-38.58-100.9z',
  q: 'M477.518 181.966a25 25 0 0 1-34.91 23l-62.29 150.26h-248.92l-62.24-150.19a25 25 0 1 1 9.73-7.29l87 71.2 20.92-126.4a25 25 0 1 1 14.7-1.85l54.31 117 54.42-117.3a25 25 0 1 1 14.58 2.08l20.93 126.42 87.26-71.3a25 25 0 1 1 44.51-15.63zm-71.66 241.25h-300v60h300v-60zm-27.75-52h-244.22v36h244.22v-36z',
  r: 'M406 484.7H106v-60h300v60zm-56.67-330.83h-50.05V91.3h-82.39v62.57h-54.22V91.3h-54.23v113.67h295.12V91.3h-54.23v62.57zm23.35 67.23H139.32v187.6h233.36V221.1z',
  b: 'M406.02 476.915h-300v-60h300v60zm-83.46-181H189.48v17.65h133.08v-17.65zm11.78-77.69a200 200 0 0 1-9.39 61.69H187.09a200 200 0 0 1-9.39-61.69c0-59.09 23.82-109 56.41-124.67a33.34 33.34 0 1 1 43.82 0c32.59 15.71 56.41 65.58 56.41 124.67zm-51.07-48.91h-19.25v-23.92h-16v23.92h-19.26v16h19.26v51.54h16v-51.54h19.25v-16zm38.15 180.69v-20.44h-130.8v20.44H93.29v.11l49.46 49.46h82.08l31.15-36 31.15 36h82.44l48.87-48.87.27-.69h-97.29z',
  n: 'M60.81 476.91h300v-60h-300v60zm233.79-347.3l13.94 7.39c31.88-43.62 61.34-31.85 61.34-31.85l-21.62 53 35.64 19 2.87 33 64.42 108.75-43.55 29.37s-26.82-36.39-39.65-43.66c-10.66-6-41.22-10.25-56.17-12l-67.54-76.91-12 10.56 37.15 42.31c-.13.18-.25.37-.38.57-35.78 58.17 23 105.69 68.49 131.78H84.14C93 85 294.6 129.61 294.6 129.61z',
  p: 'M312.07 194.46A56.07 56.07 0 1 1 256 138.39a56.07 56.07 0 0 1 56.07 56.07zM406 418.01H106v60h300v-60zM282.33 261.52a71.81 71.81 0 0 1-52.15.2c-.73 58.91-62.35 114.06-96.75 140.28H378.9c-34.09-26.33-95.44-81.78-96.57-140.48z',
}

// Solid Unicode chess glyphs (currentColor fills them, FE0E forces text glyphs).
const PIECE_GLYPH: Record<PieceSymbol, string> = {
  k: '♚︎',
  q: '♛︎',
  r: '♜︎',
  b: '♝︎',
  n: '♞︎',
  p: '♟︎',
}

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

function PieceIcon({ piece, styleId }: { piece: Piece; styleId: PieceStyleId }) {
  const title = `${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_LABEL[piece.type]}`

  if (styleId === 'classic') {
    return (
      <svg className="chess-piece-icon" viewBox="0 0 512 512" role="img" aria-label={title}>
        <title>{title}</title>
        <path d={CLASSIC_PATHS[piece.type]} />
      </svg>
    )
  }

  if (styleId === 'glyph') {
    return (
      <svg
        className="chess-piece-icon chess-piece-glyph"
        viewBox="0 0 64 64"
        role="img"
        aria-label={title}
      >
        <title>{title}</title>
        <text x="32" y="34" textAnchor="middle" dominantBaseline="central">
          {PIECE_GLYPH[piece.type]}
        </text>
      </svg>
    )
  }

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
  if (!started) return 'click the board to start'
  if (timedOut) return timedOut === userColor ? 'time. engine wins.' : 'time. you win!'
  if (chess.isCheckmate()) {
    return chess.turn() === userColor ? 'checkmate. engine wins.' : 'checkmate. you win!'
  }
  if (chess.isDraw()) return 'draw.'
  if (engineThinking) return 'engine is thinking...'
  if (chess.turn() !== userColor) return 'engine to move.'
  return chess.isCheck() ? 'your move. you are in check.' : 'your move.'
}

export function ChessGame() {
  const [game, setGame] = useState(() => new Chess())
  const [selected, setSelected] = useState<Square | null>(null)
  const [level, setLevel] = useState<EngineLevel>('casual')
  const [timeControlId, setTimeControlId] = useState<TimeControlId>('none')
  const [pieceThemeId, setPieceThemeId] = useState<PieceThemeId>('classic')
  const [pieceStyleId, setPieceStyleId] = useState<PieceStyleId>('classic')
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
            <h1 className="chess-title">chess</h1>
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
              Style
              <select
                className="chess-select chess-piece-select"
                value={pieceStyleId}
                onChange={(event) => setPieceStyleId(event.target.value as PieceStyleId)}
              >
                {PIECE_STYLES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="chess-select-label">
              Color
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
              new game
            </button>
          </div>
        </div>

        <div className="chess-layout">
          <div
            className={`chess-board pieces-${pieceThemeId} style-${pieceStyleId}`}
            aria-label="Chess board"
          >
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
                    {piece && <PieceIcon piece={piece} styleId={pieceStyleId} />}
                  </button>
                )
              }),
            )}
            {!started && (
              <div className="chess-start-overlay" aria-hidden="true">
                click the board to start
              </div>
            )}
          </div>

          <aside className="chess-side">
            <div className="chess-panel chess-clock-panel">
              <span className="chess-panel-label">Clock</span>
              <div className="chess-clock-row">
                <span>white</span>
                <strong className={started && game.turn() === 'w' && !game.isGameOver() && !timedOut ? 'is-active' : ''}>
                  {timeControl.initialMs ? formatClock(clocks.w) : 'No time'}
                </strong>
              </div>
              <div className="chess-clock-row">
                <span>black</span>
                <strong className={started && game.turn() === 'b' && !game.isGameOver() && !timedOut ? 'is-active' : ''}>
                  {timeControl.initialMs ? formatClock(clocks.b) : 'No time'}
                </strong>
              </div>
              <p className="chess-side-note">
                you are playing {userColor === 'w' ? 'white' : 'black'}
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
                  <li className="chess-empty-move">no moves yet</li>
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
