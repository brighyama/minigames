import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { useToast } from '../../lib/toast'
import {
  aggregateKeyStates,
  dayIndex,
  equationForDay,
  evaluateGuess,
  EQUATION_LENGTH,
  isValidEquation,
  MAX_GUESSES,
  msUntilNextDay,
  puzzleNumber,
  shareGrid,
  type MathdleState,
} from './lib'
import './styles.css'

type Status = 'playing' | 'won' | 'lost'

type SavedState = {
  day: number
  guesses: string[]
  status: Status
}

type Stats = {
  lastDay: number | null
  streak: number
  best: number
  wins: number
  played: number
}

const STATE_KEY = 'minigames:mathdle:state'
const STATS_KEY = 'minigames:mathdle:stats'
const EMPTY_STATS: Stats = { lastDay: null, streak: 0, best: 0, wins: 0, played: 0 }

const KEY_ROWS = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '=', '+', 'backspace', 'enter'],
]

function loadState(day: number): SavedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as SavedState
    return state.day === day ? state : null
  } catch {
    return null
  }
}

function saveState(state: SavedState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable */
  }
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<Stats>) }
  } catch {
    return { ...EMPTY_STATS }
  }
}

function saveStats(stats: Stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    /* storage unavailable */
  }
}

function applyResult(stats: Stats, day: number, won: boolean): Stats {
  const streak = won ? (stats.lastDay === day - 1 ? stats.streak + 1 : 1) : 0
  return {
    lastDay: day,
    streak,
    best: Math.max(stats.best, streak),
    wins: stats.wins + (won ? 1 : 0),
    played: stats.played + 1,
  }
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function keyLabel(key: string): string {
  if (key === 'enter') return 'enter'
  if (key === 'backspace') return 'back'
  return key
}

export function MathdleGame() {
  const toast = useToast()

  const day = useMemo(() => dayIndex(), [])
  const answer = useMemo(() => equationForDay(day), [day])
  const puzzleNo = useMemo(() => puzzleNumber(day), [day])
  const saved = useMemo(() => loadState(day), [day])

  const [guesses, setGuesses] = useState<string[]>(saved?.guesses ?? [])
  const [current, setCurrent] = useState('')
  const [status, setStatus] = useState<Status>(saved?.status ?? 'playing')
  const [stats, setStats] = useState<Stats>(() => loadStats())
  const [shake, setShake] = useState(false)
  const [countdown, setCountdown] = useState(() => msUntilNextDay())

  const settledRef = useRef(saved?.status !== 'playing')
  const done = status !== 'playing'
  const keyStates = useMemo(() => aggregateKeyStates(guesses, answer), [answer, guesses])

  useEffect(() => {
    if (!done) return
    const id = window.setInterval(() => setCountdown(msUntilNextDay()), 1000)
    return () => window.clearInterval(id)
  }, [done])

  const triggerShake = () => {
    setShake(true)
    window.setTimeout(() => setShake(false), 380)
  }

  const settle = useCallback(
    (finalGuesses: string[], won: boolean, nextStatus: Status) => {
      if (settledRef.current) return
      settledRef.current = true
      saveState({ day, guesses: finalGuesses, status: nextStatus })
      setStats((prev) => {
        const next = applyResult(prev, day, won)
        saveStats(next)
        return next
      })
    },
    [day],
  )

  const submitGuess = useCallback(() => {
    if (status !== 'playing') return
    if (current.length < EQUATION_LENGTH) {
      toast.show('not enough characters', { tone: 'error' })
      triggerShake()
      return
    }
    if (!isValidEquation(current)) {
      toast.show('not a valid equation', { tone: 'error' })
      triggerShake()
      return
    }

    const nextGuesses = [...guesses, current]
    const won = current === answer
    const lost = !won && nextGuesses.length >= MAX_GUESSES
    const nextStatus: Status = won ? 'won' : lost ? 'lost' : 'playing'

    setGuesses(nextGuesses)
    setCurrent('')
    setStatus(nextStatus)
    saveState({ day, guesses: nextGuesses, status: nextStatus })
    if (won || lost) settle(nextGuesses, won, nextStatus)
  }, [answer, current, day, guesses, settle, status, toast])

  const handleKey = useCallback(
    (key: string) => {
      if (status !== 'playing') return
      if (key === 'enter') submitGuess()
      else if (key === 'backspace') setCurrent((c) => c.slice(0, -1))
      else if (/^[0-9+\-*/=]$/.test(key)) {
        setCurrent((c) => (c.length < EQUATION_LENGTH ? c + key : c))
      }
    },
    [status, submitGuess],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter') handleKey('enter')
      else if (e.key === 'Backspace') handleKey('backspace')
      else if (/^[0-9+\-*/=]$/.test(e.key)) handleKey(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey])

  const onShare = () => {
    const header = `Mathdle #${puzzleNo} ${status === 'won' ? guesses.length : 'X'}/${MAX_GUESSES}`
    const text = `${header}\n${shareGrid(guesses, answer)}`
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.show('copied to clipboard', { tone: 'success' }))
      .catch(() => toast.show('could not copy', { tone: 'error' }))
  }

  return (
    <main className="mathdle-container">
      <BackButton label="Exit" />

      <div className="mathdle-header">
        <h1 className="mathdle-title">mathdle</h1>
        <span className="mathdle-sub">puzzle #{puzzleNo}</span>
      </div>

      <div className="mathdle-stats" aria-label="Your streak">
        <div className="mathdle-stat"><span>{stats.streak}</span>streak</div>
        <div className="mathdle-stat"><span>{stats.best}</span>best</div>
        <div className="mathdle-stat"><span>{stats.wins}</span>solved</div>
      </div>

      <div className={`mathdle-board${shake ? ' is-shaking' : ''}`}>
        {Array.from({ length: MAX_GUESSES }).map((_, row) => {
          const guess = guesses[row]
          const isCurrentRow = row === guesses.length && status === 'playing'
          const states = guess ? evaluateGuess(guess, answer) : null

          return (
            <div className="mathdle-row" key={row}>
              {Array.from({ length: EQUATION_LENGTH }).map((_, col) => {
                const char = guess ? guess[col] : isCurrentRow ? current[col] ?? '' : ''
                const state = states ? states[col] : null
                const cls = ['mathdle-tile']
                if (state) cls.push(`is-${state}`, 'is-revealed')
                else if (char) cls.push('is-filled')
                return (
                  <div
                    className={cls.join(' ')}
                    key={col}
                    style={state ? { animationDelay: `${col * 70}ms` } : undefined}
                  >
                    {char}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="mathdle-keyboard" aria-label="Keyboard">
        {KEY_ROWS.map((row, i) => (
          <div className="mathdle-key-row" key={i}>
            {row.map((key) => {
              const state: MathdleState | undefined = key.length === 1 ? keyStates[key] : undefined
              return (
                <button
                  key={key}
                  className={`mathdle-key ${key.length > 1 ? 'is-wide' : ''}${state ? ` is-${state}` : ''}`}
                  onClick={() => handleKey(key)}
                  disabled={done}
                  aria-label={key === 'enter' ? 'Enter' : key === 'backspace' ? 'Backspace' : key}
                >
                  {keyLabel(key)}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {done && (
        <div className="mathdle-overlay">
          <div className="mathdle-result">
            <div className="mathdle-result-title">{status === 'won' ? 'solved!' : 'so close'}</div>
            {status === 'lost' && (
              <div className="mathdle-result-answer">
                answer <strong>{answer}</strong>
              </div>
            )}
            <div className="mathdle-result-streak">
              streak <strong>{stats.streak}</strong> / best <strong>{stats.best}</strong>
            </div>
            <div className="mathdle-result-actions">
              <button className="mathdle-btn mathdle-btn-primary" onClick={onShare}>
                share
              </button>
            </div>
            <div className="mathdle-next">next puzzle in {formatCountdown(countdown)}</div>
          </div>
        </div>
      )}
    </main>
  )
}
