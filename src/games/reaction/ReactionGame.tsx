import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { fetchProfile } from '../../lib/profile'
import { BackButton } from '../../components/BackButton'
import './styles.css'

type Phase = 'idle' | 'waiting' | 'ready' | 'tooEarly' | 'result'

const MIN_DELAY_MS = 1500
const MAX_DELAY_MS = 5000
const ROLLING_WINDOW = 5

/**
 * Points scale:
 *   avg ≤ 250 ms      → 10 (max)
 *   each 10 ms above  → -1 point
 *   floor              → 5 (reached at avg ≥ 300 ms)
 */
export function ReactionGame() {
  const { user } = useAuth()
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>('idle')
  const [time, setTime] = useState(0)
  const [times, setTimes] = useState<number[]>([])
  /** All-time best avg in ms (lower is better). Null = no record yet. */
  const [highScore, setHighScore] = useState<number | null>(null)

  const startRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const userIdRef = useRef<string | null>(null)
  const bestAvgRef = useRef<number | null>(null)

  userIdRef.current = user?.id ?? null

  // Pull existing best from the server so the player sees a target.
  useEffect(() => {
    if (!user) {
      setHighScore(null)
      return
    }
    let cancelled = false
    fetchProfile(user.id).then((profile) => {
      if (cancelled || !profile) return
      setHighScore(profile.best_reaction_avg)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // Derive recent-5 list, current rolling avg, and best rolling avg this session.
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

  // Live-update the displayed high score if the player beats it mid-session,
  // and persist the new best immediately so the save doesn't depend on the
  // unmount timing window.
  useEffect(() => {
    if (bestAvg === null) return
    const rounded = Math.round(bestAvg)
    setHighScore((prev) => {
      if (prev !== null && rounded >= prev) return prev
      if (userIdRef.current && supabase) {
        void supabase
          .rpc('update_reaction_best', { avg_ms: rounded })
          .then((res) => {
            if (res.error) {
              console.error('[reaction] update_reaction_best failed:', res.error)
              toast.show(`couldn't save best avg: ${res.error.message}`, {
                tone: 'error',
              })
            }
          })
      }
      return rounded
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestAvg])

  // On unmount: clear timer and award points based on the session's best avg.
  // The high score itself is persisted as soon as a new best appears (above)
  // so this cleanup only needs to handle the points award.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      const best = bestAvgRef.current
      if (best === null || !userIdRef.current || !supabase) return
      // The server derives the (bounded) reward from the reported avg.
      void supabase.rpc('award_reaction', { best_avg_ms: Math.round(best) }).then((res) => {
        if (res.error) {
          console.error('[reaction] award_reaction failed:', res.error)
          toast.show(`couldn't save points: ${res.error.message}`, { tone: 'error' })
          return
        }
        toast.show(`+${res.data} points`, { tone: 'success' })
        window.dispatchEvent(new CustomEvent('points-changed'))
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const beginRound = () => {
    setPhase('waiting')
    startRef.current = 0
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)
    timerRef.current = window.setTimeout(() => {
      setPhase('ready')
      // Start timing only once the green frame is actually on screen. The
      // first rAF runs before the paint that shows green; the second runs on
      // the following frame, by which point green is displayed. This keeps
      // React render + browser paint latency out of the measured time.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          startRef.current = performance.now()
        })
      })
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
      // Green is on screen (phase committed) but the paint-synced start stamp
      // hasn't landed yet — ignore this click rather than record a bogus time.
      if (startRef.current === 0) return
      const elapsed = performance.now() - startRef.current
      setTime(elapsed)
      setTimes((prev) => [...prev, elapsed])
      setPhase('result')
    }
  }

  const showBest = highScore !== null && highScore > 0

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
      <BackButton label="Exit" onClick={(e) => e.stopPropagation()} />

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
          {showBest && (
            <div className="reaction-times-best">
              <span className="reaction-times-avg-label">best</span>
              <span className="reaction-times-avg-value">{highScore}</span>
            </div>
          )}
        </div>
      )}

      <div className="reaction-content">
        {phase === 'idle' && (
          <>
            <h1 className="reaction-heading">reaction test</h1>
            <p className="reaction-sub">
              when the screen changes color, click as fast as you can.
            </p>
            {showBest && (
              <p className="reaction-best">
                your best avg: <strong>{highScore} ms</strong>
              </p>
            )}
            <p className="reaction-cta">Click anywhere to start</p>
          </>
        )}

        {phase === 'waiting' && (
          <>
            <h1 className="reaction-heading">wait for it…</h1>
            <p className="reaction-sub">click the moment the color changes.</p>
          </>
        )}

        {phase === 'ready' && <h1 className="reaction-heading">GO</h1>}

        {phase === 'tooEarly' && (
          <>
            <h1 className="reaction-heading">too soon</h1>
            <p className="reaction-sub">wait for the color change next time.</p>
            <p className="reaction-cta">Click to try again</p>
          </>
        )}

        {phase === 'result' && (
          <>
            <div className="reaction-time">
              {Math.round(time)}
              <span className="reaction-unit"> ms</span>
            </div>
            {showBest && (
              <p className="reaction-best">
                best avg: <strong>{highScore} ms</strong>
              </p>
            )}
            <p className="reaction-cta">Click to try again</p>
          </>
        )}
      </div>
    </div>
  )
}
