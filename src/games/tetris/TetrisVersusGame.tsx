import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Link } from 'react-router-dom'
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
import { TetrisSettings } from './TetrisSettings'
import {
  addGarbage,
  attackForClear,
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_ORDER,
  chooseBotPlacement,
  GARBAGE_ID,
  isBotDifficulty,
  type BotDifficulty,
} from './versus'
import './styles.css'

const GRAVITY_MS = 800
const LOCK_DELAY_MS = 500
const MAX_LOCK_RESETS = 15
const NEXT_COUNT = 5
const COUNTDOWN_MS = 3000
const GARBAGE_DELAY_MS = 500
const GARBAGE_CAP_PER_LOCK = 8
const DIFFICULTY_KEY = 'minigames:tetris:versus-difficulty'

type Status = 'countdown' | 'playing' | 'won' | 'lost'
type SideId = 'player' | 'bot'
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string }
type GarbagePacket = { lines: number; hole: number; readyAt: number }

type BattleSide = {
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
  dasDir: -1 | 0 | 1
  dasTimer: number
  dasCharged: boolean
  softDrop: boolean
  lines: number
  pieces: number
  combo: number
  b2b: number
  sent: number
  incoming: GarbagePacket[]
  particles: Particle[]
}

type MatchState = {
  player: BattleSide
  bot: BattleSide
  elapsedMs: number
  botThinkMs: number
  botPending: boolean
  botCommitMs: number
}

function makeSide(): BattleSide {
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
    sent: 0,
    incoming: [],
    particles: [],
  }
}

function makeMatch(): MatchState {
  return {
    player: makeSide(),
    bot: makeSide(),
    elapsedMs: 0,
    botThinkMs: 0,
    botPending: false,
    botCommitMs: 0,
  }
}

function formatTime(ms: number): string {
  const total = ms / 1000
  const minutes = Math.floor(total / 60)
  const seconds = total - minutes * 60
  return minutes > 0 ? `${minutes}:${seconds.toFixed(2).padStart(5, '0')}` : seconds.toFixed(2)
}

function loadDifficulty(): BotDifficulty {
  try {
    const saved = localStorage.getItem(DIFFICULTY_KEY)
    return isBotDifficulty(saved) ? saved : 'steady'
  } catch {
    return 'steady'
  }
}

function saveDifficulty(difficulty: BotDifficulty): void {
  try {
    localStorage.setItem(DIFFICULTY_KEY, difficulty)
  } catch {
    // Storage is optional; the selected difficulty still applies this session.
  }
}

function queuedGarbage(side: BattleSide): number {
  return side.incoming.reduce((sum, packet) => sum + packet.lines, 0)
}

function cancelIncoming(side: BattleSide, amount: number): number {
  let remaining = amount
  while (remaining > 0 && side.incoming.length > 0) {
    const packet = side.incoming[0]
    const cancelled = Math.min(remaining, packet.lines)
    packet.lines -= cancelled
    remaining -= cancelled
    if (packet.lines <= 0) side.incoming.shift()
  }
  return remaining
}

export function TetrisVersusGame() {
  const [phase, setPhase] = useState<Status>('countdown')
  const [difficulty, setDifficulty] = useState<BotDifficulty>(() => loadDifficulty())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [handling, setHandling] = useState<Handling>(() => loadHandling())
  const [keymap, setKeymap] = useState<Keymap>(() => loadKeymap())

  const handlingRef = useRef(handling)
  const difficultyRef = useRef(difficulty)
  const codeMapRef = useRef(buildCodeMap(keymap))
  const settingsOpenRef = useRef(false)
  const statusRef = useRef<Status>('countdown')
  const countdownRef = useRef(COUNTDOWN_MS)
  const matchRef = useRef<MatchState>(makeMatch())
  const restartRef = useRef<(() => void) | null>(null)
  const actionsRef = useRef<((action: TetrisAction, down: boolean) => void) | null>(null)

  const playerCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const botCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const playerHoldRef = useRef<HTMLCanvasElement | null>(null)
  const botHoldRef = useRef<HTMLCanvasElement | null>(null)
  const playerNextRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const botNextRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const playerPpsRef = useRef<HTMLDivElement | null>(null)
  const botPpsRef = useRef<HTMLDivElement | null>(null)
  const playerSentRef = useRef<HTMLDivElement | null>(null)
  const botSentRef = useRef<HTMLDivElement | null>(null)
  const playerGarbageRef = useRef<HTMLDivElement | null>(null)
  const botGarbageRef = useRef<HTMLDivElement | null>(null)
  const timeRef = useRef<HTMLDivElement | null>(null)
  const countdownElRef = useRef<HTMLDivElement | null>(null)
  const playerFlashRef = useRef<HTMLDivElement | null>(null)
  const botFlashRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const accentRef = useRef({ a1: '#8b5cf6', a2: '#34e89e', grid: '#34e89e', gridAlpha: 0.16 })

  const setStatus = useCallback((status: Status) => {
    statusRef.current = status
    setPhase(status)
  }, [])

  const restart = useCallback(() => {
    matchRef.current = makeMatch()
    countdownRef.current = COUNTDOWN_MS
    setStatus('countdown')
  }, [setStatus])

  useEffect(() => {
    restartRef.current = restart
  }, [restart])

  useEffect(() => {
    settingsOpenRef.current = settingsOpen
  }, [settingsOpen])

  const updateHandling = useCallback((patch: Partial<Handling>) => {
    setHandling((previous) => {
      const next = { ...previous, ...patch }
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

  const changeDifficulty = (next: BotDifficulty) => {
    difficultyRef.current = next
    setDifficulty(next)
    saveDifficulty(next)
    restart()
  }

  useEffect(() => {
    const playerCanvas = playerCanvasRef.current
    const botCanvas = botCanvasRef.current
    if (!playerCanvas || !botCanvas) return
    const playerCtx = playerCanvas.getContext('2d')!
    const botCtx = botCanvas.getContext('2d')!

    const styles = getComputedStyle(document.documentElement)
    accentRef.current = {
      a1: styles.getPropertyValue('--accent-1').trim() || '#8b5cf6',
      a2: styles.getPropertyValue('--accent-2').trim() || '#34e89e',
      grid: styles.getPropertyValue('--accent-2').trim() || '#34e89e',
      gridAlpha: Number(styles.getPropertyValue('--board-grid-alpha').trim()) || 0.16,
    }

    const resizeCanvas = (canvas: HTMLCanvasElement) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
    }
    const resize = () => {
      resizeCanvas(playerCanvas)
      resizeCanvas(botCanvas)
    }
    resize()
    window.addEventListener('resize', resize)

    const showFlash = (side: SideId, text: string) => {
      const element = side === 'player' ? playerFlashRef.current : botFlashRef.current
      if (!element || !text) return
      element.textContent = text
      element.classList.remove('is-on')
      void element.offsetWidth
      element.classList.add('is-on')
    }

    const shake = () => {
      const stage = stageRef.current
      if (!stage) return
      stage.classList.remove('is-shaking')
      void stage.offsetWidth
      stage.classList.add('is-shaking')
    }

    const spawnParticles = (side: BattleSide, rows: number[]) => {
      const { a1, a2 } = accentRef.current
      for (const row of rows) {
        for (let x = 0; x < WIDTH; x++) {
          side.particles.push({
            x: x + 0.5,
            y: row - HIDDEN + 0.5,
            vx: (Math.random() - 0.5) * 0.18,
            vy: (Math.random() - 0.7) * 0.22,
            life: 1,
            color: Math.random() < 0.5 ? a1 : a2,
          })
        }
      }
      if (side.particles.length > 400) side.particles.splice(0, side.particles.length - 400)
    }

    const finish = (loser: SideId) => {
      if (statusRef.current !== 'playing') return
      setStatus(loser === 'bot' ? 'won' : 'lost')
    }

    const sendAttack = (
      source: BattleSide,
      target: BattleSide,
      amount: number,
      now: number,
    ) => {
      const outgoing = cancelIncoming(source, amount)
      if (outgoing <= 0) return
      const hole = Math.floor(Math.random() * WIDTH)
      target.incoming.push({ lines: outgoing, hole, readyAt: now + GARBAGE_DELAY_MS })
      source.sent += outgoing
    }

    const applyReadyGarbage = (side: BattleSide, now: number): boolean => {
      let room = GARBAGE_CAP_PER_LOCK
      const holes: number[] = []
      while (room > 0 && side.incoming.length > 0) {
        const packet = side.incoming[0]
        if (packet.readyAt > now) break
        const count = Math.min(room, packet.lines)
        for (let i = 0; i < count; i++) holes.push(packet.hole)
        packet.lines -= count
        room -= count
        if (packet.lines <= 0) side.incoming.shift()
      }
      return addGarbage(side.board, holes)
    }

    const spawnNext = (side: BattleSide): boolean => {
      const type = side.bag.next()
      const spawned = spawnPiece(type)
      side.next = side.bag.peek(NEXT_COUNT)
      side.current = spawned
      side.canHold = true
      side.lockTimer = 0
      side.lockResets = 0
      side.grounded = false
      side.lastWasRotation = false
      side.lastKick = 0
      side.gravityAcc = 0
      return collides(side.board, spawned)
    }

    const lockSide = (id: SideId) => {
      if (statusRef.current !== 'playing') return
      const match = matchRef.current
      const side = id === 'player' ? match.player : match.bot
      const opponent = id === 'player' ? match.bot : match.player
      const tspin = id === 'player'
        ? detectTSpin(side.board, side.current, side.lastWasRotation, side.lastKick)
        : 'none'
      const allHidden = pieceCells(side.current).every(([, y]) => y < HIDDEN)
      lockPiece(side.board, side.current)
      const clearedRows = clearLines(side.board)
      const lines = clearedRows.length
      const perfect = lines > 0 && side.board.every((cell) => cell === 0)
      const wasB2B = side.b2b > 0

      if (lines > 0) {
        side.combo++
        const difficult = isB2BClear(lines, tspin)
        if (difficult) side.b2b++
        else side.b2b = 0
        side.lines += lines
        spawnParticles(side, clearedRows)
        const attack = attackForClear(lines, tspin, side.combo, wasB2B, perfect)
        sendAttack(side, opponent, attack, match.elapsedMs)
        const b2bTag = difficult && wasB2B ? 'b2b ' : ''
        const comboTag = side.combo > 1 ? `\n${side.combo} combo` : ''
        showFlash(id, `${b2bTag}${clearLabel(lines, tspin, perfect)}${comboTag}`)
        if (lines === 4 || tspin === 'full' || perfect) shake()
      } else {
        side.combo = 0
      }

      side.pieces++
      if (allHidden) {
        finish(id)
        return
      }
      if (lines === 0 && applyReadyGarbage(side, match.elapsedMs)) {
        finish(id)
        return
      }
      if (spawnNext(side)) finish(id)
    }

    const player = () => matchRef.current.player
    const isGrounded = (side: BattleSide, piece: Piece) => tryMove(side.board, piece, 0, 1) === null

    const onGroundedReset = () => {
      const side = player()
      if (isGrounded(side, side.current)) {
        side.grounded = true
        if (side.lockResets < MAX_LOCK_RESETS) {
          side.lockTimer = 0
          side.lockResets++
        }
      } else {
        side.grounded = false
        side.lockTimer = 0
      }
    }

    const move = (dx: number): boolean => {
      const side = player()
      const next = tryMove(side.board, side.current, dx, 0)
      if (!next) return false
      side.current = next
      side.lastWasRotation = false
      onGroundedReset()
      return true
    }

    const rotate = (direction: 1 | -1 | 2) => {
      const side = player()
      const result = tryRotate(side.board, side.current, direction)
      if (!result) return
      side.current = result.piece
      side.lastWasRotation = true
      side.lastKick = result.kick
      onGroundedReset()
    }

    const hardDrop = () => {
      const side = player()
      side.current = hardDropPosition(side.board, side.current)
      lockSide('player')
    }

    const hold = () => {
      const side = player()
      if (!side.canHold) return
      const currentType = side.current.type
      if (side.hold == null) {
        side.hold = currentType
        const type = side.bag.next()
        side.current = spawnPiece(type)
        side.next = side.bag.peek(NEXT_COUNT)
      } else {
        const held = side.hold
        side.hold = currentType
        side.current = spawnPiece(held)
      }
      side.canHold = false
      side.lockTimer = 0
      side.lockResets = 0
      side.grounded = false
      side.lastWasRotation = false
      side.gravityAcc = 0
      if (collides(side.board, side.current)) finish('player')
    }

    const applyAction = (action: TetrisAction, down: boolean) => {
      if (action === 'restart') {
        if (down && !settingsOpenRef.current) restartRef.current?.()
        return
      }
      if (statusRef.current !== 'playing' || settingsOpenRef.current) return
      const side = player()
      if (down) {
        switch (action) {
          case 'moveLeft':
            side.dasDir = -1
            side.dasTimer = 0
            side.dasCharged = false
            move(-1)
            break
          case 'moveRight':
            side.dasDir = 1
            side.dasTimer = 0
            side.dasCharged = false
            move(1)
            break
          case 'softDrop':
            side.softDrop = true
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
        if (action === 'moveLeft' && side.dasDir === -1) side.dasDir = 0
        else if (action === 'moveRight' && side.dasDir === 1) side.dasDir = 0
        else if (action === 'softDrop') side.softDrop = false
      }
    }
    actionsRef.current = applyAction

    const onKeyDown = (event: KeyboardEvent) => {
      if (settingsOpenRef.current) return
      const action = codeMapRef.current.get(event.code)
      if (!action) return
      event.preventDefault()
      if (!event.repeat) applyAction(action, true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const action = codeMapRef.current.get(event.code)
      if (action) applyAction(action, false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const updatePlayer = (dt: number) => {
      const side = player()
      const { das, arr, sdf } = handlingRef.current

      if (side.dasDir !== 0) {
        if (!side.dasCharged) {
          side.dasTimer += dt
          if (side.dasTimer >= das) {
            side.dasCharged = true
            side.dasTimer = 0
            if (arr <= 0) while (move(side.dasDir)) { /* move to wall */ }
          }
        } else if (arr <= 0) {
          while (move(side.dasDir)) { /* stay against wall */ }
        } else {
          side.dasTimer += dt
          while (side.dasTimer >= arr) {
            side.dasTimer -= arr
            if (!move(side.dasDir)) break
          }
        }
      }

      if (side.softDrop && sdf <= 0) {
        side.current = hardDropPosition(side.board, side.current)
        side.gravityAcc = 0
      } else {
        const interval = side.softDrop ? sdf : GRAVITY_MS
        side.gravityAcc += dt
        while (side.gravityAcc >= interval) {
          side.gravityAcc -= interval
          const next = tryMove(side.board, side.current, 0, 1)
          if (next) side.current = next
          else {
            side.gravityAcc = 0
            break
          }
        }
      }

      if (isGrounded(side, side.current)) {
        side.grounded = true
        side.lockTimer += dt
        if (side.lockTimer >= LOCK_DELAY_MS) lockSide('player')
      } else {
        side.grounded = false
        side.lockTimer = 0
      }
    }

    const updateBot = (dt: number) => {
      const match = matchRef.current
      const side = match.bot
      const config = BOT_DIFFICULTIES[difficultyRef.current]

      if (match.botPending) {
        match.botCommitMs -= dt
        if (match.botCommitMs <= 0) {
          match.botPending = false
          lockSide('bot')
        }
        return
      }

      match.botThinkMs += dt
      if (match.botThinkMs < config.moveMs) return
      match.botThinkMs -= config.moveMs
      const choice = chooseBotPlacement(
        side.board,
        side.current.type,
        side.hold,
        side.next[0],
        side.canHold,
        difficultyRef.current,
      )
      if (!choice) {
        finish('bot')
        return
      }

      if (choice.useHold) {
        const currentType = side.current.type
        if (side.hold == null) {
          side.hold = currentType
          const nextType = side.bag.next()
          side.current = spawnPiece(nextType)
          side.next = side.bag.peek(NEXT_COUNT)
        } else {
          const held = side.hold
          side.hold = currentType
          side.current = spawnPiece(held)
        }
        side.canHold = false
      }
      side.current = choice.placement.piece
      side.lastWasRotation = false
      side.lastKick = 0
      match.botPending = true
      match.botCommitMs = config.previewMs
    }

    const updateParticles = (dt: number) => {
      const frame = dt / 16.67
      for (const side of [matchRef.current.player, matchRef.current.bot]) {
        for (const particle of side.particles) {
          particle.x += particle.vx * frame
          particle.y += particle.vy * frame
          particle.vy += 0.02 * frame
          particle.life -= 0.022 * frame
        }
        side.particles = side.particles.filter((particle) => particle.life > 0)
      }
    }

    const drawPieceCell = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number,
      type: PieceType,
      alpha = 1,
    ) => {
      const pad = Math.max(1, size * 0.04)
      context.globalAlpha = alpha
      context.fillStyle = PIECE_COLORS[type]
      context.fillRect(x * size + pad, y * size + pad, size - pad * 2, size - pad * 2)
      context.fillStyle = PIECE_HIGHLIGHTS[type]
      context.globalAlpha = alpha * 0.9
      context.fillRect(x * size + pad, y * size + pad, size - pad * 2, Math.max(2, size * 0.16))
      context.globalAlpha = 1
    }

    const drawGarbageCell = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number,
    ) => {
      const pad = Math.max(1, size * 0.04)
      context.fillStyle = '#4b5563'
      context.fillRect(x * size + pad, y * size + pad, size - pad * 2, size - pad * 2)
      context.fillStyle = '#8b96a7'
      context.fillRect(x * size + pad, y * size + pad, size - pad * 2, Math.max(2, size * 0.14))
    }

    const renderBoard = (
      context: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      side: BattleSide,
      showActive: boolean,
    ) => {
      const size = canvas.width / WIDTH
      context.clearRect(0, 0, canvas.width, canvas.height)

      context.globalAlpha = accentRef.current.gridAlpha
      context.strokeStyle = accentRef.current.grid
      context.lineWidth = 1
      context.beginPath()
      for (let x = 1; x < WIDTH; x++) {
        context.moveTo(x * size, 0)
        context.lineTo(x * size, canvas.height)
      }
      for (let y = 1; y < VISIBLE; y++) {
        context.moveTo(0, y * size)
        context.lineTo(canvas.width, y * size)
      }
      context.stroke()
      context.globalAlpha = 1

      for (let y = HIDDEN; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const value = side.board[y * WIDTH + x]
          if (value === 0) continue
          if (value === GARBAGE_ID) drawGarbageCell(context, x, y - HIDDEN, size)
          else {
            const type = typeForId(value)
            if (type) drawPieceCell(context, x, y - HIDDEN, size, type)
          }
        }
      }

      if (showActive) {
        const ghost = hardDropPosition(side.board, side.current)
        for (const [x, y] of pieceCells(ghost)) {
          if (y >= HIDDEN) drawPieceCell(context, x, y - HIDDEN, size, side.current.type, 0.2)
        }
        for (const [x, y] of pieceCells(side.current)) {
          if (y >= HIDDEN) drawPieceCell(context, x, y - HIDDEN, size, side.current.type)
        }
      }

      for (const particle of side.particles) {
        context.globalAlpha = Math.max(0, particle.life)
        context.fillStyle = particle.color
        const particleSize = size * 0.28
        context.fillRect(
          particle.x * size - particleSize / 2,
          particle.y * size - particleSize / 2,
          particleSize,
          particleSize,
        )
      }
      context.globalAlpha = 1
    }

    const renderMini = (canvas: HTMLCanvasElement | null, type: PieceType | null) => {
      if (!canvas) return
      const context = canvas.getContext('2d')!
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0) return
      const width = Math.round(rect.width * dpr)
      const height = Math.round(rect.height * dpr)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      context.clearRect(0, 0, canvas.width, canvas.height)
      if (!type) return

      const cells = pieceCells(spawnPiece(type)).map(([x, y]) => [x - 3, y - (HIDDEN - 2)])
      const minX = Math.min(...cells.map(([x]) => x))
      const maxX = Math.max(...cells.map(([x]) => x))
      const minY = Math.min(...cells.map(([, y]) => y))
      const maxY = Math.max(...cells.map(([, y]) => y))
      const pieceWidth = maxX - minX + 1
      const pieceHeight = maxY - minY + 1
      const size = Math.min(canvas.width / (pieceWidth + 0.6), canvas.height / (pieceHeight + 0.6))
      const offsetX = (canvas.width - pieceWidth * size) / 2 - minX * size
      const offsetY = (canvas.height - pieceHeight * size) / 2 - minY * size
      for (const [x, y] of cells) {
        const pad = Math.max(1, size * 0.05)
        context.fillStyle = PIECE_COLORS[type]
        context.fillRect(offsetX + x * size + pad, offsetY + y * size + pad, size - pad * 2, size - pad * 2)
        context.fillStyle = PIECE_HIGHLIGHTS[type]
        context.fillRect(offsetX + x * size + pad, offsetY + y * size + pad, size - pad * 2, Math.max(2, size * 0.16))
      }
    }

    let lastMiniSignature = ''
    const renderHud = () => {
      const match = matchRef.current
      const seconds = match.elapsedMs / 1000
      if (timeRef.current) timeRef.current.textContent = formatTime(match.elapsedMs)
      if (playerPpsRef.current) {
        playerPpsRef.current.textContent = seconds > 0 ? (match.player.pieces / seconds).toFixed(2) : '0.00'
      }
      if (botPpsRef.current) {
        botPpsRef.current.textContent = seconds > 0 ? (match.bot.pieces / seconds).toFixed(2) : '0.00'
      }
      if (playerSentRef.current) playerSentRef.current.textContent = String(match.player.sent)
      if (botSentRef.current) botSentRef.current.textContent = String(match.bot.sent)
      if (playerGarbageRef.current) playerGarbageRef.current.textContent = String(queuedGarbage(match.player))
      if (botGarbageRef.current) botGarbageRef.current.textContent = String(queuedGarbage(match.bot))

      const signature = [
        match.player.hold ?? '-',
        match.player.next.join(''),
        match.bot.hold ?? '-',
        match.bot.next.join(''),
      ].join('|')
      if (signature !== lastMiniSignature) {
        lastMiniSignature = signature
        renderMini(playerHoldRef.current, match.player.hold)
        renderMini(botHoldRef.current, match.bot.hold)
        for (let i = 0; i < NEXT_COUNT; i++) {
          renderMini(playerNextRefs.current[i], match.player.next[i] ?? null)
          renderMini(botNextRefs.current[i], match.bot.next[i] ?? null)
        }
      }
    }

    let animationFrame = 0
    let lastTime = performance.now()
    const loop = (now: number) => {
      let dt = now - lastTime
      lastTime = now
      if (dt > 100) dt = 100
      if (settingsOpenRef.current) dt = 0

      if (statusRef.current === 'countdown') {
        countdownRef.current -= dt
        if (countdownElRef.current) {
          countdownElRef.current.textContent = String(Math.max(1, Math.ceil(countdownRef.current / 1000)))
        }
        if (countdownRef.current <= 0) setStatus('playing')
      } else if (statusRef.current === 'playing') {
        matchRef.current.elapsedMs += dt
        updatePlayer(dt)
        if (statusRef.current === 'playing') updateBot(dt)
      }

      updateParticles(dt)
      const showActive = statusRef.current === 'playing' || statusRef.current === 'countdown'
      renderBoard(playerCtx, playerCanvas, matchRef.current.player, showActive)
      renderBoard(botCtx, botCanvas, matchRef.current.bot, showActive)
      renderHud()
      animationFrame = requestAnimationFrame(loop)
    }
    animationFrame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      actionsRef.current = null
    }
  }, [setStatus])

  return (
    <main className="tetris-container tetris-versus-container">
      <BackButton label="Exit" />

      <div className="tetris-header tetris-versus-header">
        <h1 className="tetris-title">tetris</h1>
        <span className="tetris-mode">versus bot</span>
        <Link className="tetris-mode-link" to="/games/tetris">40L</Link>
        <label className="tetris-difficulty">
          <span>bot</span>
          <select
            value={difficulty}
            onChange={(event) => changeDifficulty(event.target.value as BotDifficulty)}
            aria-label="Bot difficulty"
          >
            {BOT_DIFFICULTY_ORDER.map((level) => (
              <option key={level} value={level}>{BOT_DIFFICULTIES[level].label}</option>
            ))}
          </select>
        </label>
        <button
          className="tetris-gear"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title="Settings (handling & controls)"
        >
          ⚙
        </button>
      </div>

      <div className="tetris-versus-stage" ref={stageRef}>
        <BattleField
          name="you"
          canvasRef={playerCanvasRef}
          holdRef={playerHoldRef}
          nextRefs={playerNextRefs}
          ppsRef={playerPpsRef}
          sentRef={playerSentRef}
          garbageRef={playerGarbageRef}
          flashRef={playerFlashRef}
        />

        <div className="tetris-versus-center" aria-label="Match status">
          <span className="tetris-versus-mark">vs</span>
          <span className="tetris-versus-time" ref={timeRef}>0.00</span>
          <span className="tetris-versus-rule">clear lines<br />send garbage</span>
        </div>

        <BattleField
          name={BOT_DIFFICULTIES[difficulty].label}
          isBot
          canvasRef={botCanvasRef}
          holdRef={botHoldRef}
          nextRefs={botNextRefs}
          ppsRef={botPpsRef}
          sentRef={botSentRef}
          garbageRef={botGarbageRef}
          flashRef={botFlashRef}
        />

        {phase === 'countdown' && (
          <div className="tetris-match-overlay">
            <div className="tetris-countdown" ref={countdownElRef}>3</div>
            <div className="tetris-overlay-sub">
              first top-out loses · {BOT_DIFFICULTIES[difficulty].description}
            </div>
          </div>
        )}
        {(phase === 'won' || phase === 'lost') && (
          <div className="tetris-match-overlay">
            <div className="tetris-overlay-title">{phase === 'won' ? 'you win!' : 'bot wins'}</div>
            <div className="tetris-overlay-sub">
              {phase === 'won' ? 'the bot topped out' : 'your stack reached the top'}
            </div>
            <div className="tetris-overlay-actions">
              <button className="tetris-btn tetris-btn-primary" onClick={restart}>rematch</button>
            </div>
          </div>
        )}
      </div>

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
              keymap[action].map((code, index) => <kbd key={index}>{keyLabel(code)}</kbd>)
            ) : (
              <kbd className="is-unbound">—</kbd>
            )}{' '}
            {HELP_LABELS[action]}
          </span>
        ))}
      </div>

      <div className="tetris-note">
        attacks cancel incoming garbage before crossing the center · difficulty changes bot speed and judgment
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

function BattleField({
  name,
  isBot = false,
  canvasRef,
  holdRef,
  nextRefs,
  ppsRef,
  sentRef,
  garbageRef,
  flashRef,
}: {
  name: string
  isBot?: boolean
  canvasRef: RefObject<HTMLCanvasElement | null>
  holdRef: RefObject<HTMLCanvasElement | null>
  nextRefs: RefObject<(HTMLCanvasElement | null)[]>
  ppsRef: RefObject<HTMLDivElement | null>
  sentRef: RefObject<HTMLDivElement | null>
  garbageRef: RefObject<HTMLDivElement | null>
  flashRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <section className={`tetris-battle-field${isBot ? ' is-bot' : ''}`} aria-label={`${name} playfield`}>
      <div className="tetris-battle-name">
        <span>{name}</span>
        {isBot && <span className="tetris-bot-tag">bot</span>}
      </div>
      <div className="tetris-battle-layout">
        <div className="tetris-side">
          <div className="tetris-box">
            <span className="tetris-box-label">hold</span>
            <canvas ref={holdRef} className="tetris-mini" style={{ aspectRatio: '4 / 2' }} />
          </div>
          <div className="tetris-box tetris-stat">
            <span className="tetris-box-label">pps</span>
            <div className="tetris-stat-value" ref={ppsRef}>0.00</div>
          </div>
          <div className="tetris-box tetris-stat">
            <span className="tetris-box-label">sent</span>
            <div className="tetris-stat-value" ref={sentRef}>0</div>
          </div>
        </div>

        <div className="tetris-well">
          <canvas ref={canvasRef} className="tetris-canvas" />
          <div className="tetris-flash" ref={flashRef} aria-hidden="true" />
        </div>

        <div className="tetris-side tetris-side-right">
          <div className="tetris-box tetris-stat tetris-garbage-stat">
            <span className="tetris-box-label">incoming</span>
            <div className="tetris-stat-value" ref={garbageRef}>0</div>
          </div>
          <div className="tetris-box">
            <span className="tetris-box-label">next</span>
            <div className="tetris-next-list">
              {Array.from({ length: NEXT_COUNT }).map((_, index) => (
                <canvas
                  key={index}
                  ref={(element) => {
                    nextRefs.current[index] = element
                  }}
                  className="tetris-mini"
                  style={{ aspectRatio: '4 / 2' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

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
      className={`tetris-touch-btn${className ? ` ${className}` : ''}`}
      onPointerDown={(event) => {
        event.preventDefault()
        actionsRef.current?.(action, true)
      }}
      onPointerUp={(event) => {
        event.preventDefault()
        actionsRef.current?.(action, false)
      }}
      onPointerLeave={() => actionsRef.current?.(action, false)}
      onPointerCancel={() => actionsRef.current?.(action, false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
  )
}
