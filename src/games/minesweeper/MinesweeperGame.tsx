import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { BackButton } from '../../components/BackButton'
import {
  chord,
  createBoard,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  flagCount,
  formatTime,
  hasWon,
  reveal,
  revealAllMines,
  toggleFlag,
  type Board,
  type Difficulty,
} from './lib'
import './styles.css'

type Status = 'ready' | 'playing' | 'won' | 'lost'

const DIFF_KEY = 'minigames:minesweeper:difficulty'

// Classic constant number colors (kept constant across themes for readability,
// same rationale as Tetris piece colors).
const NUMBER_COLORS = [
  '', // 0 — unused (blanks render empty)
  '#4aa3ff', // 1
  '#3fb950', // 2
  '#ff6b6b', // 3
  '#bc8cff', // 4
  '#ff9f43', // 5
  '#2bd4c4', // 6
  '#e6e6e6', // 7
  '#9aa0a6', // 8
]

function loadDifficulty(): Difficulty {
  const saved = localStorage.getItem(DIFF_KEY)
  if (saved === 'easy' || saved === 'medium' || saved === 'hard') return saved
  return 'easy'
}

export function MinesweeperGame() {
  const { user } = useAuth()
  const toast = useToast()

  const [difficulty, setDifficulty] = useState<Difficulty>(() => loadDifficulty())
  const def = DIFFICULTIES[difficulty]

  const [board, setBoard] = useState<Board>(() => createBoard(def))
  const [status, setStatus] = useState<Status>('ready')
  const [elapsed, setElapsed] = useState(0)
  const [flagMode, setFlagMode] = useState(false)

  const startRef = useRef(0)
  const submittedRef = useRef(false)

  const minesLeft = def.mines - flagCount(board)
  const done = status === 'won' || status === 'lost'

  // Begin a fresh puzzle for the given difficulty (defaults to current one).
  const newGame = useCallback(
    (next: Difficulty = difficulty) => {
      setBoard(createBoard(DIFFICULTIES[next]))
      setStatus('ready')
      setElapsed(0)
      startRef.current = 0
      submittedRef.current = false
    },
    [difficulty],
  )

  const pickDifficulty = (d: Difficulty) => {
    if (d === difficulty) return
    setDifficulty(d)
    localStorage.setItem(DIFF_KEY, d)
    newGame(d)
  }

  // Timer ticks only while a game is actively in progress.
  useEffect(() => {
    if (status !== 'playing') return
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 100)
    return () => clearInterval(id)
  }, [status])

  // Settle a win once: record locally-displayed time and submit to the server.
  const settleWin = useCallback(
    (timeMs: number) => {
      if (submittedRef.current) return
      submittedRef.current = true
      if (!user || !supabase) return
      void supabase
        .rpc('submit_minesweeper_result', { difficulty, time_ms: timeMs })
        .then((res) => {
          if (res.error) {
            console.error('[minesweeper] submit failed:', res.error)
            return
          }
          const row = Array.isArray(res.data) ? res.data[0] : res.data
          if (row?.reward) {
            toast.show(`+${row.reward} points`, { tone: 'success' })
            window.dispatchEvent(new CustomEvent('points-changed'))
          }
        })
    },
    [difficulty, user, toast],
  )

  const handleReveal = (index: number) => {
    if (done) return
    if (board.cells[index].state === 'flagged') return

    // Start the clock on the first reveal.
    let firstMove = false
    if (status === 'ready') {
      firstMove = true
      startRef.current = Date.now()
    }

    const cell = board.cells[index]
    const res =
      cell.state === 'revealed'
        ? chord(board, index)
        : reveal(board, index)

    if (firstMove) setStatus('playing')

    if (res.hitMine) {
      setBoard(revealAllMines(res.board))
      setStatus('lost')
      return
    }
    if (hasWon(res.board)) {
      const timeMs = Date.now() - startRef.current
      setBoard(res.board)
      setElapsed(timeMs)
      setStatus('won')
      settleWin(timeMs)
      return
    }
    setBoard(res.board)
  }

  // Left click: reveal (or flag, when flag-mode is on). Chording happens when
  // the target is an already-revealed number.
  const onCellClick = (index: number) => {
    if (done) return
    if (flagMode && board.cells[index].state !== 'revealed') {
      setBoard(toggleFlag(board, index))
      return
    }
    handleReveal(index)
  }

  // Right click always flags (desktop affordance). Allowed before/during a
  // game; ignored once it's over.
  const onCellContextMenu = (e: MouseEvent, index: number) => {
    e.preventDefault()
    if (done) return
    setBoard(toggleFlag(board, index))
  }

  const faceText = status === 'won' ? '★' : status === 'lost' ? '✕' : '●'

  const cells = useMemo(() => board.cells, [board])

  return (
    <main className="mines-container">
      <BackButton label="Exit" />

      <div className="mines-header">
        <h1 className="mines-title">minesweeper</h1>
        <div className="mines-diffs" role="tablist" aria-label="Difficulty">
          {DIFFICULTY_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === difficulty}
              className={`mines-diff${d === difficulty ? ' is-active' : ''}`}
              onClick={() => pickDifficulty(d)}
            >
              {DIFFICULTIES[d].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mines-hud">
        <div className="mines-readout" aria-label="Mines remaining">
          <span className="mines-readout-icon" aria-hidden="true">⚑</span>
          <span className="mines-readout-value">{String(minesLeft).padStart(3, '0')}</span>
        </div>

        <button
          type="button"
          className={`mines-face status-${status}`}
          onClick={() => newGame()}
          aria-label="New game"
          title="New game"
        >
          {faceText}
        </button>

        <div className="mines-readout" aria-label="Time">
          <span className="mines-readout-icon" aria-hidden="true">◷</span>
          <span className="mines-readout-value">{formatTime(elapsed)}</span>
        </div>
      </div>

      <div className="mines-board-wrap">
        <div
          className={`mines-board status-${status}`}
          style={{ ['--cols' as string]: def.cols, ['--rows' as string]: def.rows }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {cells.map((cell, i) => {
            const classes = ['mines-cell']
            if (cell.state === 'revealed') {
              classes.push('is-revealed')
              if (cell.mine) classes.push('is-mine')
            } else if (cell.state === 'flagged') {
              classes.push('is-flagged')
            }
            const showNumber =
              cell.state === 'revealed' && !cell.mine && cell.adjacent > 0
            return (
              <button
                key={i}
                type="button"
                className={classes.join(' ')}
                onClick={() => onCellClick(i)}
                onContextMenu={(e) => onCellContextMenu(e, i)}
                disabled={done && cell.state !== 'revealed' && !cell.mine}
                style={
                  showNumber
                    ? { color: NUMBER_COLORS[cell.adjacent] }
                    : undefined
                }
                aria-label={
                  cell.state === 'flagged'
                    ? 'flagged cell'
                    : cell.state === 'revealed'
                      ? cell.mine
                        ? 'mine'
                        : `${cell.adjacent} adjacent mines`
                      : 'hidden cell'
                }
              >
                {cell.state === 'flagged' && '⚑'}
                {cell.state === 'revealed' && cell.mine && '✶'}
                {showNumber && cell.adjacent}
              </button>
            )
          })}

          {done && (
            <div className="mines-overlay">
              <div className="mines-result">
                <div className="mines-result-title">
                  {status === 'won' ? 'cleared!' : 'boom'}
                </div>
                <div className="mines-result-time">
                  {status === 'won'
                    ? `${DIFFICULTIES[difficulty].label} · ${formatTime(elapsed)}`
                    : 'you hit a mine'}
                </div>
                <button
                  type="button"
                  className="mines-btn mines-btn-primary"
                  onClick={() => newGame()}
                >
                  new game
                </button>
                {status === 'won' && !user && (
                  <div className="mines-note">sign in to save your time to the leaderboard</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mines-footer">
        <button
          type="button"
          className={`mines-flagtoggle${flagMode ? ' is-active' : ''}`}
          onClick={() => setFlagMode((v) => !v)}
          aria-pressed={flagMode}
        >
          <span aria-hidden="true">⚑</span> flag mode
        </button>
        <span className="mines-hint">
          tap to dig · right-click or flag-mode to mark · click a number to chord
        </span>
      </div>
    </main>
  )
}
