import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fetchProfile } from '../../lib/profile'
import { useToast } from '../../lib/toast'
import { BackButton } from '../../components/BackButton'
import {
  aggregateKeyStates,
  dayIndex,
  evaluateGuess,
  isValidWord,
  MAX_GUESSES,
  msUntilNextDay,
  puzzleNumber,
  shareGrid,
  WORD_LENGTH,
  wordForDay,
  type LetterState,
} from './lib'
import './styles.css'

type Status = 'playing' | 'won' | 'lost'

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', '↵zxcvbnm⌫'] // ↵ … ⌫

const STATE_KEY = 'minigames:wordle:state'
const STATS_KEY = 'minigames:wordle:stats'

type SavedState = { day: number; guesses: string[]; status: Status }
type Stats = { lastDay: number | null; streak: number; best: number; wins: number; played: number }

const EMPTY_STATS: Stats = { lastDay: null, streak: 0, best: 0, wins: 0, played: 0 }

function loadState(day: number): SavedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SavedState
    return s.day === day ? s : null
  } catch {
    return null
  }
}

function saveState(s: SavedState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s))
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

function saveStats(s: Stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

// Mirror of the server's streak math, for offline / signed-out continuity.
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

export function WordleGame() {
  const { user } = useAuth()
  const toast = useToast()

  // The puzzle is fixed for the lifetime of this mount (a UTC day).
  const day = useMemo(() => dayIndex(), [])
  const answer = useMemo(() => wordForDay(day), [day])
  const puzzleNo = useMemo(() => puzzleNumber(day), [day])

  const saved = useMemo(() => loadState(day), [day])
  const [guesses, setGuesses] = useState<string[]>(saved?.guesses ?? [])
  const [current, setCurrent] = useState('')
  const [status, setStatus] = useState<Status>(saved?.status ?? 'playing')
  const [stats, setStats] = useState<Stats>(() => loadStats())
  const [shake, setShake] = useState(false)
  const [countdown, setCountdown] = useState(() => msUntilNextDay())

  const submittedRef = useRef(false)
  const done = status !== 'playing'

  const keyStates = useMemo(() => aggregateKeyStates(guesses, answer), [guesses, answer])

  // Pull the authoritative streak for signed-in players (display only).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchProfile(user.id).then((p) => {
      if (cancelled || !p) return
      setStats((prev) => ({
        ...prev,
        streak: p.wordle_streak ?? prev.streak,
        best: Math.max(prev.best, p.wordle_best_streak ?? 0),
        wins: p.wordle_wins ?? prev.wins,
        played: p.wordle_played ?? prev.played,
        lastDay: p.wordle_last_day ?? prev.lastDay,
      }))
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // Live countdown to the next puzzle, shown once the day is finished.
  useEffect(() => {
    if (!done) return
    const id = setInterval(() => setCountdown(msUntilNextDay()), 1000)
    return () => clearInterval(id)
  }, [done])

  // Settle a finished game: update local stats, persist, and (signed-in) submit
  // to the server once. Reload of an already-finished board never re-settles.
  const settle = useCallback(
    (finalGuesses: string[], won: boolean) => {
      if (submittedRef.current) return
      submittedRef.current = true

      setStats((prev) => {
        const next = applyResult(prev, day, won)
        saveStats(next)
        return next
      })

      if (!user || !supabase) return
      void supabase
        .rpc('submit_wordle_result', { puzzle_day: day, guesses: finalGuesses.length, solved: won })
        .then((res) => {
          if (res.error) {
            console.error('[wordle] submit failed:', res.error)
            return
          }
          const row = Array.isArray(res.data) ? res.data[0] : res.data
          if (row) {
            // Server is authoritative — reconcile the displayed streak.
            setStats((prev) => {
              const next = { ...prev, streak: row.streak, best: row.best, lastDay: day }
              saveStats(next)
              return next
            })
            if (row.reward) {
              toast.show(`+${row.reward} points`, { tone: 'success' })
              window.dispatchEvent(new CustomEvent('points-changed'))
            }
          }
        })
    },
    [day, user, toast],
  )

  const triggerShake = () => {
    setShake(true)
    window.setTimeout(() => setShake(false), 380)
  }

  const submitGuess = useCallback(() => {
    if (status !== 'playing') return
    if (current.length < WORD_LENGTH) {
      toast.show('not enough letters', { tone: 'error' })
      triggerShake()
      return
    }
    if (!isValidWord(current)) {
      toast.show('not in word list', { tone: 'error' })
      triggerShake()
      return
    }
    const guess = current.toLowerCase()
    const nextGuesses = [...guesses, guess]
    const won = guess === answer
    const lost = !won && nextGuesses.length >= MAX_GUESSES
    const nextStatus: Status = won ? 'won' : lost ? 'lost' : 'playing'

    setGuesses(nextGuesses)
    setCurrent('')
    setStatus(nextStatus)
    saveState({ day, guesses: nextGuesses, status: nextStatus })

    if (won || lost) settle(nextGuesses, won)
  }, [status, current, guesses, answer, day, toast, settle])

  const handleKey = useCallback(
    (key: string) => {
      if (status !== 'playing') return
      if (key === 'enter') submitGuess()
      else if (key === 'backspace') setCurrent((c) => c.slice(0, -1))
      else if (/^[a-z]$/.test(key)) setCurrent((c) => (c.length < WORD_LENGTH ? c + key : c))
    },
    [status, submitGuess],
  )

  // Physical keyboard.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter') handleKey('enter')
      else if (e.key === 'Backspace') handleKey('backspace')
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toLowerCase())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey])

  const onShare = () => {
    const header = `Daily Word #${puzzleNo} ${status === 'won' ? guesses.length : 'X'}/${MAX_GUESSES}`
    const text = `${header}\n${shareGrid(guesses, answer)}`
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.show('copied to clipboard', { tone: 'success' }))
      .catch(() => toast.show('could not copy', { tone: 'error' }))
  }

  // Map a special keyboard glyph to its action key.
  const keyFor = (ch: string) => (ch === '↵' ? 'enter' : ch === '⌫' ? 'backspace' : ch)

  return (
    <main className="wordle-container">
      <BackButton label="Exit" />

      <div className="wordle-header">
        <h1 className="wordle-title">daily word</h1>
        <span className="wordle-sub">puzzle #{puzzleNo}</span>
      </div>

      <div className="wordle-stats" aria-label="Your streak">
        <div className="wordle-stat"><span>{stats.streak}</span>streak</div>
        <div className="wordle-stat"><span>{stats.best}</span>best</div>
        <div className="wordle-stat"><span>{stats.wins}</span>solved</div>
      </div>

      <div className={`wordle-board${shake ? ' is-shaking' : ''}`}>
        {Array.from({ length: MAX_GUESSES }).map((_, row) => {
          const guess = guesses[row]
          const isCurrentRow = row === guesses.length && status === 'playing'
          const states = guess ? evaluateGuess(guess, answer) : null
          return (
            <div className="wordle-row" key={row}>
              {Array.from({ length: WORD_LENGTH }).map((_, col) => {
                const letter = guess ? guess[col] : isCurrentRow ? current[col] ?? '' : ''
                const state = states ? states[col] : null
                const cls = ['wordle-tile']
                if (state) cls.push(`is-${state}`, 'is-revealed')
                else if (letter) cls.push('is-filled')
                return (
                  <div
                    className={cls.join(' ')}
                    key={col}
                    style={state ? { animationDelay: `${col * 90}ms` } : undefined}
                  >
                    {letter ? letter.toUpperCase() : ''}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="wordle-keyboard" aria-label="Keyboard">
        {KEY_ROWS.map((rowStr, i) => (
          <div className="wordle-key-row" key={i}>
            {Array.from(rowStr).map((ch) => {
              const key = keyFor(ch)
              const wide = key === 'enter' || key === 'backspace'
              const state: LetterState | undefined = key.length === 1 ? keyStates[key] : undefined
              return (
                <button
                  key={ch}
                  className={`wordle-key${wide ? ' is-wide' : ''}${state ? ` is-${state}` : ''}`}
                  onClick={() => handleKey(key)}
                  disabled={done}
                  aria-label={key === 'enter' ? 'Enter' : key === 'backspace' ? 'Backspace' : key}
                >
                  {ch}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {done && (
        <div className="wordle-overlay">
          <div className="wordle-result">
            <div className="wordle-result-title">{status === 'won' ? 'solved!' : 'so close'}</div>
            {status === 'lost' && (
              <div className="wordle-result-word">
                the word was <strong>{answer.toUpperCase()}</strong>
              </div>
            )}
            <div className="wordle-result-streak">
              streak <strong>{stats.streak}</strong> · best <strong>{stats.best}</strong>
            </div>
            <div className="wordle-result-actions">
              <button className="wordle-btn wordle-btn-primary" onClick={onShare}>
                share
              </button>
            </div>
            <div className="wordle-next">next puzzle in {formatCountdown(countdown)}</div>
            {!user && <div className="wordle-note">sign in to save your streak to the leaderboard</div>}
          </div>
        </div>
      )}
    </main>
  )
}
