import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { BackButton } from '../../components/BackButton'
import './styles.css'

type Phase = 'idle' | 'running' | 'finished'

type Stats = {
  wpm: number
  rawWpm: number
  accuracy: number
  correctChars: number
  incorrectChars: number
  typedChars: number
}

type Best = {
  wpm: number
  accuracy: number
}

const DURATION_MS = 20_000
const WORD_COUNT = 220
const BEST_KEY = 'minigames:type-sprint:best'

const WORDS = [
  'able',
  'about',
  'above',
  'after',
  'again',
  'air',
  'all',
  'almost',
  'alone',
  'also',
  'always',
  'am',
  'among',
  'an',
  'and',
  'animal',
  'another',
  'answer',
  'any',
  'around',
  'art',
  'ask',
  'back',
  'base',
  'be',
  'beat',
  'because',
  'been',
  'before',
  'begin',
  'best',
  'better',
  'big',
  'bird',
  'black',
  'blue',
  'book',
  'both',
  'box',
  'boy',
  'bring',
  'build',
  'busy',
  'but',
  'by',
  'call',
  'came',
  'can',
  'carry',
  'case',
  'change',
  'check',
  'city',
  'clear',
  'close',
  'color',
  'come',
  'common',
  'copy',
  'could',
  'course',
  'day',
  'deep',
  'did',
  'different',
  'do',
  'does',
  'done',
  'door',
  'down',
  'draw',
  'dream',
  'drive',
  'each',
  'early',
  'earth',
  'easy',
  'eat',
  'end',
  'enough',
  'even',
  'every',
  'example',
  'eye',
  'face',
  'fact',
  'fall',
  'family',
  'far',
  'fast',
  'feel',
  'few',
  'field',
  'find',
  'fine',
  'fire',
  'first',
  'fish',
  'five',
  'follow',
  'for',
  'form',
  'found',
  'four',
  'friend',
  'from',
  'front',
  'full',
  'game',
  'gave',
  'get',
  'give',
  'go',
  'good',
  'great',
  'green',
  'ground',
  'group',
  'grow',
  'had',
  'half',
  'hand',
  'hard',
  'has',
  'have',
  'head',
  'hear',
  'help',
  'here',
  'high',
  'home',
  'house',
  'how',
  'idea',
  'if',
  'in',
  'inside',
  'into',
  'is',
  'it',
  'just',
  'keep',
  'kind',
  'know',
  'land',
  'large',
  'last',
  'late',
  'learn',
  'left',
  'let',
  'letter',
  'life',
  'light',
  'like',
  'line',
  'list',
  'little',
  'live',
  'long',
  'look',
  'made',
  'make',
  'many',
  'mark',
  'may',
  'mean',
  'mind',
  'miss',
  'moon',
  'more',
  'most',
  'move',
  'much',
  'name',
  'near',
  'need',
  'new',
  'next',
  'night',
  'no',
  'not',
  'now',
  'number',
  'of',
  'off',
  'old',
  'on',
  'one',
  'only',
  'open',
  'or',
  'other',
  'out',
  'over',
  'own',
  'page',
  'part',
  'place',
  'play',
  'point',
  'press',
  'put',
  'quick',
  'read',
  'real',
  'right',
  'run',
  'said',
  'same',
  'say',
  'score',
  'see',
  'set',
  'short',
  'side',
  'small',
  'sound',
  'space',
  'speed',
  'start',
  'still',
  'such',
  'take',
  'tell',
  'than',
  'that',
  'the',
  'their',
  'then',
  'there',
  'these',
  'thing',
  'think',
  'this',
  'time',
  'to',
  'top',
  'try',
  'turn',
  'two',
  'under',
  'up',
  'use',
  'very',
  'walk',
  'want',
  'was',
  'water',
  'way',
  'we',
  'well',
  'went',
  'were',
  'what',
  'when',
  'where',
  'white',
  'who',
  'why',
  'will',
  'with',
  'word',
  'work',
  'world',
  'would',
  'write',
  'year',
  'yes',
  'you',
  'young',
]

function generateWords(count = WORD_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const index = Math.floor(Math.random() * WORDS.length)
    return WORDS[index]
  })
}

function readBest(): Best | null {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    return raw ? (JSON.parse(raw) as Best) : null
  } catch {
    return null
  }
}

function isBetterBest(candidate: Best, current: Best | null): boolean {
  if (!current) return candidate.wpm > 0
  if (candidate.wpm !== current.wpm) return candidate.wpm > current.wpm
  return candidate.accuracy > current.accuracy
}

function analyzeTyping(typed: string, target: string, elapsedMs: number): Stats {
  const typedChars = typed.length
  let correctChars = 0
  let incorrectChars = 0

  for (let i = 0; i < typedChars; i += 1) {
    if (typed[i] === target[i]) correctChars += 1
    else incorrectChars += 1
  }

  const minutes = Math.max(elapsedMs, 1) / 60_000
  const wpm = Math.round(correctChars / 5 / minutes)
  const rawWpm = Math.round(typedChars / 5 / minutes)
  const accuracy = typedChars === 0 ? 100 : Math.round((correctChars / typedChars) * 100)

  return {
    wpm,
    rawWpm,
    accuracy,
    correctChars,
    incorrectChars,
    typedChars,
  }
}

function formatTime(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(1)
}

export function TypeSprintGame() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [words, setWords] = useState<string[]>(() => generateWords())
  const [typed, setTyped] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [best, setBest] = useState<Best | null>(() => readBest())
  const [finalStats, setFinalStats] = useState<Stats | null>(null)
  const [newBest, setNewBest] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const startTimeRef = useRef(0)
  const typedRef = useRef('')
  const finalizingRef = useRef(false)

  const targetText = useMemo(() => words.join(' '), [words])
  const stats = useMemo(
    () => analyzeTyping(typed, targetText, phase === 'finished' ? DURATION_MS : elapsedMs),
    [elapsedMs, phase, targetText, typed],
  )
  const timeLeftMs = phase === 'finished' ? 0 : DURATION_MS - elapsedMs

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    typedRef.current = typed
  }, [typed])

  function finishRound() {
    if (finalizingRef.current) return
    finalizingRef.current = true
    const result = analyzeTyping(typedRef.current, targetText, DURATION_MS)
    const candidate = { wpm: result.wpm, accuracy: result.accuracy }

    setElapsedMs(DURATION_MS)
    setFinalStats(result)
    setPhase('finished')

    if (isBetterBest(candidate, best)) {
      setBest(candidate)
      setNewBest(true)
      localStorage.setItem(BEST_KEY, JSON.stringify(candidate))
    } else {
      setNewBest(false)
    }
  }

  useEffect(() => {
    if (phase !== 'running') return

    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current
      if (elapsed >= DURATION_MS) {
        finishRound()
        return
      }
      setElapsedMs(elapsed)
    }, 50)

    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const restart = () => {
    finalizingRef.current = false
    setWords(generateWords())
    setTyped('')
    setElapsedMs(0)
    setFinalStats(null)
    setNewBest(false)
    setPhase('idle')
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleChange = (value: string) => {
    if (phase === 'finished') return

    const normalized = value.replace(/\s+/g, ' ')
    if (phase === 'idle') {
      if (normalized.trimStart().length === 0) {
        setTyped('')
        return
      }
      startTimeRef.current = performance.now()
      setPhase('running')
    }

    setTyped(normalized.slice(0, targetText.length))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' || e.key === 'Escape') {
      e.preventDefault()
      restart()
    }
  }

  const displayStats = finalStats ?? stats

  return (
    <main className="type-sprint-container" onClick={() => inputRef.current?.focus()}>
      <BackButton label="Exit" />

      <section className={`type-sprint-shell is-${phase}`} aria-label="Type Sprint">
        <div className="type-sprint-topbar">
          <div className="type-sprint-mode">
            <span>time</span>
            <strong>20</strong>
          </div>
          <div className="type-sprint-timer" aria-live="polite">
            {formatTime(timeLeftMs)}
          </div>
        </div>

        <div className="type-sprint-stats" aria-label="Typing stats">
          <div className="type-sprint-stat">
            <span>wpm</span>
            <strong>{displayStats.wpm}</strong>
          </div>
          <div className="type-sprint-stat">
            <span>acc</span>
            <strong>{displayStats.accuracy}%</strong>
          </div>
          <div className="type-sprint-stat">
            <span>raw</span>
            <strong>{displayStats.rawWpm}</strong>
          </div>
          <div className="type-sprint-stat">
            <span>best</span>
            <strong>{best ? best.wpm : '-'}</strong>
          </div>
        </div>

        <div
          className="type-sprint-words"
          role="textbox"
          aria-label="Words to type"
          aria-readonly="true"
        >
          {targetText.split('').map((char, index) => {
            const typedChar = typed[index]
            const isTyped = typedChar !== undefined
            const isCorrect = isTyped && typedChar === char
            const isIncorrect = isTyped && typedChar !== char
            const isCaret = index === typed.length && phase !== 'finished'
            const isSpace = char === ' '

            return (
              <span
                key={`${index}-${char}`}
                className={[
                  'type-sprint-char',
                  isSpace ? 'is-space' : '',
                  isCorrect ? 'is-correct' : '',
                  isIncorrect ? 'is-incorrect' : '',
                  isCaret ? 'has-caret' : '',
                ].join(' ')}
              >
                {isSpace ? ' ' : char}
              </span>
            )
          })}
          {typed.length === targetText.length && phase !== 'finished' && (
            <span className="type-sprint-end-caret" />
          )}
        </div>

        <textarea
          ref={inputRef}
          className="type-sprint-input"
          value={typed}
          aria-label="Typing input"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {phase === 'idle' && (
          <div className="type-sprint-hint">
            <span>start typing</span>
          </div>
        )}

        {phase === 'finished' && finalStats && (
          <div className="type-sprint-result">
            <div className="type-sprint-result-score">
              <span>{finalStats.wpm}</span>
              <strong>wpm</strong>
            </div>
            <div className="type-sprint-result-grid">
              <span>
                acc <strong>{finalStats.accuracy}%</strong>
              </span>
              <span>
                raw <strong>{finalStats.rawWpm}</strong>
              </span>
              <span>
                chars <strong>{finalStats.correctChars}/{finalStats.incorrectChars}</strong>
              </span>
              <span>
                best <strong>{best ? best.wpm : '-'}</strong>
              </span>
            </div>
            {newBest && <p className="type-sprint-new-best">new best</p>}
            <button type="button" className="type-sprint-restart" onClick={restart}>
              restart
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
