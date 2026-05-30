import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fetchProfile } from '../../lib/profile'
import { useToast } from '../../lib/toast'
import { BackButton } from '../../components/BackButton'
import {
  canMove,
  hasWon,
  highestTile,
  move,
  newGame,
  spawn,
  type Board,
  type Dir,
} from './lib'
import { createSolver } from './solver'
import './styles.css'

/** Delay between auto-solver moves, so the run is watchable. */
const AI_MOVE_DELAY_MS = 140

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
}

export function Game2048() {
  const { user } = useAuth()
  const toast = useToast()

  const [board, setBoard] = useState<Board>(() => newGame())
  // `best` = the account's highest tile ever reached (loaded from the profile).
  const [best, setBest] = useState<number | null>(null)
  const [over, setOver] = useState(false)
  const [won, setWon] = useState(false)
  const [keepGoing, setKeepGoing] = useState(false)
  const [autoSolve, setAutoSolve] = useState(false)

  // The current game's highest tile drives the "Score" box and what we submit.
  const currentTile = highestTile(board)

  const submittedRef = useRef(false)
  // The solver instance + a flag marking whether the AI touched this game.
  // AI-assisted games are never submitted to the leaderboard or rewarded.
  const solverRef = useRef(createSolver())
  const aiUsedRef = useRef(false)
  const userIdRef = useRef<string | undefined>(user?.id)
  // Mirror the latest board so the unmount/over submit can read the top tile.
  const boardRef = useRef(board)
  useEffect(() => {
    userIdRef.current = user?.id
  }, [user])
  useEffect(() => {
    boardRef.current = board
  }, [board])

  // Load the player's stored best (highest tile ever) to display.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchProfile(user.id).then((p) => {
      if (!cancelled && p) setBest(p.g2048_high_score ?? 0)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  /**
   * Submit a run once, recording the top tile reached. The server updates the
   * account's best tile (the leaderboard) and derives the points reward from
   * the tile. AI-assisted games are never submitted.
   */
  const submitTopTile = useCallback(
    (topTile: number) => {
      if (submittedRef.current) return
      submittedRef.current = true
      // Don't rank or reward AI-assisted runs — keeps the leaderboard honest.
      if (aiUsedRef.current) return
      if (topTile <= 0 || !userIdRef.current || !supabase) return
      void supabase
        .rpc('submit_2048_result', { top_tile: topTile })
        .then((res) => {
          if (res.error) {
            console.error('[2048] submit_2048_result failed:', res.error)
            return
          }
          const row = Array.isArray(res.data) ? res.data[0] : res.data
          if (row?.best != null) setBest(row.best)
          if (row?.reward) {
            toast.show(`+${row.reward} points`, { tone: 'success' })
            window.dispatchEvent(new CustomEvent('points-changed'))
          }
        })
    },
    [toast],
  )

  const applyMove = useCallback(
    (dir: Dir) => {
      if (over) return
      setBoard((prev) => {
        const res = move(prev, dir)
        if (!res.moved) return prev
        const next = res.board
        if (!keepGoing && hasWon(next) && !won) setWon(true)
        // Spawn a new tile, then test for game over on the resulting board.
        const withSpawn = spawn(next)
        if (!canMove(withSpawn)) setOver(true)
        return withSpawn
      })
    },
    [over, won, keepGoing],
  )

  // Submit when the game ends. Runs after the board ref is updated (declared
  // above), so it reads the final board's top tile. submittedRef prevents this
  // from racing with the exit/restart submits.
  useEffect(() => {
    if (over) submitTopTile(highestTile(boardRef.current))
  }, [over, submitTopTile])

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIR[e.key]
      if (!dir) return
      e.preventDefault()
      applyMove(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyMove])

  // Auto-solver loop: while enabled, ask the solver for a move on each new
  // board state and play it after a short delay so the run is watchable. The
  // effect re-runs after every board change, scheduling the next move.
  useEffect(() => {
    if (!autoSolve || over) return
    const id = window.setTimeout(() => {
      const dir = solverRef.current.chooseMove(board)
      if (!dir) {
        setAutoSolve(false)
        return
      }
      aiUsedRef.current = true
      applyMove(dir)
    }, AI_MOVE_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [autoSolve, over, board, applyMove])

  // Touch / swipe controls.
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    if (Math.max(absX, absY) < 24) return // ignore taps
    if (absX > absY) applyMove(dx > 0 ? 'right' : 'left')
    else applyMove(dy > 0 ? 'down' : 'up')
    touchRef.current = null
  }

  // Submit as soon as the player leaves the game (for a non-tainted game).
  // Game over also submits (the effect above); submittedRef makes sure whichever
  // happens first wins and we never double-submit. Starting a new game does
  // not submit here — that's handled by restart resetting the guards.
  useEffect(() => {
    return () => submitTopTile(highestTile(boardRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restart = () => {
    // Bank the abandoned run's top tile before resetting (no-op if it was
    // already submitted at game over, or if the AI tainted the game).
    submitTopTile(highestTile(boardRef.current))
    submittedRef.current = false
    aiUsedRef.current = false
    solverRef.current.reset?.()
    setBoard(newGame())
    setOver(false)
    setWon(false)
    setKeepGoing(false)
  }

  const continuePlaying = () => {
    setWon(false)
    setKeepGoing(true)
  }

  return (
    <main className="g2048-container">
      <BackButton label="Exit" />

      <div className="g2048-frame">
        <div className="g2048-header">
          <h1 className="g2048-title">2048</h1>
          <div className="g2048-scores">
            <div className="g2048-score-box">
              <span className="g2048-score-label">Score</span>
              <span className="g2048-score-value">{currentTile.toLocaleString()}</span>
            </div>
            <div className="g2048-score-box">
              <span className="g2048-score-label">Best</span>
              <span className="g2048-score-value">
                {best != null ? Math.max(best, currentTile).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        </div>

        <p className="g2048-hint">
          Use arrow keys or WASD — or swipe — to merge tiles. Reach 2048!
        </p>

        <div
          className="g2048-board"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {board.map((v, i) => (
            <div
              key={i}
              className={`g2048-tile ${v ? `tile-${v <= 2048 ? v : 'super'}` : 'tile-empty'}`}
            >
              {v !== 0 && <span>{v}</span>}
            </div>
          ))}

          {(over || won) && (
            <div className="g2048-overlay">
              <div className="g2048-overlay-text">
                {won ? 'You made 2048!' : 'Game over'}
              </div>
              <div className="g2048-overlay-score">
                Top tile {currentTile.toLocaleString()}
              </div>
              <div className="g2048-overlay-actions">
                {won && (
                  <button className="g2048-btn" onClick={continuePlaying}>
                    Keep going
                  </button>
                )}
                <button className="g2048-btn g2048-btn-primary" onClick={restart}>
                  New game
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="g2048-controls">
          <button
            type="button"
            className={`g2048-btn g2048-ai ${autoSolve ? 'is-active' : ''}`}
            onClick={() =>
              setAutoSolve((v) => {
                // The instant the AI is engaged, this game is no longer
                // eligible for points or the leaderboard.
                if (!v) aiUsedRef.current = true
                return !v
              })
            }
            aria-pressed={autoSolve}
          >
            {autoSolve ? '■ Stop AI' : '▶ Watch AI'}
          </button>
          <button className="g2048-btn g2048-btn-primary" onClick={restart}>
            New game
          </button>
        </div>
      </div>

      <div className="g2048-note">
        {autoSolve ? (
          <>Solver: {solverRef.current.name} — AI-assisted games aren't ranked.</>
        ) : !user ? (
          <>Sign in to save your high score to the leaderboard.</>
        ) : (
          <>Tip: try “Watch AI” to see the {solverRef.current.name} solver play.</>
        )}
      </div>
    </main>
  )
}
