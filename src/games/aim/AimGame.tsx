import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { fetchProfile } from '../../lib/profile'
import type { Rarity } from '../../lib/themes'
import { BackButton } from '../../components/BackButton'
import './styles.css'

type Phase = 'idle' | 'playing' | 'result'

type Circle = {
  id: number
  x: number // percent of stage width
  y: number // percent of stage height
}

type Particle = {
  id: number
  x: number // px in stage
  y: number // px in stage
  vx: number
  vy: number
  size: number
  color: string
  life: number // frames remaining
  maxLife: number
  gravity: boolean
}

const GAME_DURATION_MS = 20_000
const CIRCLE_SIZE = 60 // px diameter, fixed for every spawn

let _idCounter = 1
const nextId = () => _idCounter++

type Props = {
  rarity?: Rarity
}

function readAccent(name: '--accent-1' | '--accent-2'): string {
  if (typeof window === 'undefined') return '#ffffff'
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    '#ffffff'
  )
}

function randomCirclePos(): Circle {
  return {
    id: nextId(),
    x: 10 + Math.random() * 80,
    y: 18 + Math.random() * 64,
  }
}

/**
 * Points awarded on exit, based on the best session score:
 *   5 (for completing at least one full 20s round)
 *   + 1 per 2 circles clicked
 */
function pointsForScore(score: number): number {
  return 5 + Math.floor(score / 2)
}

export function AimGame({ rarity }: Props) {
  const { user } = useAuth()
  const toast = useToast()

  const [phase, setPhase] = useState<Phase>('idle')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(20)
  const [circle, setCircle] = useState<Circle | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  /** All-time best (higher = better). Null until profile loads. */
  const [highScore, setHighScore] = useState<number | null>(null)
  /** Whether the most recent completed round set a new personal best. */
  const [newBest, setNewBest] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const userIdRef = useRef<string | null>(null)
  const bestSessionScoreRef = useRef<number | null>(null)

  userIdRef.current = user?.id ?? null

  useEffect(() => {
    if (!user) {
      setHighScore(null)
      return
    }
    let cancelled = false
    fetchProfile(user.id).then((profile) => {
      if (cancelled || !profile) return
      setHighScore(profile.aim_high_score)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // Game timer while playing.
  useEffect(() => {
    if (phase !== 'playing') return
    const startedAt = performance.now()
    const tick = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      const remaining = Math.max(0, Math.ceil((GAME_DURATION_MS - elapsed) / 1000))
      setTimeLeft(remaining)
    }, 100)
    const end = window.setTimeout(() => setPhase('result'), GAME_DURATION_MS)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(end)
    }
  }, [phase])

  // Round-completion bookkeeping: track best session score, detect new best,
  // and persist immediately so saves don't depend on unmount timing.
  useEffect(() => {
    if (phase !== 'result') return
    bestSessionScoreRef.current = Math.max(
      bestSessionScoreRef.current ?? 0,
      score,
    )
    const beatPrev = highScore === null || score > highScore
    if (beatPrev) {
      setHighScore(score)
      setNewBest(score > 0)
      if (score > 0 && userIdRef.current && supabase) {
        void supabase
          .rpc('update_aim_high_score', { score })
          .then((res) => {
            if (res.error) {
              console.error('[aim] update_aim_high_score failed:', res.error)
              toast.show(`Couldn't save high score: ${res.error.message}`, {
                tone: 'error',
              })
            }
          })
      }
    } else {
      setNewBest(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Clear the circle when not playing (idle/result).
  useEffect(() => {
    if (phase !== 'playing') setCircle(null)
  }, [phase])

  // Particle animation loop (rAF).
  useEffect(() => {
    let raf = 0
    const tick = () => {
      setParticles((prev) => {
        if (prev.length === 0) return prev
        return prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.gravity ? p.vy + 0.35 : p.vy,
            life: p.life - 1,
          }))
          .filter((p) => p.life > 0)
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // On unmount: award points based on the best session score (high score is
  // persisted at round end, not here, so navigation timing can't drop it).
  useEffect(() => {
    return () => {
      const best = bestSessionScoreRef.current
      if (best === null || !userIdRef.current || !supabase) return
      const amount = pointsForScore(best)
      void supabase.rpc('add_points', { amount }).then((res) => {
        if (res.error) {
          console.error('[aim] add_points failed:', res.error)
          toast.show(`Couldn't save points: ${res.error.message}`, { tone: 'error' })
          return
        }
        toast.show(`+${amount} points`, { tone: 'success' })
        window.dispatchEvent(new CustomEvent('points-changed'))
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startRound = () => {
    setScore(0)
    setTimeLeft(20)
    setParticles([])
    setNewBest(false)
    setPhase('playing')
    setCircle(randomCirclePos())
  }

  const onStageClick = () => {
    if (phase === 'idle' || phase === 'result') startRound()
  }

  const onCircleClick = (
    e: MouseEvent<HTMLDivElement>,
    target: Circle,
  ) => {
    e.stopPropagation()
    if (phase !== 'playing') return

    setScore((s) => s + 1)

    // Compute hit position in stage-pixel coords for the particle effect.
    const stage = stageRef.current
    if (stage) {
      const rect = stage.getBoundingClientRect()
      const x = (target.x / 100) * rect.width
      const y = (target.y / 100) * rect.height
      if (rarity === 'red') spawnExplosion(x, y)
      else if (rarity === 'gold') spawnSparkle(x, y)
    }

    // Immediately spawn the next circle.
    setCircle(randomCirclePos())
  }

  const spawnExplosion = (x: number, y: number) => {
    const c1 = readAccent('--accent-1')
    const c2 = readAccent('--accent-2')
    const burst: Particle[] = []
    for (let i = 0; i < 8; i++) {
      burst.push({
        id: nextId(),
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: -3 - Math.random() * 6,
        size: 6 + Math.random() * 6,
        color: Math.random() > 0.5 ? c1 : c2,
        life: 80,
        maxLife: 80,
        gravity: true,
      })
    }
    setParticles((prev) => [...prev, ...burst])
  }

  const spawnSparkle = (x: number, y: number) => {
    const burst: Particle[] = []
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4
      const speed = 2 + Math.random() * 3.5
      burst.push({
        id: nextId(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 3,
        color: '#ffd76b',
        life: 50,
        maxLife: 50,
        gravity: false,
      })
    }
    setParticles((prev) => [...prev, ...burst])
  }

  const showBest = highScore !== null && highScore > 0

  return (
    <main className="aim-container">
      <BackButton label="Exit" />

      <div className="aim-frame">
        <div
          ref={stageRef}
          className={`aim-stage is-${phase}`}
          onClick={onStageClick}
        >
          {phase === 'playing' && (
            <div className="aim-hud" aria-hidden="true">
              <span className="aim-hud-item aim-hud-time">{timeLeft}s</span>
              <span className="aim-hud-item aim-hud-score">{score}</span>
            </div>
          )}

          {phase === 'idle' && (
            <div className="aim-message">
              <h1 className="aim-heading">Aim Trainer</h1>
              <p className="aim-sub">
                Click as many circles as you can in 20 seconds.
              </p>
              {showBest && (
                <p className="aim-best">
                  Your best: <strong>{highScore}</strong>
                </p>
              )}
              <p className="aim-cta">Click anywhere to start</p>
            </div>
          )}

          {phase === 'result' && (
            <div className="aim-message">
              <div className="aim-score-display">{score}</div>
              <p className="aim-sub">circles hit</p>
              {newBest && <p className="aim-new-best">New best!</p>}
              {highScore !== null && (
                <p className="aim-best">
                  Best: <strong>{highScore}</strong>
                </p>
              )}
              <p className="aim-cta">Click anywhere to play again</p>
            </div>
          )}

          {circle && (
            <div
              key={circle.id}
              className="aim-circle"
              style={{
                left: `${circle.x}%`,
                top: `${circle.y}%`,
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
              }}
              onClick={(e) => onCircleClick(e, circle)}
            />
          )}

          {particles.map((p) => (
            <div
              key={p.id}
              className="aim-particle"
              style={{
                transform: `translate(${p.x - p.size / 2}px, ${p.y - p.size / 2}px)`,
                width: p.size,
                height: p.size,
                background: p.color,
                opacity: p.life / p.maxLife,
              }}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
