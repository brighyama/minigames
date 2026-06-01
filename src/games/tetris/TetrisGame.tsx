import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fetchProfile } from '../../lib/profile'
import { useToast } from '../../lib/toast'
import { BackButton } from '../../components/BackButton'
import {
  clearLabel,
  clearLines,
  collides,
  createBoard,
  detectTSpin,
  hardDropPosition,
  HEIGHT,
  HIDDEN,
  isB2BClear,
  lockPiece,
  pieceCells,
  SevenBag,
  spawnPiece,
  tryMove,
  tryRotate,
  VISIBLE,
  WIDTH,
  type Board,
  type Piece,
  type PieceType,
} from './lib'
import { PIECE_COLORS, PIECE_HIGHLIGHTS, typeForId } from './palette'
import { TetrisSettings } from './TetrisSettings'
import {
  ACTION_ORDER,
  buildCodeMap,
  keyLabel,
  loadHandling,
  loadKeymap,
  saveHandling,
  saveKeymap,
  type Handling,
  type Keymap,
  type TetrisAction,
} from './settings'
import './styles.css'

// ---- Fixed timing constants (the "feel"). All in milliseconds. -------------
// DAS / ARR / SDF are player-tunable — see settings.ts — and read live from a
// ref each frame, so they are NOT constants here.
const GRAVITY_MS = 800 // time to fall one cell under natural gravity
const LOCK_DELAY_MS = 500 // grounded grace before a piece locks
const MAX_LOCK_RESETS = 15 // cap on move/rotate lock-delay resets ("infinity"-lite)
const NEXT_COUNT = 5 // pieces shown in the next queue
const SPRINT_LINES = 40 // Sprint goal
const COUNTDOWN_MS = 3000

type Status = 'countdown' | 'playing' | 'done' | 'topout'

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string }

type GameState = {
  board: Board
  bag: SevenBag
  current: Piece
  hold: PieceType | null
  canHold: boolean
  next: PieceType[]
  gravityAcc: number
  lockTimer: number
  lockResets: number
  grounded: boolean
  lastWasRotation: boolean
  lastKick: number
  // input
  dasDir: -1 | 0 | 1
  dasTimer: number
  dasCharged: boolean
  softDrop: boolean
  // stats
  lines: number
  pieces: number
  combo: number
  b2b: number
  elapsedMs: number
  particles: Particle[]
}

function makeGame(): GameState {
  const bag = new SevenBag()
  const current = spawnPiece(bag.next())
  return {
    board: createBoard(),
    bag,
    current,
    hold: null,
    canHold: true,
    next: bag.peek(NEXT_COUNT),
    gravityAcc: 0,
    lockTimer: 0,
    lockResets: 0,
    grounded: false,
    lastWasRotation: false,
    lastKick: 0,
    dasDir: 0,
    dasTimer: 0,
    dasCharged: false,
    softDrop: false,
    lines: 0,
    pieces: 0,
    combo: 0,
    b2b: 0,
    elapsedMs: 0,
    particles: [],
  }
}

function formatTime(ms: number): string {
  const total = ms / 1000
  const m = Math.floor(total / 60)
  const s = total - m * 60
  if (m > 0) return `${m}:${s.toFixed(2).padStart(5, '0')}`
  return s.toFixed(2)
}

export function TetrisGame() {
  const { user } = useAuth()
  const toast = useToast()

  const [phase, setPhase] = useState<Status>('countdown')
  const [finalMs, setFinalMs] = useState(0)
  const [best, setBest] = useState<number | null>(null)
  const [isPb, setIsPb] = useState(false)

  // Player-tunable handling + keybinds. State drives the settings UI; refs are
  // what the rAF loop / input handler read live (so changes apply mid-run
  // without rebuilding the loop). Persisted to localStorage.
  const [handling, setHandling] = useState<Handling>(() => loadHandling())
  const [keymap, setKeymap] = useState<Keymap>(() => loadKeymap())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const handlingRef = useRef(handling)
  const codeMapRef = useRef(buildCodeMap(keymap))
  const settingsOpenRef = useRef(false)
  // The loop populates this with the unified input dispatcher so the on-screen
  // touch controls (and any other UI) can drive the game.
  const actionsRef = useRef<((action: TetrisAction, down: boolean) => void) | null>(null)
  // Holds the latest `restart` callback so the in-loop input handler can fire it
  // from any phase (the restart keybind works during play, done, or top-out).
  const restartRef = useRef<(() => void) | null>(null)

  const updateHandling = useCallback((patch: Partial<Handling>) => {
    setHandling((prev) => {
      const next = { ...prev, ...patch }
      handlingRef.current = next
      saveHandling(next)
      return next
    })
  }, [])

  const updateKeymap = useCallback((next: Keymap) => {
    codeMapRef.current = buildCodeMap(next)
    saveKeymap(next)
    setKeymap(next)
  }, [])

  // Opening the settings modal pauses the run (the loop reads this ref).
  useEffect(() => {
    settingsOpenRef.current = settingsOpen
  }, [settingsOpen])

  // All live game state is mutable (refs) so the rAF loop and React handlers
  // share it without forcing a re-render every frame — the canvas is painted
  // imperatively and the HUD text is written straight to the DOM.
  const gameRef = useRef<GameState>(makeGame())
  const statusRef = useRef<Status>('countdown')
  const countdownRef = useRef(COUNTDOWN_MS)
  const submittedRef = useRef(false)
  const userIdRef = useRef<string | undefined>(user?.id)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const holdCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const nextCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const timeElRef = useRef<HTMLDivElement | null>(null)
  const linesElRef = useRef<HTMLDivElement | null>(null)
  const ppsElRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const flashElRef = useRef<HTMLDivElement | null>(null)
  const countdownElRef = useRef<HTMLDivElement | null>(null)
  const accentRef = useRef<{ a1: string; a2: string }>({ a1: '#8b5cf6', a2: '#34e89e' })

  useEffect(() => {
    userIdRef.current = user?.id
  }, [user])

  // Load the player's best Sprint time to display.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchProfile(user.id).then((p) => {
      if (!cancelled && p) setBest((p.tetris_sprint_ms ?? 0) || null)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const setStatus = useCallback((s: Status) => {
    statusRef.current = s
    setPhase(s)
  }, [])

  // Submit a completed 40-line sprint once. Only finished runs count; abandoning
  // a partial sprint records nothing. Mirrors the one-submit guard from 2048.
  const submitRun = useCallback(
    (ms: number) => {
      if (submittedRef.current) return
      submittedRef.current = true
      if (!userIdRef.current || !supabase) return
      void supabase
        .rpc('submit_tetris_result', { time_ms: Math.round(ms), lines: SPRINT_LINES })
        .then((res) => {
          if (res.error) {
            console.error('[tetris] submit_tetris_result failed:', res.error)
            return
          }
          const row = Array.isArray(res.data) ? res.data[0] : res.data
          if (row?.best != null) {
            setBest(row.best || null)
            setIsPb(Math.round(ms) <= row.best)
          }
          if (row?.reward) {
            toast.show(`+${row.reward} points`, { tone: 'success' })
            window.dispatchEvent(new CustomEvent('points-changed'))
          }
        })
    },
    [toast],
  )

  // ---- The game loop + input. Set up once; reads/writes the refs above. -----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // Snapshot the active theme's accent colors for the canvas (particles/glow).
    const cs = getComputedStyle(document.documentElement)
    accentRef.current = {
      a1: cs.getPropertyValue('--accent-1').trim() || '#8b5cf6',
      a2: cs.getPropertyValue('--accent-2').trim() || '#34e89e',
    }

    // Size the canvas backing store to its CSS box for crisp rendering.
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const cellSize = () => canvas.width / WIDTH

    // ---- Juice helpers -----------------------------------------------------
    const showFlash = (text: string) => {
      const el = flashElRef.current
      if (!el || !text) return
      el.textContent = text
      el.classList.remove('is-on')
      // Force reflow so the animation restarts even on back-to-back clears.
      void el.offsetWidth
      el.classList.add('is-on')
    }
    const shake = () => {
      const el = stageRef.current
      if (!el) return
      el.classList.remove('is-shaking')
      void el.offsetWidth
      el.classList.add('is-shaking')
    }
    const spawnParticles = (rows: number[]) => {
      const g = gameRef.current
      const { a1, a2 } = accentRef.current
      for (const row of rows) {
        for (let x = 0; x < WIDTH; x++) {
          g.particles.push({
            x: x + 0.5,
            y: row - HIDDEN + 0.5,
            vx: (Math.random() - 0.5) * 0.18,
            vy: (Math.random() - 0.7) * 0.22,
            life: 1,
            color: Math.random() < 0.5 ? a1 : a2,
          })
        }
      }
      if (g.particles.length > 600) g.particles.splice(0, g.particles.length - 600)
    }

    // ---- Movement / rotation (player actions reset lock delay) --------------
    const grounded = (p: Piece) => tryMove(gameRef.current.board, p, 0, 1) === null

    const onGroundedReset = () => {
      const g = gameRef.current
      if (grounded(g.current)) {
        g.grounded = true
        if (g.lockResets < MAX_LOCK_RESETS) {
          g.lockTimer = 0
          g.lockResets++
        }
      } else {
        g.grounded = false
        g.lockTimer = 0
      }
    }

    const move = (dx: number): boolean => {
      const g = gameRef.current
      const next = tryMove(g.board, g.current, dx, 0)
      if (!next) return false
      g.current = next
      g.lastWasRotation = false // horizontal movement clears the T-spin flag
      onGroundedReset()
      return true
    }

    const rotate = (dir: 1 | -1 | 2) => {
      const g = gameRef.current
      const res = tryRotate(g.board, g.current, dir)
      if (!res) return
      g.current = res.piece
      g.lastWasRotation = true
      g.lastKick = res.kick
      onGroundedReset()
    }

    const lockAndSpawn = () => {
      const g = gameRef.current
      const tspin = detectTSpin(g.board, g.current, g.lastWasRotation, g.lastKick)
      // Lock-out: a piece that locks entirely in the hidden buffer = top out.
      const allHidden = pieceCells(g.current).every(([, y]) => y < HIDDEN)
      lockPiece(g.board, g.current)
      const cleared = clearLines(g.board)
      const n = cleared.length
      const perfect = n > 0 && g.board.every((v) => v === 0)

      if (n > 0) {
        g.combo++
        if (isB2BClear(n, tspin)) g.b2b++
        else g.b2b = 0
        g.lines += n
        spawnParticles(cleared)
        const label = clearLabel(n, tspin, perfect)
        const b2bTag = g.b2b > 1 ? `b2b ` : ''
        const comboTag = g.combo > 1 ? `\n${g.combo} combo` : ''
        showFlash(`${b2bTag}${label}${comboTag}`)
        if (n === 4 || tspin === 'full' || perfect) shake()
      } else {
        g.combo = 0
      }

      g.pieces++

      if (g.lines >= SPRINT_LINES) {
        finish()
        return
      }
      if (allHidden) {
        topOut()
        return
      }

      // Spawn the next piece; immediate collision = block-out top out.
      const type = g.bag.next()
      const spawned = spawnPiece(type)
      g.next = g.bag.peek(NEXT_COUNT)
      if (collides(g.board, spawned)) {
        g.current = spawned
        topOut()
        return
      }
      g.current = spawned
      g.canHold = true
      g.lockTimer = 0
      g.lockResets = 0
      g.grounded = false
      g.lastWasRotation = false
      g.lastKick = 0
      g.gravityAcc = 0
    }

    const hardDrop = () => {
      const g = gameRef.current
      g.current = hardDropPosition(g.board, g.current)
      // Hard drop does not clear the rotation flag, so T-spins still register.
      lockAndSpawn()
    }

    const hold = () => {
      const g = gameRef.current
      if (!g.canHold) return
      const cur = g.current.type
      if (g.hold == null) {
        g.hold = cur
        const type = g.bag.next()
        g.current = spawnPiece(type)
        g.next = g.bag.peek(NEXT_COUNT)
      } else {
        const swap = g.hold
        g.hold = cur
        g.current = spawnPiece(swap)
      }
      g.canHold = false
      g.lockTimer = 0
      g.lockResets = 0
      g.grounded = false
      g.lastWasRotation = false
      g.gravityAcc = 0
    }

    const finish = () => {
      const g = gameRef.current
      setFinalMs(g.elapsedMs)
      setStatus('done')
      submitRun(g.elapsedMs)
    }
    const topOut = () => {
      setStatus('topout')
    }

    // ---- Input -------------------------------------------------------------
    // Single dispatcher for every input source (keyboard + on-screen touch
    // buttons). `down` is the press/release edge — only the held actions (move,
    // soft drop) care about release.
    const applyAction = (action: TetrisAction, down: boolean) => {
      // Restart works in any phase (playing / done / top-out / countdown), so it
      // bypasses the "must be playing" gate below.
      if (action === 'restart') {
        if (down && !settingsOpenRef.current) restartRef.current?.()
        return
      }
      if (statusRef.current !== 'playing' || settingsOpenRef.current) return
      const g = gameRef.current
      if (down) {
        switch (action) {
          case 'moveLeft':
            g.dasDir = -1
            g.dasTimer = 0
            g.dasCharged = false
            move(-1)
            break
          case 'moveRight':
            g.dasDir = 1
            g.dasTimer = 0
            g.dasCharged = false
            move(1)
            break
          case 'softDrop':
            g.softDrop = true
            break
          case 'rotateCW':
            rotate(1)
            break
          case 'rotateCCW':
            rotate(-1)
            break
          case 'rotate180':
            rotate(2)
            break
          case 'hardDrop':
            hardDrop()
            break
          case 'hold':
            hold()
            break
        }
      } else {
        if (action === 'moveLeft' && g.dasDir === -1) g.dasDir = 0
        else if (action === 'moveRight' && g.dasDir === 1) g.dasDir = 0
        else if (action === 'softDrop') g.softDrop = false
      }
    }
    actionsRef.current = applyAction

    const onKeyDown = (e: KeyboardEvent) => {
      if (settingsOpenRef.current) return
      const action = codeMapRef.current.get(e.code)
      if (!action) return
      e.preventDefault() // stop page scroll / browser shortcuts for bound keys
      if (e.repeat) return // we manage auto-repeat ourselves (DAS/ARR)
      applyAction(action, true)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const action = codeMapRef.current.get(e.code)
      if (action) applyAction(action, false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // ---- Per-frame update --------------------------------------------------
    const update = (dt: number) => {
      const g = gameRef.current

      const { das, arr, sdf } = handlingRef.current

      // Auto-shift (DAS -> ARR).
      if (g.dasDir !== 0) {
        if (!g.dasCharged) {
          g.dasTimer += dt
          if (g.dasTimer >= das) {
            g.dasCharged = true
            g.dasTimer = 0
            if (arr <= 0) while (move(g.dasDir)) { /* slam to wall */ }
          }
        } else if (arr <= 0) {
          while (move(g.dasDir)) { /* hold against wall */ }
        } else {
          g.dasTimer += dt
          while (g.dasTimer >= arr) {
            g.dasTimer -= arr
            if (!move(g.dasDir)) break
          }
        }
      }

      // Gravity (soft drop shortens the interval; sdf === 0 = instant sonic drop).
      if (g.softDrop && sdf <= 0) {
        g.current = hardDropPosition(g.board, g.current) // drop to floor, no lock
        g.gravityAcc = 0
      } else {
        const interval = g.softDrop ? sdf : GRAVITY_MS
        g.gravityAcc += dt
        while (g.gravityAcc >= interval) {
          g.gravityAcc -= interval
          const next = tryMove(g.board, g.current, 0, 1)
          if (next) {
            g.current = next
          } else {
            g.gravityAcc = 0
            break
          }
        }
      }

      // Lock delay.
      if (grounded(g.current)) {
        g.grounded = true
        g.lockTimer += dt
        if (g.lockTimer >= LOCK_DELAY_MS) {
          lockAndSpawn()
          return
        }
      } else {
        g.grounded = false
        g.lockTimer = 0
      }
    }

    const updateParticles = (dt: number) => {
      const g = gameRef.current
      const f = dt / 16.67
      for (const p of g.particles) {
        p.x += p.vx * f
        p.y += p.vy * f
        p.vy += 0.02 * f // gravity
        p.life -= 0.022 * f
      }
      g.particles = g.particles.filter((p) => p.life > 0)
    }

    // ---- Rendering ---------------------------------------------------------
    const drawCell = (
      c: CanvasRenderingContext2D,
      px: number,
      py: number,
      size: number,
      type: PieceType,
      alpha = 1,
    ) => {
      const x = px * size
      const y = py * size
      const pad = Math.max(1, size * 0.04)
      c.globalAlpha = alpha
      c.fillStyle = PIECE_COLORS[type]
      c.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2)
      // top/left bevel highlight
      c.fillStyle = PIECE_HIGHLIGHTS[type]
      c.globalAlpha = alpha * 0.9
      c.fillRect(x + pad, y + pad, size - pad * 2, Math.max(2, size * 0.16))
      c.globalAlpha = 1
    }

    const render = () => {
      const g = gameRef.current
      const size = cellSize()
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      // Subtle grid.
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 1; x < WIDTH; x++) {
        ctx.moveTo(x * size, 0)
        ctx.lineTo(x * size, h)
      }
      for (let y = 1; y < VISIBLE; y++) {
        ctx.moveTo(0, y * size)
        ctx.lineTo(w, y * size)
      }
      ctx.stroke()

      // Locked cells (only the visible region).
      for (let y = HIDDEN; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const v = g.board[y * WIDTH + x]
          if (v === 0) continue
          const t = typeForId(v)
          if (t) drawCell(ctx, x, y - HIDDEN, size, t)
        }
      }

      if (statusRef.current === 'playing' || statusRef.current === 'countdown') {
        // Ghost piece.
        const ghost = hardDropPosition(g.board, g.current)
        for (const [x, y] of pieceCells(ghost)) {
          if (y >= HIDDEN) drawCell(ctx, x, y - HIDDEN, size, g.current.type, 0.22)
        }
        // Active piece.
        for (const [x, y] of pieceCells(g.current)) {
          if (y >= HIDDEN) drawCell(ctx, x, y - HIDDEN, size, g.current.type)
        }
      }

      // Particles.
      for (const p of g.particles) {
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.fillStyle = p.color
        const s = size * 0.28
        ctx.fillRect(p.x * size - s / 2, p.y * size - s / 2, s, s)
      }
      ctx.globalAlpha = 1
    }

    // Mini previews for hold + next queue (centered spawn-orientation shape).
    const renderMini = (cv: HTMLCanvasElement | null, type: PieceType | null) => {
      if (!cv) return
      const c = cv.getContext('2d')!
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = cv.getBoundingClientRect()
      if (rect.width === 0) return
      if (cv.width !== Math.round(rect.width * dpr)) {
        cv.width = Math.round(rect.width * dpr)
        cv.height = Math.round(rect.height * dpr)
      }
      c.clearRect(0, 0, cv.width, cv.height)
      if (!type) return
      const cells = pieceCells(spawnPiece(type)).map(([x, y]) => [x - 3, y - (HIDDEN - 2)])
      const minX = Math.min(...cells.map((p) => p[0]))
      const maxX = Math.max(...cells.map((p) => p[0]))
      const minY = Math.min(...cells.map((p) => p[1]))
      const maxY = Math.max(...cells.map((p) => p[1]))
      const pw = maxX - minX + 1
      const ph = maxY - minY + 1
      const size = Math.min(cv.width / (pw + 0.6), cv.height / (ph + 0.6))
      const offX = (cv.width - pw * size) / 2 - minX * size
      const offY = (cv.height - ph * size) / 2 - minY * size
      for (const [x, y] of cells) {
        const px = offX + x * size
        const py = offY + y * size
        const pad = Math.max(1, size * 0.05)
        c.fillStyle = PIECE_COLORS[type]
        c.fillRect(px + pad, py + pad, size - pad * 2, size - pad * 2)
        c.fillStyle = PIECE_HIGHLIGHTS[type]
        c.fillRect(px + pad, py + pad, size - pad * 2, Math.max(2, size * 0.16))
      }
    }

    let lastMiniSig = ''
    const renderHud = () => {
      const g = gameRef.current
      if (timeElRef.current) timeElRef.current.textContent = formatTime(g.elapsedMs)
      if (linesElRef.current) {
        linesElRef.current.textContent = String(Math.max(0, SPRINT_LINES - g.lines))
      }
      if (ppsElRef.current) {
        const secs = g.elapsedMs / 1000
        ppsElRef.current.textContent = secs > 0 ? (g.pieces / secs).toFixed(2) : '0.00'
      }
      // Only repaint hold/next when the queue actually changes.
      const sig = `${g.hold ?? '-'}|${g.next.join('')}`
      if (sig !== lastMiniSig) {
        lastMiniSig = sig
        renderMini(holdCanvasRef.current, g.hold)
        for (let i = 0; i < NEXT_COUNT; i++) renderMini(nextCanvasRefs.current[i], g.next[i] ?? null)
      }
    }

    // ---- Main rAF loop -----------------------------------------------------
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      let dt = now - last
      last = now
      if (dt > 100) dt = 100 // clamp after tab-out
      if (settingsOpenRef.current) dt = 0 // settings modal open = paused

      const status = statusRef.current
      if (status === 'countdown') {
        countdownRef.current -= dt
        if (countdownElRef.current) {
          countdownElRef.current.textContent = String(Math.max(1, Math.ceil(countdownRef.current / 1000)))
        }
        if (countdownRef.current <= 0) setStatus('playing')
      } else if (status === 'playing') {
        // Accumulate from the clamped dt (not wall-clock) so tabbing out mid-run
        // pauses the timer instead of penalizing the player for idle time.
        gameRef.current.elapsedMs += dt
        update(dt)
      }
      updateParticles(dt)
      render()
      renderHud()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      actionsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStatus, submitRun])

  const restart = useCallback(() => {
    gameRef.current = makeGame()
    countdownRef.current = COUNTDOWN_MS
    submittedRef.current = false
    setFinalMs(0)
    setIsPb(false)
    setStatus('countdown')
  }, [setStatus])

  // Expose the latest restart callback to the in-loop input handler (restart key).
  useEffect(() => {
    restartRef.current = restart
  }, [restart])

  return (
    <main className="tetris-container">
      <BackButton label="Exit" />

      <div className="tetris-header">
        <h1 className="tetris-title">tetris</h1>
        <span className="tetris-mode">sprint · 40 lines</span>
        <button
          className="tetris-gear"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title="Settings (handling & controls)"
        >
          ⚙
        </button>
      </div>

      <div className="tetris-stage" ref={stageRef}>
        <div className="tetris-side">
          <div className="tetris-box">
            <span className="tetris-box-label">hold</span>
            <canvas
              ref={holdCanvasRef}
              className="tetris-mini"
              style={{ aspectRatio: '4 / 2' }}
            />
          </div>
          <div className="tetris-box tetris-stat">
            <span className="tetris-box-label">lines left</span>
            <div className="tetris-stat-value is-big" ref={linesElRef}>40</div>
          </div>
          <div className="tetris-box tetris-stat">
            <span className="tetris-box-label">pps</span>
            <div className="tetris-stat-value" ref={ppsElRef}>0.00</div>
          </div>
        </div>

        <div className="tetris-well">
          <canvas ref={canvasRef} className="tetris-canvas" />
          <div className="tetris-flash" ref={flashElRef} aria-hidden="true" />

          {phase === 'countdown' && (
            <div className="tetris-overlay">
              <div className="tetris-countdown" ref={countdownElRef}>3</div>
              <div className="tetris-overlay-sub">clear 40 lines as fast as you can</div>
            </div>
          )}
          {phase === 'done' && (
            <div className="tetris-overlay">
              <div className="tetris-overlay-title">{isPb ? 'new best!' : 'complete'}</div>
              <div className="tetris-overlay-time">{formatTime(finalMs)}</div>
              <div className="tetris-overlay-sub">40 lines cleared</div>
              <div className="tetris-overlay-actions">
                <button className="tetris-btn tetris-btn-primary" onClick={restart}>
                  play again
                </button>
              </div>
            </div>
          )}
          {phase === 'topout' && (
            <div className="tetris-overlay">
              <div className="tetris-overlay-title">topped out</div>
              <div className="tetris-overlay-sub">the stack reached the top</div>
              <div className="tetris-overlay-actions">
                <button className="tetris-btn tetris-btn-primary" onClick={restart}>
                  try again
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="tetris-side tetris-side-right">
          <div className="tetris-box tetris-stat">
            <span className="tetris-box-label">time</span>
            <div className="tetris-stat-value is-big" ref={timeElRef}>0.00</div>
          </div>
          <div className="tetris-box">
            <span className="tetris-box-label">next</span>
            <div className="tetris-next-list">
              {Array.from({ length: NEXT_COUNT }).map((_, i) => (
                <canvas
                  key={i}
                  ref={(el) => {
                    nextCanvasRefs.current[i] = el
                  }}
                  className="tetris-mini"
                  style={{ aspectRatio: '4 / 2' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* On-screen controls for touch devices (hidden on pointer-fine screens). */}
      <div className="tetris-touch" aria-hidden="true">
        <div className="tetris-touch-group">
          <TouchButton action="rotateCCW" actionsRef={actionsRef} className="is-rotate">↺</TouchButton>
          <TouchButton action="rotateCW" actionsRef={actionsRef} className="is-rotate">↻</TouchButton>
          <TouchButton action="hold" actionsRef={actionsRef}>hold</TouchButton>
        </div>
        <div className="tetris-touch-group">
          <TouchButton action="moveLeft" actionsRef={actionsRef}>◀</TouchButton>
          <TouchButton action="softDrop" actionsRef={actionsRef}>▼</TouchButton>
          <TouchButton action="moveRight" actionsRef={actionsRef}>▶</TouchButton>
          <TouchButton action="hardDrop" actionsRef={actionsRef} className="is-harddrop">⤓</TouchButton>
        </div>
      </div>

      <div className="tetris-help">
        {ACTION_ORDER.map((action) => (
          <span key={action}>
            {keymap[action].length > 0 ? (
              keymap[action].map((code, i) => <kbd key={i}>{keyLabel(code)}</kbd>)
            ) : (
              <kbd className="is-unbound">—</kbd>
            )}{' '}
            {HELP_LABELS[action]}
          </span>
        ))}
      </div>

      <div className="tetris-note">
        {best != null ? (
          <>your best sprint: <strong>{formatTime(best)}</strong>. </>
        ) : null}
        {!user && <>sign in to save your time to the leaderboard</>}
      </div>

      {settingsOpen && (
        <TetrisSettings
          handling={handling}
          keymap={keymap}
          onChangeHandling={updateHandling}
          onChangeKeymap={updateKeymap}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  )
}

// Short labels for the dynamic help strip (mirrors keymap actions).
const HELP_LABELS: Record<TetrisAction, string> = {
  moveLeft: 'left',
  moveRight: 'right',
  softDrop: 'soft drop',
  hardDrop: 'hard drop',
  rotateCW: 'rotate',
  rotateCCW: 'rotate ccw',
  rotate180: '180',
  hold: 'hold',
  restart: 'restart',
}

// A single on-screen control. Routes press/release through the loop's action
// dispatcher so touch input behaves exactly like the keyboard (DAS, etc.).
function TouchButton({
  action,
  actionsRef,
  className,
  children,
}: {
  action: TetrisAction
  actionsRef: RefObject<((action: TetrisAction, down: boolean) => void) | null>
  className?: string
  children: ReactNode
}) {
  return (
    <button
      className={`tetris-touch-btn${className ? ' ' + className : ''}`}
      onPointerDown={(e) => {
        e.preventDefault()
        actionsRef.current?.(action, true)
      }}
      onPointerUp={(e) => {
        e.preventDefault()
        actionsRef.current?.(action, false)
      }}
      onPointerLeave={() => actionsRef.current?.(action, false)}
      onPointerCancel={() => actionsRef.current?.(action, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  )
}
