import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import './styles.css'

type Phase = 'idle' | 'waiting' | 'ready' | 'tooEarly' | 'result'

const MIN_DELAY_MS = 1500
const MAX_DELAY_MS = 5000
const ROLLING_WINDOW = 5

/**
 * Points scale:
 *   avg ≤ 250 ms  → 10 (max)
 *   each 10 ms above 250 ms  → -1 point
 *   floor              → 5 (reached at avg ≥ 300 ms)
 */
function pointsForAverage(avg: number): number {
  if (avg <= 250) return 10
  const stepsAbove = Math.floor((avg - 250) / 10)
  return Math.max(5, 10 - stepsAbove)
}

export function ReactionGame() {
  const { user } = useAuth()
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>('idle')
  const [time, setTime] = useState(0)
  const [times, setTimes] = useState<number[]>([])

  const startRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const userIdRef = useRef<string | null>(null)
  const bestAvgRef = useRef<number | null>(null)

  // Keep refs in sync each render so the unmount cleanup sees the latest values.
  userIdRef.current = user?.id ?? null

  // Derive the recent-5 list, current rolling avg, and best rolling avg.
  const recent = times.slice(-ROLLING_WINDOW)
  let currentAvg: number | null = null
  let bestAvg: number | null = null
  if (times.length >= ROLLING_WINDOW) {
    for (let i = ROLLING_WINDOW - 1; i < times.length; i++) {
      const slice = times.slice(i - ROLLING_WINDOW + 1, i + 1)
      const avg = slice.reduce((sum, t) => sum + t, 0) / ROLLING_WINDOW
      if (i === times.length - 1) currentAvg = avg
      if (bestAvg === null || avg < bestAvg) bestAvg = avg
    }
  }
  bestAvgRef.current = bestAvg

  // On unmount: clear any pending timer and award points based on the
  // session's lowest rolling-5 average (only if the player completed at
  // least one full window of 5 and is signed in).
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      const best = bestAvgRef.current
      if (best === null || !userIdRef.current || !supabase) return
      const amount = pointsForAverage(best)
      void supabase.rpc('add_points', { amount }).then((res) => {
        if (res.error) {
          toast.show(`Couldn't save points: ${res.error.message}`, { tone: 'error' })
          return
        }
        toast.show(`+${amount} points`, { tone: 'success' })
        window.dispatchEvent(new CustomEvent('points-changed'))
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const beginRound = () => {
    setPhase('waiting')
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)
    timerRef.current = window.setTimeout(() => {
      startRef.current = performance.now()
      setPhase('ready')
    }, delay)
  }

  const handleClick = () => {
    if (phase === 'idle' || phase === 'result' || phase === 'tooEarly') {
      beginRound()
      return
    }
    if (phase === 'waiting') {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setPhase('tooEarly')
      return
    }
    if (phase === 'ready') {
      const elapsed = performance.now() - startRef.current
      setTime(elapsed)
      setTimes((prev) => [...prev, elapsed])
      setPhase('result')
    }
  }

  return (
    <div
      className={`reaction-game is-${phase}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <Link
        to="/"
        className="game-exit"
        onClick={(e) => e.stopPropagation()}
        aria-label="Exit game"
      >
        ← Exit
      </Link>

      {times.length > 0 && (
        <div className="reaction-times-bar" aria-label="Recent times">
          <ol className="reaction-times-list">
            {recent.map((t, i) => {
              const isLatest = i === recent.length - 1
              return (
                <li
                  key={times.length - recent.length + i}
                  className={`reaction-times-item ${isLatest ? 'is-latest' : ''}`}
                >
                  {Math.round(t)}
                </li>
              )
            })}
          </ol>
          {currentAvg !== null && (
            <div className="reaction-times-avg">
              <span className="reaction-times-avg-label">avg</span>
              <span className="reaction-times-avg-value">
                {Math.round(currentAvg)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="reaction-content">
        {phase === 'idle' && (
          <>
            <h1 className="reaction-heading">Reaction Test</h1>
            <p className="reaction-sub">
              When the screen changes color, click as fast as you can.
            </p>
            <p className="reaction-cta">Click anywhere to start</p>
          </>
        )}

        {phase === 'waiting' && (
          <>
            <h1 className="reaction-heading">Wait for it…</h1>
            <p className="reaction-sub">Click the moment the color changes.</p>
          </>
        )}

        {phase === 'ready' && <h1 className="reaction-heading">CLICK!</h1>}

        {phase === 'tooEarly' && (
          <>
            <h1 className="reaction-heading">Too soon</h1>
            <p className="reaction-sub">Wait for the color change next time.</p>
            <p className="reaction-cta">Click to try again</p>
          </>
        )}

        {phase === 'result' && (
          <>
            <div className="reaction-time">
              {Math.round(time)}
              <span className="reaction-unit"> ms</span>
            </div>
            <p className="reaction-cta">Click to try again</p>
          </>
        )}
      </div>
    </div>
  )
}
