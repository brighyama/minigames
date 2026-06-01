import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { BackButton } from '../../components/BackButton'
import { useAuth } from '../../lib/auth'
import { fetchProfile } from '../../lib/profile'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import './styles.css'

type Phase = 'ready' | 'memorize' | 'recall' | 'advance' | 'lost'

type SubmitPatternResult = {
  best: number
  reward: number
}

const FLASH_MS = 950

function patternSizeForLevel(level: number): number {
  return level + 2
}

function gridSizeForPattern(patternSize: number): number {
  let size = 3
  while (patternSize / (size * size) > 1 / 3) size += 1
  return size
}

function pickPattern(totalTiles: number, count: number): Set<number> {
  const pool = Array.from({ length: totalTiles }, (_, i) => i)
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return new Set(pool.slice(0, count))
}

export function PatternGame() {
  const { user } = useAuth()
  const toast = useToast()

  const [phase, setPhase] = useState<Phase>('ready')
  const [level, setLevel] = useState(1)
  const [pattern, setPattern] = useState<Set<number>>(() => pickPattern(9, 3))
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [highScore, setHighScore] = useState<number | null>(null)
  const [lastScore, setLastScore] = useState(0)
  const [newBest, setNewBest] = useState(false)

  const userIdRef = useRef<string | null>(null)
  const submittedRunRef = useRef(false)

  const patternSize = patternSizeForLevel(level)
  const gridSize = gridSizeForPattern(patternSize)
  const totalTiles = gridSize * gridSize
  const tiles = useMemo(() => Array.from({ length: totalTiles }, (_, i) => i), [totalTiles])

  useEffect(() => {
    userIdRef.current = user?.id ?? null
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchProfile(user.id).then((profile) => {
      if (cancelled || !profile) return
      setHighScore(profile.pattern_best_level)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (phase !== 'memorize') return
    const timer = window.setTimeout(() => {
      setSelected(new Set())
      setPhase('recall')
    }, FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [phase, level])

  const prepareLevel = (nextLevel: number) => {
    const nextPatternSize = patternSizeForLevel(nextLevel)
    const nextGridSize = gridSizeForPattern(nextPatternSize)
    setLevel(nextLevel)
    setPattern(pickPattern(nextGridSize * nextGridSize, nextPatternSize))
    setSelected(new Set())
    setPhase('memorize')
  }

  const startGame = () => {
    submittedRunRef.current = false
    setLastScore(0)
    setNewBest(false)
    prepareLevel(1)
  }

  const submitScore = (score: number) => {
    if (submittedRunRef.current || score <= 0 || !userIdRef.current || !supabase) return
    submittedRunRef.current = true
    void supabase
      .rpc('submit_pattern_result', { completed_level: score })
      .then(({ data, error }) => {
        if (error) {
          console.error('[pattern] submit_pattern_result failed:', error)
          toast.show(`couldn't save score: ${error.message}`, { tone: 'error' })
          return
        }
        const result = Array.isArray(data) ? data[0] : data
        const reward = (result as SubmitPatternResult | null)?.reward ?? 0
        if (reward > 0) {
          toast.show(`+${reward} points`, { tone: 'success' })
          window.dispatchEvent(new CustomEvent('points-changed'))
        }
      })
  }

  const lose = () => {
    const completed = Math.max(0, level - 1)
    setLastScore(completed)
    const visibleHighScore = userIdRef.current ? highScore : null
    const beatPrev = visibleHighScore === null || completed > visibleHighScore
    setNewBest(beatPrev && completed > 0)
    if (beatPrev) setHighScore(completed)
    submitScore(completed)
    setPhase('lost')
  }

  const handleTileClick = (tile: number) => {
    if (phase !== 'recall') return
    if (!pattern.has(tile)) {
      lose()
      return
    }
    if (selected.has(tile)) return

    const nextSelected = new Set(selected)
    nextSelected.add(tile)
    setSelected(nextSelected)

    if (nextSelected.size === pattern.size) {
      setPhase('advance')
      window.setTimeout(() => prepareLevel(level + 1), 220)
    }
  }

  const showingPattern = phase === 'memorize'
  const waiting = phase === 'ready' || phase === 'lost'
  const visibleHighScore = user ? highScore : null
  const bestCopy = visibleHighScore !== null && visibleHighScore > 0
    ? `best: ${visibleHighScore}`
    : 'best: -'

  return (
    <main className={`pattern-container is-${phase}`}>
      <BackButton label="Exit" />

      <section className="pattern-stage" aria-label="Pattern recall game">
        <div className="pattern-hud" aria-hidden={waiting}>
          <span className="pattern-hud-item">
            level <strong>{level}</strong>
          </span>
          {/* <span className="pattern-hud-item">
            remember <strong>{patternSize}</strong>
          </span> */}
          <span className="pattern-hud-item">
            grid <strong>{gridSize}x{gridSize}</strong>
          </span>
        </div>

        {waiting && (
          <button type="button" className="pattern-start" onClick={startGame}>
            <span className="pattern-title">memory matrix</span>
            {phase === 'lost' ? (
              <>
                <span className="pattern-score">
                  {lastScore}
                </span>
                {newBest && <span className="pattern-new-best">new best</span>}
              </>
            ) : (
              <span className="pattern-subtitle">memorize the flashed tiles</span>
            )}
            <span className="pattern-best">{bestCopy}</span>
            <span className="pattern-cta">
              {phase === 'lost' ? 'click to play again' : 'click to play'}
            </span>
          </button>
        )}

        {!waiting && (
          <div
            className="pattern-board"
            style={{ '--pattern-grid': gridSize } as CSSProperties}
          >
            {tiles.map((tile) => {
              const isPattern = pattern.has(tile)
              const isSelected = selected.has(tile)
              const active = (showingPattern && isPattern) || isSelected
              return (
                <button
                  key={tile}
                  type="button"
                  className={`pattern-tile ${active ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''}`}
                  aria-label={`Tile ${tile + 1}`}
                  onClick={() => handleTileClick(tile)}
                  disabled={phase !== 'recall'}
                />
              )
            })}
          </div>
        )}

        {phase === 'memorize' && <div className="pattern-status">memorize</div>}
        {phase === 'recall' && <div className="pattern-status">repeat it</div>}
        {phase === 'advance' && <div className="pattern-status">correct</div>}
      </section>
    </main>
  )
}
