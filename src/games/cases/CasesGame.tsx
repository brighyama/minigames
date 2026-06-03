import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fetchProfile } from '../../lib/profile'
import { useToast } from '../../lib/toast'
import { BackButton } from '../../components/BackButton'
import { DemoBankrollToggle } from '../../components/DemoBankrollToggle'
import { RarityIcon } from '../../components/RarityIcon'
import {
  abbrev,
  buildReel,
  CASE,
  formatMultiplier,
  itemLabel,
  itemMultiplier,
  pickItemIndex,
  RARITIES,
  rarityChanceOf,
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
  reward_kind: 'chips' | 'cosmetic'
  unlock_id: string | null
  unlock_name: string | null
  duplicate: boolean
}

const CHIPS = [10, 25, 100, 500, 1_000]
const DEMO_BANKROLL = 250
const SPIN_MS = 6_000
const SPIN_EASE = 'cubic-bezier(0.08, 0.82, 0.18, 1)'
const INITIAL_PREVIEW_REEL = [0, 3, 1, 10, 6, 4, 8, 6, 4, 3, 1]

type SpinResult = {
  index: number
  item: CaseItem
  payout: number
  net: number
  rewardKind: 'chips' | 'cosmetic'
  unlockId: string | null
  unlockName: string | null
  duplicate: boolean
  persisted: boolean
}

type Props = {
  onUnlock?: (unlockId: string) => void
}

export function CasesGame({ onUnlock }: Props) {
  const { user } = useAuth()
  const toast = useToast()

  const [wager, setWager] = useState(100)
  const [demoMode, setDemoMode] = useState(() => !user)
  const [balance, setBalance] = useState(DEMO_BANKROLL)
  const [phase, setPhase] = useState<Phase>('idle')
  const [reel, setReel] = useState<number[]>([])
  const [spinId, setSpinId] = useState(0)
  const [result, setResult] = useState<SpinResult | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<SpinResult | null>(null)
  const serverRowRef = useRef<ServerOpen | null>(null)
  const endTimerRef = useRef<number>(0)
  const landedRef = useRef(false)

  const def = CASE
  const spinning = phase === 'spinning'

  useEffect(() => {
    if (!user) {
      setDemoMode(true)
      setBalance(DEMO_BANKROLL)
      return
    }
    setDemoMode(false)
    setBalance(0)
  }, [user])

  useEffect(() => {
    if (!user || demoMode) return
    let cancelled = false
    fetchProfile(user.id).then((p) => {
      if (cancelled || !p) return
      setBalance(Math.max(p.points, 0))
    })
    return () => {
      cancelled = true
    }
  }, [user, demoMode])

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
    const jitter = (Math.random() * 2 - 1) * (tileW * 0.3)
    const target = -(REEL_LANDING * pitch + tileW / 2 - center) + jitter

    const anim = strip.animate(
      [{ transform: 'translateX(0px)' }, { transform: `translateX(${target}px)` }],
      { duration: SPIN_MS, easing: SPIN_EASE, fill: 'forwards' },
    )
    anim.onfinish = land
    endTimerRef.current = window.setTimeout(land, SPIN_MS + 200)
    return () => {
      window.clearTimeout(endTimerRef.current)
      if (anim.playState !== 'finished') anim.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId, spinning])

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
      setBalance((b) => b + pending.payout)
    }

    if (
      pending.persisted &&
      pending.rewardKind === 'cosmetic' &&
      pending.unlockId &&
      !pending.duplicate
    ) {
      onUnlock?.(pending.unlockId)
      toast.show(`unlocked: ${pending.unlockName ?? itemLabel(pending.item)}`, {
        tone: 'success',
      })
    } else if (pending.rewardKind === 'cosmetic' && pending.duplicate && pending.net > 0) {
      toast.show(`duplicate ${pending.unlockName ?? 'cosmetic'}: +${pending.net.toLocaleString()}`, {
        tone: 'success',
      })
    } else if (pending.net > 0) {
      toast.show(`+${pending.net.toLocaleString()} - ${RARITY_LABEL[pending.item.rarity]}!`, {
        tone: 'success',
      })
    }
  }

  const open = async () => {
    if (spinning || wager <= 0 || wager > balance) return

    setResult(null)
    serverRowRef.current = null
    landedRef.current = false
    setBalance((b) => b - wager)

    let winnerIndex: number
    if (user && supabase && !demoMode) {
      const { data, error } = await supabase.rpc('cases_open', {
        case_id: def.id,
        wager,
      })
      const row = (Array.isArray(data) ? data[0] : data) as ServerOpen | null
      if (error || !row) {
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
    const payout = server
      ? server.payout
      : item.kind === 'chips'
        ? Math.floor(wager * item.multiplier)
        : 0
    const net = server ? server.net : payout - wager
    pendingRef.current = {
      index: winnerIndex,
      item,
      payout,
      net,
      rewardKind: server?.reward_kind ?? item.kind,
      unlockId: server?.unlock_id ?? (item.kind === 'cosmetic' ? item.cosmeticId : null),
      unlockName: server?.unlock_name ?? (item.kind === 'cosmetic' ? item.cosmeticName : null),
      duplicate: server?.duplicate ?? false,
      persisted: !!server,
    }

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

  const toggleDemoBankroll = (enabled: boolean) => {
    if (spinning) return
    setResult(null)
    setWager(100)
    if (enabled || !user) {
      setDemoMode(true)
      setBalance(DEMO_BANKROLL)
    } else {
      setDemoMode(false)
      setBalance(0)
    }
  }

  return (
    <main className="cases-container">
      <BackButton label="Exit" />

      <header className="cases-header">
        <div>
          <h1 className="cases-title">cases</h1>
          <p className="cases-subtitle">{def.tagline}</p>
        </div>
        <div className="cases-bankroll-cluster">
          <DemoBankrollToggle
            enabled={demoMode}
            disabled={spinning}
            onChange={toggleDemoBankroll}
          />
          <div className="cases-balance" aria-label="Balance">
            <span className="cases-balance-label">balance</span>
            <span className="cases-balance-value">{balance.toLocaleString()}</span>
          </div>
        </div>
      </header>

      <div className={`cases-reel-wrap${spinning ? ' is-spinning' : ''}`} ref={wrapRef}>
        <div className="cases-reel-pointer" aria-hidden="true" />
        <div className="cases-reel-fade cases-reel-fade-l" aria-hidden="true" />
        <div className="cases-reel-fade cases-reel-fade-r" aria-hidden="true" />

        {reel.length === 0 ? (
          <div className="cases-reel-placeholder">
            {INITIAL_PREVIEW_REEL.map((idx, i) => (
              <ReelTile key={i} item={def.items[idx]} />
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

      <div className="cases-result-slot">
        {phase === 'result' && result && (
          <div
            className={`cases-result rarity-${result.item.rarity} ${result.net > 0 ? 'is-win' : result.net < 0 ? 'is-lose' : 'is-push'}`}
          >
            <span className="cases-result-mult">
              {result.rewardKind === 'cosmetic' && !result.duplicate
                ? result.unlockName
                : result.rewardKind === 'cosmetic' && result.duplicate
                  ? 'duplicate'
                : formatMultiplier(itemMultiplier(result.item))}
            </span>
            <span className="cases-result-net">
              {result.net > 0 ? '+' : ''}
              {result.net.toLocaleString()}
            </span>
            <span className="cases-result-sub">
              {result.rewardKind === 'cosmetic' && !result.duplicate && result.persisted
                ? 'cosmetic unlocked'
                : result.rewardKind === 'cosmetic' && !result.duplicate
                  ? 'demo cosmetic'
                : result.rewardKind === 'cosmetic' && result.duplicate
                  ? 'duplicate bonus'
                  : result.net > 0
                    ? 'profit'
                    : result.net < 0
                      ? 'better luck next time'
                      : 'broke even'}
            </span>
          </div>
        )}
        {spinning && <div className="cases-result cases-result-spin">opening...</div>}
      </div>

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
            {spinning ? 'opening...' : wager > balance ? 'not enough' : 'open case'}
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

      <div className="cases-odds" aria-label={`${def.name} odds`}>
        {RARITIES.map((rarity) => (
          <div key={rarity} className={`cases-odds-item rarity-${rarity}`}>
            <span className="cases-odds-dot" style={{ background: RARITY_COLOR[rarity] }} />
            <span className={`cases-odds-rarity rarity-${rarity}`}>
              <RarityIcon rarity={rarity} />
              <span>{RARITY_LABEL[rarity]}</span>
            </span>
            <span className="cases-odds-chance">
              {(rarityChanceOf(def, rarity) * 100).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      <div className="cases-note">
        {demoMode
          ? 'Demo bankroll is local to this cases session.'
          : 'Wagering your real points.'}
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
      <span className={`cases-tile-kind${item.kind === 'cosmetic' ? ' is-cosmetic' : ''}`}>
        {item.kind === 'cosmetic' ? item.cosmeticKind : 'chips'}
      </span>
      <span className="cases-tile-mult">{itemLabel(item)}</span>
      <span className={`cases-tile-rarity rarity-${item.rarity}`}>
        <RarityIcon rarity={item.rarity} />
      </span>
    </div>
  )
}
