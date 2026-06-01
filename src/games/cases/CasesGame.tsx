import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fetchProfile } from '../../lib/profile'
import { useToast } from '../../lib/toast'
import { BackButton } from '../../components/BackButton'
import {
  abbrev,
  buildReel,
  CASES,
  caseById,
  chanceOf,
  formatMultiplier,
  pickItemIndex,
  RARITY_COLOR,
  RARITY_LABEL,
  REEL_LANDING,
  type CaseItem,
} from './lib'
import './styles.css'

type Phase = 'idle' | 'spinning' | 'result'

/** Row returned by the cases_open RPC. */
type ServerOpen = {
  item_index: number
  mult_x100: number
  payout: number
  net: number
  new_points: number
}

const CHIPS = [10, 25, 100, 500, 1_000]
const DEFAULT_DEMO_BALANCE = 10_000
const SPIN_MS = 6_000
const SPIN_EASE = 'cubic-bezier(0.08, 0.82, 0.18, 1)'

type SpinResult = {
  index: number
  item: CaseItem
  payout: number
  net: number
}

export function CasesGame() {
  const { user } = useAuth()
  const toast = useToast()

  const [caseId, setCaseId] = useState(CASES[0].id)
  const [wager, setWager] = useState(100)
  const [balance, setBalance] = useState(DEFAULT_DEMO_BALANCE)
  const [phase, setPhase] = useState<Phase>('idle')
  const [reel, setReel] = useState<number[]>([])
  const [spinId, setSpinId] = useState(0)
  const [result, setResult] = useState<SpinResult | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  // Result captured at spin launch, applied when the animation lands.
  const pendingRef = useRef<SpinResult | null>(null)
  const serverRowRef = useRef<ServerOpen | null>(null)
  const endTimerRef = useRef<number>(0)
  const landedRef = useRef(false)

  const def = caseById(caseId)
  const spinning = phase === 'spinning'

  // Hydrate the bankroll from the player's real points (signed-in).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchProfile(user.id).then((p) => {
      if (cancelled || !p) return
      setBalance(Math.max(p.points, 0))
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // Drive the reel with the Web Animations API. Each spin remounts the strip
  // (keyed by spinId), so this fires once per spin: we measure the tile pitch,
  // compute where the winning tile (REEL_LANDING) must sit under the center
  // pointer, and glide there on a strong ease-out. WAAPI runs on its own
  // timeline (no fighting React's `style` prop) and `onfinish` settles the spin.
  useEffect(() => {
    if (!spinning) return
    const wrap = wrapRef.current
    const strip = stripRef.current
    if (!wrap || !strip || strip.children.length < 2) return

    const first = strip.children[0].getBoundingClientRect()
    const second = strip.children[1].getBoundingClientRect()
    const pitch = second.left - first.left
    const tileW = first.width
    const center = wrap.clientWidth / 2
    // Land slightly off dead-center for realism, but always within the tile so
    // the pointer stays on the winning item.
    const jitter = (Math.random() * 2 - 1) * (tileW * 0.3)
    const target = -(REEL_LANDING * pitch + tileW / 2 - center) + jitter

    const anim = strip.animate(
      [{ transform: 'translateX(0px)' }, { transform: `translateX(${target}px)` }],
      { duration: SPIN_MS, easing: SPIN_EASE, fill: 'forwards' },
    )
    anim.onfinish = land
    // Fallback: a hidden/backgrounded tab freezes the animation timeline (and
    // `onfinish`), but timers still fire — so settle the result on a timer too.
    // `land()` is idempotent, so whichever runs first wins.
    endTimerRef.current = window.setTimeout(land, SPIN_MS + 200)
    // On a normal finish `fill: forwards` holds the reel on the winning tile;
    // only cancel (snapping back) if we're tearing down an unfinished spin.
    return () => {
      window.clearTimeout(endTimerRef.current)
      if (anim.playState !== 'finished') anim.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId, spinning])

  // Settle the visible spin: reveal the won item + apply the payout once.
  // Guarded by a ref because both `onfinish` and a re-run could race here.
  const land = () => {
    if (landedRef.current) return
    landedRef.current = true
    const pending = pendingRef.current
    if (!pending) return
    setResult(pending)
    setPhase('result')

    const server = serverRowRef.current
    if (server) {
      setBalance(server.new_points)
      window.dispatchEvent(new CustomEvent('points-changed'))
    } else {
      // Demo / signed-out: payout was not yet credited locally.
      setBalance((b) => b + pending.payout)
    }
    if (pending.net > 0) {
      toast.show(`+${pending.net.toLocaleString()} — ${RARITY_LABEL[pending.item.rarity]}!`, {
        tone: 'success',
      })
    }
  }

  const open = async () => {
    if (spinning || wager <= 0 || wager > balance) return

    setResult(null)
    serverRowRef.current = null
    landedRef.current = false
    // Stake is removed up front; payout is credited when the reel lands.
    setBalance((b) => b - wager)

    let winnerIndex: number
    if (user && supabase) {
      const { data, error } = await supabase.rpc('cases_open', {
        case_id: caseId,
        wager,
      })
      const row = (Array.isArray(data) ? data[0] : data) as ServerOpen | null
      if (error || !row) {
        // Fall back to a local draw so the reel still resolves; refund the
        // optimistic deduction and credit locally at landing instead.
        console.error('[cases] open failed', error)
        winnerIndex = pickItemIndex(def)
      } else {
        serverRowRef.current = row
        winnerIndex = row.item_index
      }
    } else {
      winnerIndex = pickItemIndex(def)
    }

    const server = serverRowRef.current
    const item = def.items[winnerIndex]
    const payout = server ? server.payout : Math.floor(wager * item.multiplier)
    const net = server ? server.net : payout - wager
    pendingRef.current = { index: winnerIndex, item, payout, net }

    setReel(buildReel(def, winnerIndex))
    setSpinId((n) => n + 1)
    setPhase('spinning')
  }

  const addChip = (c: number) => {
    if (spinning) return
    setWager((w) => w + c)
  }
  const clearWager = () => {
    if (spinning) return
    setWager(0)
  }
  const maxWager = () => {
    if (spinning) return
    setWager(balance)
  }

  const selectCase = (id: string) => {
    if (spinning) return
    setCaseId(id)
    setResult(null)
  }

  return (
    <main className="cases-container">
      <BackButton label="Exit" />

      <header className="cases-header">
        <h1 className="cases-title">cases</h1>
        <div className="cases-balance" aria-label="Balance">
          <span className="cases-balance-label">balance</span>
          <span className="cases-balance-value">{balance.toLocaleString()}</span>
        </div>
      </header>

      {/* Case picker */}
      <div className="cases-picker" role="tablist" aria-label="Choose a case">
        {CASES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === caseId}
            className={`cases-pick${c.id === caseId ? ' is-active' : ''}`}
            onClick={() => selectCase(c.id)}
            disabled={spinning}
          >
            <span className="cases-pick-name">{c.name}</span>
            <span className="cases-pick-tag">{c.tagline}</span>
          </button>
        ))}
      </div>

      {/* The reel */}
      <div className={`cases-reel-wrap${spinning ? ' is-spinning' : ''}`} ref={wrapRef}>
        <div className="cases-reel-pointer" aria-hidden="true" />
        <div className="cases-reel-fade cases-reel-fade-l" aria-hidden="true" />
        <div className="cases-reel-fade cases-reel-fade-r" aria-hidden="true" />

        {reel.length === 0 ? (
          <div className="cases-reel-placeholder">
            {def.items.map((it, i) => (
              <ReelTile key={i} item={it} />
            ))}
          </div>
        ) : (
          <div className="cases-reel-strip" key={spinId} ref={stripRef}>
            {reel.map((idx, i) => (
              <ReelTile
                key={i}
                item={def.items[idx]}
                highlight={phase === 'result' && i === REEL_LANDING}
              />
            ))}
          </div>
        )}
      </div>

      {/* Result banner */}
      <div className="cases-result-slot">
        {phase === 'result' && result && (
          <div
            className={`cases-result rarity-${result.item.rarity} ${result.net > 0 ? 'is-win' : result.net < 0 ? 'is-lose' : 'is-push'}`}
          >
            <span className="cases-result-mult">{formatMultiplier(result.item.multiplier)}</span>
            <span className="cases-result-net">
              {result.net > 0 ? '+' : ''}
              {result.net.toLocaleString()}
            </span>
            <span className="cases-result-sub">
              {result.net > 0 ? 'profit' : result.net < 0 ? 'better luck next time' : 'broke even'}
            </span>
          </div>
        )}
        {spinning && <div className="cases-result cases-result-spin">opening…</div>}
      </div>

      {/* Wager controls */}
      <div className="cases-controls">
        <div className="cases-wager-row">
          <div className="cases-wager" aria-label="Wager">
            <span className="cases-wager-label">wager</span>
            <span className="cases-wager-value">{wager.toLocaleString()}</span>
          </div>
          <button
            type="button"
            className="cases-open-btn"
            onClick={open}
            disabled={spinning || wager <= 0 || wager > balance}
          >
            {spinning ? 'opening…' : wager > balance ? 'not enough' : 'open case'}
          </button>
        </div>

        <div className="cases-chip-row">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              className={`cases-chip chip-${c}`}
              onClick={() => addChip(c)}
              disabled={spinning || c > balance}
              aria-label={`Add ${c} chip`}
            >
              {abbrev(c)}
            </button>
          ))}
          <button
            type="button"
            className="cases-chip-action"
            onClick={maxWager}
            disabled={spinning || balance <= 0}
          >
            max
          </button>
          <button
            type="button"
            className="cases-chip-action"
            onClick={clearWager}
            disabled={spinning || wager === 0}
          >
            clear
          </button>
        </div>
      </div>

      {/* Odds table for the selected case */}
      <div className="cases-odds" aria-label={`${def.name} odds`}>
        {def.items.map((it, i) => (
          <div key={i} className={`cases-odds-item rarity-${it.rarity}`}>
            <span className="cases-odds-dot" style={{ background: RARITY_COLOR[it.rarity] }} />
            <span className="cases-odds-mult">{formatMultiplier(it.multiplier)}</span>
            <span className="cases-odds-rarity">{RARITY_LABEL[it.rarity]}</span>
            <span className="cases-odds-chance">{(chanceOf(def, it) * 100).toFixed(2)}%</span>
          </div>
        ))}
      </div>

      <div className="cases-note">
        {user
          ? ''
          : 'Playing with a demo bankroll. Sign in to wager your real points.'}
      </div>
    </main>
  )
}

function ReelTile({ item, highlight }: { item: CaseItem; highlight?: boolean }) {
  return (
    <div
      className={`cases-tile rarity-${item.rarity}${highlight ? ' is-landed' : ''}`}
      style={{ ['--rar' as string]: RARITY_COLOR[item.rarity] }}
    >
      <span className="cases-tile-mult">{formatMultiplier(item.multiplier)}</span>
      <span className="cases-tile-rarity">{RARITY_LABEL[item.rarity]}</span>
    </div>
  )
}
