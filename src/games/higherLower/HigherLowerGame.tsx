import { useCallback, useEffect, useRef, useState } from 'react'
import { BackButton } from '../../components/BackButton'
import {
  HIGHER_LOWER_CATEGORIES,
  categoryById,
  type HigherLowerCategoryId,
  type HigherLowerItem,
} from './data'
import './styles.css'

type Guess = 'higher' | 'lower'
type Phase = 'guessing' | 'revealing' | 'lost'

const CATEGORY_KEY = 'minigames:higher-lower:category'
const BEST_KEY = 'minigames:higher-lower:bests'

function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function loadCategory(): HigherLowerCategoryId | null {
  try {
    const value = localStorage.getItem(CATEGORY_KEY)
    return HIGHER_LOWER_CATEGORIES.some((category) => category.id === value)
      ? value as HigherLowerCategoryId
      : null
  } catch {
    return null
  }
}

function loadBests(): Partial<Record<HigherLowerCategoryId, number>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, unknown>
    const bests: Partial<Record<HigherLowerCategoryId, number>> = {}
    for (const category of HIGHER_LOWER_CATEGORIES) {
      const value = parsed[category.id]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        bests[category.id] = Math.floor(value)
      }
    }
    return bests
  } catch {
    return {}
  }
}

function makeDeck(categoryId: HigherLowerCategoryId): HigherLowerItem[] {
  return shuffled(categoryById(categoryId).items)
}

export function HigherLowerGame() {
  const [categoryId, setCategoryId] = useState<HigherLowerCategoryId | null>(() => loadCategory())
  const [deck, setDeck] = useState<HigherLowerItem[]>(() =>
    loadCategory() ? makeDeck(loadCategory()!) : [],
  )
  const [leftIndex, setLeftIndex] = useState(0)
  const [rightIndex, setRightIndex] = useState(1)
  const [score, setScore] = useState(0)
  const [bests, setBests] = useState(() => loadBests())
  const [phase, setPhase] = useState<Phase>('guessing')
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const category = categoryId ? categoryById(categoryId) : null
  const left = deck[leftIndex]
  const right = deck[rightIndex]

  const clearPending = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  useEffect(() => clearPending, [])

  const startCategory = useCallback((nextCategory: HigherLowerCategoryId) => {
    clearPending()
    const nextDeck = makeDeck(nextCategory)
    setCategoryId(nextCategory)
    setDeck(nextDeck)
    setLeftIndex(0)
    setRightIndex(1)
    setScore(0)
    setPhase('guessing')
    setLastCorrect(null)
    try {
      localStorage.setItem(CATEGORY_KEY, nextCategory)
    } catch {
      // Local persistence is optional.
    }
  }, [])

  const nextRightIndex = useCallback((current: number, currentDeck: HigherLowerItem[]) => {
    const next = current + 1
    if (next < currentDeck.length) return { deck: currentDeck, index: next }
    const reshuffled = shuffled(currentDeck)
    return { deck: reshuffled, index: 0 }
  }, [])

  const guess = useCallback((choice: Guess) => {
    if (phase !== 'guessing' || !left || !right || !categoryId) return
    const correct = choice === 'higher' ? right.value >= left.value : right.value <= left.value
    setLastCorrect(correct)
    setPhase('revealing')

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      if (!correct) {
        setPhase('lost')
        return
      }

      const nextScore = score + 1
      setScore(nextScore)
      setBests((previous) => {
        if ((previous[categoryId] ?? 0) >= nextScore) return previous
        const next = { ...previous, [categoryId]: nextScore }
        try {
          localStorage.setItem(BEST_KEY, JSON.stringify(next))
        } catch {
          // Local persistence is optional.
        }
        return next
      })

      setLeftIndex(rightIndex)
      const next = nextRightIndex(rightIndex, deck)
      if (next.deck !== deck) {
        // Keep the just-revealed item as the known left side after reshuffling.
        const known = right
        const withoutKnown = next.deck.filter((candidate) => candidate.id !== known.id)
        const refreshed = [known, ...withoutKnown]
        setDeck(refreshed)
        setLeftIndex(0)
        setRightIndex(1)
      } else {
        setRightIndex(next.index)
      }
      setLastCorrect(null)
      setPhase('guessing')
    }, 760)
  }, [categoryId, deck, left, nextRightIndex, phase, right, rightIndex, score])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'ArrowUp' || event.code === 'KeyH') {
        event.preventDefault()
        guess('higher')
      } else if (event.code === 'ArrowDown' || event.code === 'KeyL') {
        event.preventDefault()
        guess('lower')
      } else if (event.code === 'KeyR' && categoryId) {
        event.preventDefault()
        startCategory(categoryId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [categoryId, guess, startCategory])

  if (!category || !left || !right) {
    return (
      <main className="hl-container">
        <BackButton label="Exit" />
        <section className="hl-picker">
          <div className="hl-picker-head">
            <span className="hl-eyebrow">pick a dataset</span>
            <h1 className="hl-title">higher or lower</h1>
            <p>Build a streak by guessing which item has the larger value.</p>
          </div>
          <div className="hl-category-grid">
            {HIGHER_LOWER_CATEGORIES.map((entry) => (
              <button
                type="button"
                className={`hl-category-card category-${entry.id}`}
                key={entry.id}
                onClick={() => startCategory(entry.id)}
              >
                <span className="hl-category-name">{entry.name}</span>
                <span className="hl-category-description">{entry.description}</span>
                <span className="hl-category-best">best {bests[entry.id] ?? 0}</span>
              </button>
            ))}
          </div>
          <p className="hl-snapshot-note">
            Ratings, prices, searches, and populations are curated reference snapshots—not live feeds.
          </p>
        </section>
      </main>
    )
  }

  const activeCategoryId = category.id

  return (
    <main className="hl-container">
      <BackButton label="Exit" />

      <header className="hl-game-head">
        <button type="button" className="hl-category-switch" onClick={() => setCategoryId(null)}>
          ‹ categories
        </button>
        <div>
          <h1 className="hl-game-title">higher or lower</h1>
          <span className="hl-game-category">{category.name}</span>
        </div>
        <div className="hl-scoreboard">
          <span><small>score</small>{score}</span>
          <span><small>best</small>{Math.max(score, bests[activeCategoryId] ?? 0)}</span>
        </div>
      </header>

      <section className={`hl-arena phase-${phase} ${lastCorrect === true ? 'is-correct' : ''} ${lastCorrect === false ? 'is-wrong' : ''}`}>
        <ItemPanel item={left} known category={category} />

        <div className="hl-versus" aria-hidden="true">vs</div>

        <ItemPanel item={right} known={phase !== 'guessing'} category={category}>
          {phase === 'guessing' && (
            <div className="hl-guess-controls">
              <span className="hl-guess-prompt">has {category.question}</span>
              <button type="button" onClick={() => guess('higher')}>
                <span className="hl-arrow">↑</span>
                higher
                <kbd>H</kbd>
              </button>
              <button type="button" onClick={() => guess('lower')}>
                <span className="hl-arrow">↓</span>
                lower
                <kbd>L</kbd>
              </button>
              <span className="hl-than">than {left.name}</span>
            </div>
          )}
        </ItemPanel>

        {phase === 'lost' && (
          <div className="hl-result-overlay">
            <div className="hl-result-card">
              <span className="hl-result-kicker">streak ended</span>
              <strong>{score}</strong>
              <span>correct guesses</span>
              <div className="hl-result-actions">
                <button type="button" className="hl-btn hl-btn-primary" onClick={() => startCategory(activeCategoryId)}>
                  play again
                </button>
                <button type="button" className="hl-btn" onClick={() => setCategoryId(null)}>
                  categories
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="hl-footer">
        <span>{category.snapshot}</span>
        <span>↑/H higher · ↓/L lower · R restart</span>
      </footer>
    </main>
  )
}

function ItemPanel({
  item,
  known,
  category,
  children,
}: {
  item: HigherLowerItem
  known: boolean
  category: ReturnType<typeof categoryById>
  children?: React.ReactNode
}) {
  return (
    <article className="hl-item" style={{ background: item.gradient }}>
      <div className="hl-item-pattern" aria-hidden="true">{item.symbol}</div>
      <div className="hl-item-shade" />
      <div className="hl-item-content">
        <span className="hl-item-subtitle">{item.subtitle}</span>
        <h2>{item.name}</h2>
        {known ? (
          <div className="hl-value">
            <strong>{category.format(item.value)}</strong>
            <span>{category.metric}</span>
          </div>
        ) : children}
      </div>
    </article>
  )
}
