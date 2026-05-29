import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import { WHEEL_ORDER, POCKET_COUNT, colorOf, pocketIndex } from './lib'

export type RouletteWheelHandle = {
  /** Launch the ball and land it in pocket `n` over `spinMs` (set by prop). */
  spinTo: (n: number) => void
}

type Props = {
  /** Logical pixel size of the (square) canvas. */
  size?: number
  /** Spin duration in ms — must match the orchestrator's SPIN_MS. */
  spinMs: number
  /** When set, the matching pocket gets a glow ring (the just-won number). */
  highlight?: number | null
}

const STEP = (Math.PI * 2) / POCKET_COUNT
/** Wheel angular velocity: one revolution per ~9s (radians per ms). */
const WHEEL_OMEGA = (Math.PI * 2) / 9000
const EXTRA_TURNS = 5

const POCKET_COLORS: Record<string, string> = {
  red: '#c5283d',
  black: '#1c1c22',
  green: '#1f8a4c',
}

function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3)
}
function smooth(x: number): number {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Center angle of wheel pocket at order-index `idx`, in wheel-local space. */
function pocketCenter(idx: number): number {
  return idx * STEP + STEP / 2
}

type BallMode = 'rest' | 'spin'

export const RouletteWheel = forwardRef<RouletteWheelHandle, Props>(
  function RouletteWheel({ size = 440, spinMs, highlight = null }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Live animation state held in refs so the rAF loop never restarts.
    const wheelAngle = useRef(0)
    const ball = useRef({
      mode: 'rest' as BallMode,
      targetIdx: Math.floor(Math.random() * POCKET_COUNT),
      // spin params
      t0: 0,
      startAngle: 0,
      startR: 0,
      totalDelta: 0,
      // current draw values
      angle: 0,
      r: 0,
    })
    const highlightRef = useRef<number | null>(highlight)
    highlightRef.current = highlight

    useImperativeHandle(ref, () => ({
      spinTo(n: number) {
        const idx = pocketIndex(n)
        const b = ball.current
        const R = size / 2
        const trackR = R * 0.85
        // Predict where the wheel will be when the spin ends (constant ω).
        const wheelEnd = wheelAngle.current + WHEEL_OMEGA * spinMs
        const desiredEnd = wheelEnd + pocketCenter(idx)
        // Travel in the negative direction (opposite the wheel) and land on
        // desiredEnd (mod 2π) after EXTRA_TURNS full revolutions.
        let diff = desiredEnd - b.angle
        diff = ((diff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) // [0,2π)
        diff -= Math.PI * 2 // (−2π, 0]
        b.mode = 'spin'
        b.t0 = performance.now()
        b.startAngle = b.angle
        b.startR = b.r || trackR
        b.totalDelta = diff - Math.PI * 2 * EXTRA_TURNS
        b.targetIdx = idx
      },
    }))

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      canvas.width = size * dpr
      canvas.height = size * dpr
      ctx.scale(dpr, dpr)

      const R = size / 2
      const cx = R
      const cy = R
      const pocketOuter = R * 0.82
      const pocketInner = R * 0.46
      const numRadius = R * 0.72
      const trackR = R * 0.85
      const seatR = R * 0.64
      const ballSize = R * 0.034

      let raf = 0
      let last = performance.now()

      const draw = () => {
        const now = performance.now()
        const dt = now - last
        last = now

        // Wheel always turns.
        wheelAngle.current = (wheelAngle.current + WHEEL_OMEGA * dt) % (Math.PI * 2)
        const wa = wheelAngle.current

        const b = ball.current
        if (b.mode === 'spin') {
          const p = Math.min(1, (now - b.t0) / spinMs)
          b.angle = b.startAngle + easeOutCubic(p) * b.totalDelta
          // Radius profile: lift to the outer track, orbit, then spiral into
          // the pocket seat for the last stretch.
          if (p < 0.12) {
            b.r = lerp(b.startR, trackR, smooth(p / 0.12))
          } else if (p < 0.76) {
            b.r = trackR
          } else {
            const k = (p - 0.76) / 0.24
            // A couple of damped bounces as it drops onto the rotor.
            const bounce = Math.sin(k * Math.PI * 3) * (1 - k) * R * 0.025
            b.r = lerp(trackR, seatR, smooth(k)) + Math.abs(bounce)
          }
          if (p >= 1) b.mode = 'rest'
        }
        if (b.mode === 'rest') {
          // Ride along in the pocket as the wheel turns.
          b.angle = wa + pocketCenter(b.targetIdx)
          b.r = seatR
        }

        // ---- Render ----
        ctx.clearRect(0, 0, size, size)

        // Outer rim
        ctx.save()
        const rim = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R)
        rim.addColorStop(0, '#5a3a1a')
        rim.addColorStop(0.5, '#8a5a2a')
        rim.addColorStop(1, '#3a2410')
        ctx.fillStyle = rim
        ctx.beginPath()
        ctx.arc(cx, cy, R * 0.995, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // Pockets (rotating with the wheel)
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(wa)
        for (let i = 0; i < POCKET_COUNT; i++) {
          const n = WHEEL_ORDER[i]
          const a0 = i * STEP
          const a1 = a0 + STEP
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.arc(0, 0, pocketOuter, a0, a1)
          ctx.closePath()
          ctx.fillStyle = POCKET_COLORS[colorOf(n)]
          ctx.fill()
          ctx.strokeStyle = 'rgba(255, 215, 140, 0.35)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
        // Inner hub disc to clip the wedges into a ring.
        ctx.beginPath()
        ctx.arc(0, 0, pocketInner, 0, Math.PI * 2)
        const hub = ctx.createRadialGradient(0, 0, pocketInner * 0.2, 0, 0, pocketInner)
        hub.addColorStop(0, '#d9b66a')
        hub.addColorStop(0.6, '#a07c3a')
        hub.addColorStop(1, '#6e5226')
        ctx.fillStyle = hub
        ctx.fill()
        // Hub cone / turret
        ctx.beginPath()
        ctx.arc(0, 0, pocketInner * 0.18, 0, Math.PI * 2)
        ctx.fillStyle = '#3a2c14'
        ctx.fill()

        // Numbers (radial, readable from outside)
        ctx.fillStyle = '#fff7e6'
        ctx.font = `700 ${Math.round(R * 0.058)}px ui-monospace, "Courier New", monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for (let i = 0; i < POCKET_COUNT; i++) {
          const n = WHEEL_ORDER[i]
          const a = pocketCenter(i)
          ctx.save()
          // Move out along THIS wedge's radial direction (same angle
          // convention as the arc above), then turn the text tangential so
          // multi-digit numbers sit side-by-side with tops facing the rim.
          ctx.rotate(a)
          ctx.translate(numRadius, 0)
          ctx.rotate(Math.PI / 2)
          ctx.fillText(`${n}`, 0, 0)
          ctx.restore()
        }
        ctx.restore()

        // Highlight ring on the winning pocket (drawn in wheel space)
        const hl = highlightRef.current
        if (hl !== null) {
          const idx = pocketIndex(hl)
          ctx.save()
          ctx.translate(cx, cy)
          ctx.rotate(wa)
          const a0 = idx * STEP
          const a1 = a0 + STEP
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.arc(0, 0, pocketOuter, a0, a1)
          ctx.closePath()
          ctx.strokeStyle = '#ffd76b'
          ctx.lineWidth = 3
          ctx.shadowColor = 'rgba(255, 215, 100, 0.9)'
          ctx.shadowBlur = 16
          ctx.stroke()
          ctx.restore()
        }

        // Ball (world space)
        const bx = cx + Math.cos(b.angle) * b.r
        const by = cy + Math.sin(b.angle) * b.r
        ctx.save()
        ctx.beginPath()
        ctx.arc(bx, by, ballSize, 0, Math.PI * 2)
        const bg = ctx.createRadialGradient(
          bx - ballSize * 0.3,
          by - ballSize * 0.3,
          ballSize * 0.1,
          bx,
          by,
          ballSize,
        )
        bg.addColorStop(0, '#ffffff')
        bg.addColorStop(1, '#c8c8d0')
        ctx.fillStyle = bg
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
        ctx.shadowBlur = 6
        ctx.fill()
        ctx.restore()

        raf = requestAnimationFrame(draw)
      }

      raf = requestAnimationFrame(draw)
      return () => cancelAnimationFrame(raf)
    }, [size, spinMs])

    return (
      <canvas
        ref={canvasRef}
        className="rl-wheel"
        style={{ width: size, height: size }}
        aria-label="Roulette wheel"
      />
    )
  },
)
