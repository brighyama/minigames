import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import { BackButton } from '../../components/BackButton'
import {
  createSnakeGame,
  SNAKE_DIFFICULTIES,
  SNAKE_DIFFICULTY_ORDER,
  SNAKE_MODE_ORDER,
  SNAKE_MODES,
  SNAKE_SIZE,
  stepSnake,
  tickDelay,
  type Direction,
  type SnakeDifficulty,
  type SnakeMode,
  type SnakeState,
} from './lib'
import './styles.css'

type Phase = 'ready' | 'playing' | 'paused' | 'over'

const MODE_KEY = 'minigames:snake:mode'
const DIFFICULTY_KEY = 'minigames:snake:difficulty'
const BESTS_KEY = 'minigames:snake:bests'
const RUSH_MS = 60_000

const KEY_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
}

function loadMode(): SnakeMode {
  try {
    const saved = localStorage.getItem(MODE_KEY)
    return SNAKE_MODE_ORDER.includes(saved as SnakeMode) ? saved as SnakeMode : 'classic'
  } catch {
    return 'classic'
  }
}

function loadDifficulty(): SnakeDifficulty {
  try {
    const saved = localStorage.getItem(DIFFICULTY_KEY)
    return SNAKE_DIFFICULTY_ORDER.includes(saved as SnakeDifficulty)
      ? saved as SnakeDifficulty
      : 'normal'
  } catch {
    return 'normal'
  }
}

function loadBests(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(BESTS_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] >= 0,
      ),
    )
  } catch {
    return {}
  }
}

function bestKey(mode: SnakeMode, difficulty: SnakeDifficulty): string {
  return `${mode}:${difficulty}`
}

export function SnakeGame() {
  const [mode, setMode] = useState<SnakeMode>(() => loadMode())
  const [difficulty, setDifficulty] = useState<SnakeDifficulty>(() => loadDifficulty())
  const [game, setGame] = useState<SnakeState>(() => createSnakeGame(loadMode()))
  const [phase, setPhase] = useState<Phase>('ready')
  const [remainingMs, setRemainingMs] = useState(RUSH_MS)
  const [bests, setBests] = useState<Record<string, number>>(() => loadBests())

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const queuedDirectionRef = useRef<Direction>('right')
  const deadlineRef = useRef(0)
  const touchRef = useRef<{ x: number; y: number } | null>(null)

  const currentBest = bests[bestKey(mode, difficulty)] ?? 0

  const saveBest = useCallback((score: number) => {
    const key = bestKey(mode, difficulty)
    setBests((previous) => {
      if ((previous[key] ?? 0) >= score) return previous
      const next = { ...previous, [key]: score }
      try {
        localStorage.setItem(BESTS_KEY, JSON.stringify(next))
      } catch {
        // Local persistence is optional.
      }
      return next
    })
  }, [difficulty, mode])

  const newGame = useCallback((nextMode: SnakeMode = mode) => {
    setGame(createSnakeGame(nextMode))
    queuedDirectionRef.current = 'right'
    setRemainingMs(RUSH_MS)
    setPhase('ready')
  }, [mode])

  const start = useCallback(() => {
    if (phase === 'over') {
      newGame()
      return
    }
    if (mode === 'rush') {
      deadlineRef.current = performance.now() + remainingMs
    }
    setPhase('playing')
  }, [mode, newGame, phase, remainingMs])

  const chooseMode = (next: SnakeMode) => {
    setMode(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // Local persistence is optional.
    }
    newGame(next)
  }

  const chooseDifficulty = (next: SnakeDifficulty) => {
    setDifficulty(next)
    try {
      localStorage.setItem(DIFFICULTY_KEY, next)
    } catch {
      // Local persistence is optional.
    }
    newGame(mode)
  }

  const setDirection = useCallback((direction: Direction) => {
    queuedDirectionRef.current = direction
    if (phase === 'ready') start()
  }, [phase, start])

  const togglePause = useCallback(() => {
    if (phase === 'playing') {
      if (mode === 'rush') setRemainingMs(Math.max(0, deadlineRef.current - performance.now()))
      setPhase('paused')
    } else if (phase === 'paused') {
      if (mode === 'rush') deadlineRef.current = performance.now() + remainingMs
      setPhase('playing')
    }
  }, [mode, phase, remainingMs])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTION[event.code]
      if (direction) {
        event.preventDefault()
        setDirection(direction)
        return
      }
      if (event.code === 'Space' || event.code === 'Escape') {
        event.preventDefault()
        togglePause()
      } else if (event.code === 'KeyR') {
        event.preventDefault()
        newGame()
      } else if (event.code === 'Enter' && phase !== 'playing') {
        event.preventDefault()
        start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newGame, phase, setDirection, start, togglePause])

  useEffect(() => {
    if (phase !== 'playing') return
    const timer = window.setTimeout(() => {
      setGame((previous) => {
        const next = stepSnake(previous, queuedDirectionRef.current, mode)
        if (next.dead || next.won) {
          saveBest(next.score)
          setPhase('over')
        }
        return next
      })
    }, tickDelay(difficulty, mode, game.apples))
    return () => window.clearTimeout(timer)
  }, [difficulty, game, mode, phase, saveBest])

  useEffect(() => {
    if (phase !== 'playing' || mode !== 'rush') return
    const timer = window.setInterval(() => {
      const next = Math.max(0, deadlineRef.current - performance.now())
      setRemainingMs(next)
      if (next <= 0) {
        setPhase('over')
        setGame((current) => {
          saveBest(current.score)
          return current
        })
      }
    }, 80)
    return () => window.clearInterval(timer)
  }, [mode, phase, saveBest])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')!
    const size = canvas.width / SNAKE_SIZE
    const computed = getComputedStyle(document.documentElement)
    const accent1 = computed.getPropertyValue('--accent-1').trim() || '#8b5cf6'
    const accent2 = computed.getPropertyValue('--accent-2').trim() || '#34e89e'
    const grid = computed.getPropertyValue('--board-grid').trim() || 'rgba(255,255,255,0.08)'
    const empty = computed.getPropertyValue('--board-cell-empty').trim() || '#13131a'

    context.fillStyle = empty
    context.fillRect(0, 0, canvas.width, canvas.height)

    context.strokeStyle = grid
    context.globalAlpha = 0.34
    context.lineWidth = 1
    context.beginPath()
    for (let i = 1; i < SNAKE_SIZE; i++) {
      context.moveTo(i * size, 0)
      context.lineTo(i * size, canvas.height)
      context.moveTo(0, i * size)
      context.lineTo(canvas.width, i * size)
    }
    context.stroke()
    context.globalAlpha = 1

    for (const obstacle of game.obstacles) {
      const pad = size * 0.08
      context.fillStyle = '#475569'
      context.fillRect(obstacle.x * size + pad, obstacle.y * size + pad, size - pad * 2, size - pad * 2)
      context.fillStyle = '#64748b'
      context.fillRect(obstacle.x * size + pad, obstacle.y * size + pad, size - pad * 2, size * 0.18)
    }

    game.snake.forEach((part, index) => {
      const pad = Math.max(1, size * 0.07)
      context.fillStyle = index === 0 ? accent2 : accent1
      context.fillRect(part.x * size + pad, part.y * size + pad, size - pad * 2, size - pad * 2)
      if (index === 0) {
        context.fillStyle = '#fff'
        const eye = Math.max(1.5, size * 0.09)
        context.fillRect(part.x * size + size * 0.26, part.y * size + size * 0.26, eye, eye)
        context.fillRect(part.x * size + size * 0.63, part.y * size + size * 0.26, eye, eye)
      }
    })

    if (game.food) {
      const centerX = (game.food.x + 0.5) * size
      const centerY = (game.food.y + 0.5) * size
      context.fillStyle = game.food.kind === 'bonus' ? '#facc15' : '#ef4444'
      context.beginPath()
      context.arc(centerX, centerY, size * 0.33, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = game.food.kind === 'bonus' ? '#fff3a3' : '#ff9b9b'
      context.beginPath()
      context.arc(centerX - size * 0.1, centerY - size * 0.1, size * 0.08, 0, Math.PI * 2)
      context.fill()
    }
  }, [game])

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0]
    touchRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const onTouchEnd = (event: TouchEvent) => {
    const startPoint = touchRef.current
    if (!startPoint) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - startPoint.x
    const dy = touch.clientY - startPoint.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return
    setDirection(Math.abs(dx) > Math.abs(dy)
      ? dx > 0 ? 'right' : 'left'
      : dy > 0 ? 'down' : 'up')
    touchRef.current = null
  }

  const endTitle = game.won
    ? 'board cleared!'
    : mode === 'rush' && remainingMs <= 0
      ? 'time!'
      : 'game over'

  return (
    <main className="snake-container">
      <BackButton label="Exit" />

      <header className="snake-header">
        <div>
          <span className="snake-eyebrow">four ways to slither</span>
          <h1 className="snake-title">snake</h1>
        </div>
        <div className="snake-scores">
          <span><small>score</small>{game.score}</span>
          <span><small>best</small>{Math.max(game.score, currentBest)}</span>
          {mode === 'rush' && (
            <span className={remainingMs < 10_000 ? 'is-danger' : ''}>
              <small>time</small>{(remainingMs / 1000).toFixed(1)}
            </span>
          )}
        </div>
      </header>

      <div className="snake-mode-tabs" role="tablist" aria-label="Snake mode">
        {SNAKE_MODE_ORDER.map((entry) => (
          <button
            type="button"
            role="tab"
            aria-selected={mode === entry}
            className={mode === entry ? 'is-active' : ''}
            onClick={() => chooseMode(entry)}
            key={entry}
          >
            {SNAKE_MODES[entry].label}
          </button>
        ))}
      </div>

      <section className="snake-layout">
        <aside className="snake-panel">
          <span className="snake-panel-label">mode</span>
          <strong>{SNAKE_MODES[mode].label}</strong>
          <p>{SNAKE_MODES[mode].description}</p>
          <span className="snake-rule">{SNAKE_MODES[mode].rule}</span>
        </aside>

        <div className="snake-board-wrap">
          <canvas
            ref={canvasRef}
            width={720}
            height={720}
            className="snake-canvas"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          />

          {phase !== 'playing' && (
            <div className="snake-overlay">
              {phase === 'ready' && (
                <>
                  <span className="snake-overlay-kicker">{SNAKE_MODES[mode].label} · {SNAKE_DIFFICULTIES[difficulty].label}</span>
                  <strong>ready?</strong>
                  <span>use arrows, WASD, swipe, or the controls below</span>
                  <button type="button" className="snake-btn snake-btn-primary" onClick={start}>start</button>
                </>
              )}
              {phase === 'paused' && (
                <>
                  <span className="snake-overlay-kicker">taking a breath</span>
                  <strong>paused</strong>
                  <button type="button" className="snake-btn snake-btn-primary" onClick={togglePause}>resume</button>
                </>
              )}
              {phase === 'over' && (
                <>
                  <span className="snake-overlay-kicker">{SNAKE_MODES[mode].label}</span>
                  <strong>{endTitle}</strong>
                  <span>score {game.score} · best {Math.max(game.score, currentBest)}</span>
                  <button type="button" className="snake-btn snake-btn-primary" onClick={() => newGame()}>new run</button>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="snake-panel">
          <span className="snake-panel-label">speed</span>
          <div className="snake-difficulties">
            {SNAKE_DIFFICULTY_ORDER.map((entry) => (
              <button
                type="button"
                className={difficulty === entry ? 'is-active' : ''}
                onClick={() => chooseDifficulty(entry)}
                key={entry}
              >
                <strong>{SNAKE_DIFFICULTIES[entry].label}</strong>
                <span>{SNAKE_DIFFICULTIES[entry].description}</span>
              </button>
            ))}
          </div>
        </aside>
      </section>

      <div className="snake-dpad" aria-label="Touch controls">
        <button type="button" className="up" onClick={() => setDirection('up')}>▲</button>
        <button type="button" className="left" onClick={() => setDirection('left')}>◀</button>
        <button type="button" className="down" onClick={() => setDirection('down')}>▼</button>
        <button type="button" className="right" onClick={() => setDirection('right')}>▶</button>
      </div>

      <footer className="snake-footer">
        <button type="button" className="snake-btn" onClick={togglePause} disabled={phase === 'ready' || phase === 'over'}>
          {phase === 'paused' ? 'resume' : 'pause'}
        </button>
        <span>arrows / WASD / swipe · space pause · R restart</span>
        <button type="button" className="snake-btn" onClick={() => newGame()}>restart</button>
      </footer>
    </main>
  )
}

