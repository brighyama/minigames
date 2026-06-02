import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { BackButton } from '../../components/BackButton'
import { useAuth } from '../../lib/auth'
import { fetchProfile } from '../../lib/profile'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import './styles.css'

type Phase = 'ready' | 'flash' | 'fade' | 'guess' | 'roundResult' | 'gameResult'

type HsbColor = {
  h: number
  s: number
  b: number
}

type RgbColor = {
  r: number
  g: number
  b: number
}

type Round = {
  target: HsbColor
  start: HsbColor
}

type RoundScore = {
  round: number
  score: number
  target: HsbColor
  guess: HsbColor
}

type SubmitColorMatchResult = {
  best: number
  reward: number
}

const ROUND_COUNT = 5
const FLASH_MS = 3000
const FADE_MS = 600
const MAX_ROUND_SCORE = 1000
const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255)
const MIN_START_DISTANCE = 120

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function randomTargetColor(): HsbColor {
  return {
    h: randomInt(0, 359),
    s: randomInt(35, 100),
    b: randomInt(35, 100),
  }
}

function hsbToRgb({ h, s, b }: HsbColor): RgbColor {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 100) / 100
  const val = clamp(b, 0, 100) / 100
  const c = val * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = val - c
  let rp = 0
  let gp = 0
  let bp = 0

  if (hue < 60) [rp, gp, bp] = [c, x, 0]
  else if (hue < 120) [rp, gp, bp] = [x, c, 0]
  else if (hue < 180) [rp, gp, bp] = [0, c, x]
  else if (hue < 240) [rp, gp, bp] = [0, x, c]
  else if (hue < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  }
}

function rgbDistance(a: RgbColor, b: RgbColor): number {
  return Math.sqrt(
    (a.r - b.r) ** 2 +
    (a.g - b.g) ** 2 +
    (a.b - b.b) ** 2,
  )
}

function scoreGuess(target: HsbColor, guess: HsbColor): number {
  const distance = rgbDistance(hsbToRgb(target), hsbToRgb(guess))
  return Math.round(MAX_ROUND_SCORE * Math.max(0, 1 - distance / MAX_RGB_DISTANCE))
}

function colorCss(color: HsbColor): string {
  const rgb = hsbToRgb(color)
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

function makeRound(): Round {
  const target = randomTargetColor()
  const targetRgb = hsbToRgb(target)
  let bestStart = randomTargetColor()
  let bestDistance = rgbDistance(targetRgb, hsbToRgb(bestStart))

  for (let i = 0; i < 20; i += 1) {
    const candidate = randomTargetColor()
    const distance = rgbDistance(targetRgb, hsbToRgb(candidate))
    if (distance >= MIN_START_DISTANCE) {
      return { target, start: candidate }
    }
    if (distance > bestDistance) {
      bestStart = candidate
      bestDistance = distance
    }
  }

  return { target, start: bestStart }
}

function formatAverage(total: number): string {
  return Math.round(total / ROUND_COUNT).toLocaleString()
}

function readNumber(value: string): number {
  return Number.parseInt(value, 10)
}

export function ColorMatchGame() {
  const { user } = useAuth()
  const toast = useToast()

  const [phase, setPhase] = useState<Phase>('ready')
  const [roundIndex, setRoundIndex] = useState(1)
  const [round, setRound] = useState<Round>(() => makeRound())
  const [guess, setGuess] = useState<HsbColor>(round.start)
  const [flashLeftMs, setFlashLeftMs] = useState(FLASH_MS)
  const [scores, setScores] = useState<RoundScore[]>([])
  const [lastRoundScore, setLastRoundScore] = useState<RoundScore | null>(null)
  const [highScore, setHighScore] = useState<number | null>(null)
  const [newBest, setNewBest] = useState(false)

  const userIdRef = useRef<string | null>(null)
  const submittedRunRef = useRef(false)

  const totalScore = useMemo(
    () => scores.reduce((sum, entry) => sum + entry.score, 0),
    [scores],
  )

  useEffect(() => {
    userIdRef.current = user?.id ?? null
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchProfile(user.id).then((profile) => {
      if (cancelled || !profile) return
      setHighScore(profile.color_match_best_score)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (phase !== 'flash') return
    const startedAt = performance.now()
    setFlashLeftMs(FLASH_MS)
    const tick = window.setInterval(() => {
      setFlashLeftMs(Math.max(0, FLASH_MS - (performance.now() - startedAt)))
    }, 80)
    const end = window.setTimeout(() => {
      setGuess(round.start)
      setPhase('fade')
    }, FLASH_MS)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(end)
    }
  }, [phase, round.start])

  useEffect(() => {
    if (phase !== 'fade') return
    const id = window.setTimeout(() => setPhase('guess'), FADE_MS)
    return () => window.clearTimeout(id)
  }, [phase])

  const submitRunScore = (score: number) => {
    if (submittedRunRef.current || !userIdRef.current || !supabase) return
    submittedRunRef.current = true
    void supabase.rpc('submit_color_match_result', { score }).then(({ data, error }) => {
      if (error) {
        console.error('[color-match] submit_color_match_result failed:', error)
        toast.show(`couldn't save score: ${error.message}`, { tone: 'error' })
        return
      }
      const result = Array.isArray(data) ? data[0] : data
      const reward = (result as SubmitColorMatchResult | null)?.reward ?? 0
      if (reward > 0) {
        toast.show(`+${reward} points`, { tone: 'success' })
        window.dispatchEvent(new CustomEvent('points-changed'))
      }
    })
  }

  const startRound = (nextRoundIndex: number, existingScores: RoundScore[]) => {
    const nextRound = makeRound()
    setRoundIndex(nextRoundIndex)
    setRound(nextRound)
    setGuess(nextRound.target)
    setFlashLeftMs(FLASH_MS)
    setScores(existingScores)
    setLastRoundScore(null)
    setPhase('flash')
  }

  const startRun = () => {
    submittedRunRef.current = false
    setNewBest(false)
    startRound(1, [])
  }

  const finishRun = (finalScores: RoundScore[]) => {
    const finalTotal = finalScores.reduce((sum, entry) => sum + entry.score, 0)
    const visibleHighScore = userIdRef.current ? highScore : null
    const beatPrev = visibleHighScore === null || finalTotal > visibleHighScore
    setNewBest(beatPrev && finalTotal > 0)
    if (beatPrev) setHighScore(finalTotal)
    setPhase('gameResult')
    submitRunScore(finalTotal)
  }

  const submitRound = () => {
    if (phase !== 'guess') return
    const entry: RoundScore = {
      round: roundIndex,
      score: scoreGuess(round.target, guess),
      target: round.target,
      guess,
    }
    const nextScores = [...scores, entry]
    setScores(nextScores)
    setLastRoundScore(entry)
    setPhase('roundResult')
    if (roundIndex >= ROUND_COUNT) {
      window.setTimeout(() => finishRun(nextScores), 900)
    }
  }

  const nextRound = () => {
    if (phase !== 'roundResult' || roundIndex >= ROUND_COUNT) return
    startRound(roundIndex + 1, scores)
  }

  const updateGuess = (key: keyof HsbColor, value: number) => {
    setGuess((prev) => ({ ...prev, [key]: value }))
  }

  const displayColor = phase === 'flash' ? round.target : guess
  const visibleHighScore = user ? highScore : null
  const bestCopy = visibleHighScore !== null && visibleHighScore > 0
    ? visibleHighScore.toLocaleString()
    : '-'

  return (
    <main className={`color-match-container is-${phase}`}>
      <BackButton label="Exit" />

      <section className="color-match-stage" aria-label="Color Match game">
        {phase === 'ready' && (
          <button type="button" className="color-match-start" onClick={startRun}>
            <span className="color-match-title">color match</span>
            <span className="color-match-subtitle">recreate the color from memory</span>
            <span className="color-match-best">best: {bestCopy}</span>
            <span className="color-match-cta">click to play</span>
          </button>
        )}

        {phase !== 'ready' && (
          <>
            {phase !== 'gameResult' && (
              <>
                <div className="color-match-hud">
                  <span className="color-match-hud-item">
                    round <strong>{Math.min(roundIndex, ROUND_COUNT)}/{ROUND_COUNT}</strong>
                  </span>
                  <span className="color-match-hud-item">
                    total <strong>{totalScore.toLocaleString()}</strong>
                  </span>
                  <span className="color-match-hud-item">
                    best <strong>{bestCopy}</strong>
                  </span>
                </div>

                <div className={`color-match-swatch is-${phase}`}>
                  <div
                    className="color-match-color"
                    style={{ background: colorCss(displayColor) }}
                  />
                  {phase === 'flash' && (
                    <div className="color-match-countdown">
                      {(flashLeftMs / 1000).toFixed(1)}
                    </div>
                  )}
                </div>

                {(phase === 'guess' || phase === 'roundResult') && (
                  <div className="color-match-controls" aria-label="Color controls">
                    <Slider
                      label="Hue"
                      value={guess.h}
                      min={0}
                      max={360}
                      suffix="deg"
                      onChange={(value) => updateGuess('h', value)}
                      disabled={phase !== 'guess'}
                      className="is-hue"
                    />
                    <Slider
                      label="Saturation"
                      value={guess.s}
                      min={0}
                      max={100}
                      suffix="%"
                      onChange={(value) => updateGuess('s', value)}
                      disabled={phase !== 'guess'}
                      style={{
                        '--slider-a': colorCss({ h: guess.h, s: 0, b: guess.b }),
                        '--slider-b': colorCss({ h: guess.h, s: 100, b: guess.b }),
                      } as CSSProperties}
                    />
                    <Slider
                      label="Brightness"
                      value={guess.b}
                      min={0}
                      max={100}
                      suffix="%"
                      onChange={(value) => updateGuess('b', value)}
                      disabled={phase !== 'guess'}
                      style={{
                        '--slider-a': '#000000',
                        '--slider-b': colorCss({ h: guess.h, s: guess.s, b: 100 }),
                      } as CSSProperties}
                    />
                    {phase === 'guess' && (
                      <button type="button" className="color-match-submit" onClick={submitRound}>
                        submit
                      </button>
                    )}
                  </div>
                )}

                {phase === 'flash' && <div className="color-match-status">memorize</div>}
                {phase === 'fade' && <div className="color-match-status">dial it in</div>}

                {phase === 'roundResult' && lastRoundScore && (
                  <ResultPanel
                    entry={lastRoundScore}
                    isFinal={roundIndex >= ROUND_COUNT}
                    onNext={nextRound}
                  />
                )}
              </>
            )}

            {phase === 'gameResult' && (
              <div className="color-match-result color-match-final">
                <span className="color-match-result-label">final score</span>
                <strong>{totalScore.toLocaleString()}</strong>
                <span>average {formatAverage(totalScore)}</span>
                {newBest && <span className="color-match-new-best">new best</span>}
                <span className="color-match-best">saved best: {bestCopy}</span>
                <button type="button" className="color-match-submit" onClick={startRun}>
                  play again
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  disabled?: boolean
  className?: string
  style?: CSSProperties
  onChange: (value: number) => void
}

function Slider({
  label,
  value,
  min,
  max,
  suffix,
  disabled,
  className,
  style,
  onChange,
}: SliderProps) {
  return (
    <label className={`color-match-slider ${className ?? ''}`} style={style}>
      <span>
        {label}
        <strong>{value}{suffix}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(readNumber(event.currentTarget.value))}
      />
    </label>
  )
}

function ResultPanel({
  entry,
  isFinal,
  onNext,
}: {
  entry: RoundScore
  isFinal: boolean
  onNext: () => void
}) {
  return (
    <div className="color-match-result">
      <span className="color-match-result-label">round {entry.round}</span>
      <strong>{entry.score.toLocaleString()}</strong>
      <div className="color-match-comparison" aria-label="Target and your guess">
        <div>
          <span>target</span>
          <div style={{ background: colorCss(entry.target) }} />
        </div>
        <div>
          <span>guess</span>
          <div style={{ background: colorCss(entry.guess) }} />
        </div>
      </div>
      {!isFinal && (
        <button type="button" className="color-match-submit" onClick={onNext}>
          next
        </button>
      )}
      {isFinal && <span className="color-match-next-note">calculating final score</span>}
    </div>
  )
}
