import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fetchProfile } from '../../lib/profile'
import { BackButton } from '../../components/BackButton'
import { RouletteWheel, type RouletteWheelHandle } from './RouletteWheel'
import { RouletteTable } from './RouletteTable'
import {
  abbrev,
  colorOf,
  settleRound,
  POCKET_COUNT,
  type BetMap,
  type RoundResult,
} from './lib'
import './styles.css'

type Phase = 'betting' | 'spinning' | 'result'

/** Row returned by the roulette_spin RPC. */
type ServerSpin = {
  winning: number
  total_wagered: number
  total_return: number
  net: number
  new_points: number
}

const CHIPS = [10, 100, 1_000, 10_000, 100_000]
const DEFAULT_DEMO_BALANCE = 10_000

const BETTING_MS = 12_000
const SPIN_MS = 6_500
const RESULT_MS = 4_500
const RECENT_MAX = 10

export function RouletteGame() {
  const { user } = useAuth()

  const [balance, setBalance] = useState(DEFAULT_DEMO_BALANCE)
  const [phase, setPhase] = useState<Phase>('betting')
  const [timeLeft, setTimeLeft] = useState(Math.ceil(BETTING_MS / 1000))
  const [selectedChip, setSelectedChip] = useState(100)
  const [bets, setBets] = useState<BetMap>({})
  const [history, setHistory] = useState<Array<{ id: string; amount: number }>>([])
  const [recent, setRecent] = useState<number[]>([])
  const [winning, setWinning] = useState<number | null>(null)
  const [result, setResult] = useState<RoundResult | null>(null)

  const wheelRef = useRef<RouletteWheelHandle>(null)
  const betsRef = useRef<BetMap>({})
  const winningRef = useRef<number | null>(null)
  const roundRef = useRef(0)
  const settledRoundRef = useRef(-1)
  /** Server result for the current round, or null when settled locally. */
  const serverResultRef = useRef<ServerSpin | null>(null)

  betsRef.current = bets
  winningRef.current = winning

  const open = phase === 'betting'

  // Hydrate starting balance from the user's real points (preview only).
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

  // The self-driving round loop. One effect per phase; cleanup clears timers so
  // it's safe under StrictMode's double-invoke. Settlement is guarded by a
  // round id so balance can't be paid out twice.
  useEffect(() => {
    if (phase === 'betting') {
      setWinning(null)
      setResult(null)
      const startedAt = Date.now()
      setTimeLeft(Math.ceil(BETTING_MS / 1000))
      const iv = window.setInterval(() => {
        const left = Math.ceil((BETTING_MS - (Date.now() - startedAt)) / 1000)
        setTimeLeft(Math.max(0, left))
      }, 200)
      const to = window.setTimeout(() => setPhase('spinning'), BETTING_MS)
      return () => {
        window.clearInterval(iv)
        window.clearTimeout(to)
      }
    }

    if (phase === 'spinning') {
      roundRef.current += 1
      serverResultRef.current = null
      let cancelled = false
      let to = 0

      // Launch the visible spin toward `n` and schedule the result phase.
      const launch = (n: number) => {
        if (cancelled) return
        winningRef.current = n
        setWinning(n)
        wheelRef.current?.spinTo(n)
        to = window.setTimeout(() => setPhase('result'), SPIN_MS)
      }

      const placed = Object.keys(betsRef.current).length > 0
      if (user && supabase && placed) {
        // Server owns the outcome + payout when real points are at stake.
        void supabase
          .rpc('roulette_spin', { bets: betsRef.current })
          .then(({ data, error }) => {
            if (cancelled) return
            const row = (data?.[0] ?? null) as ServerSpin | null
            if (error || !row) {
              // Fall back to a local spin so the wheel still resolves; the
              // result phase will reconcile the balance from the server.
              console.error('[roulette] spin failed', error)
              launch(Math.floor(Math.random() * POCKET_COUNT))
              return
            }
            serverResultRef.current = row
            launch(row.winning)
          })
      } else {
        // No stake (no bet, or signed out): purely local RNG.
        launch(Math.floor(Math.random() * POCKET_COUNT))
      }

      return () => {
        cancelled = true
        if (to) window.clearTimeout(to)
      }
    }

    // phase === 'result'
    const round = roundRef.current
    if (settledRoundRef.current !== round) {
      settledRoundRef.current = round
      const n = winningRef.current ?? 0
      const settled = settleRound(betsRef.current, n)
      setRecent((prev) => [n, ...prev].slice(0, RECENT_MAX))
      const server = serverResultRef.current
      if (server) {
        // Authoritative: trust the server's payout + balance.
        setResult({
          ...settled,
          totalWagered: server.total_wagered,
          totalReturn: server.total_return,
          net: server.net,
        })
        setBalance(server.new_points)
        window.dispatchEvent(new CustomEvent('points-changed'))
      } else {
        setResult(settled)
        if (settled.totalReturn > 0) {
          setBalance((b) => b + settled.totalReturn)
        }
      }
    }
    const to = window.setTimeout(() => {
      setBets({})
      setHistory([])
      setPhase('betting')
    }, RESULT_MS)
    return () => window.clearTimeout(to)
    // `user` is read inside but intentionally excluded: re-running the loop on
    // an auth change mid-round would desync the wheel. It's read fresh enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ---- Bet actions ------------------------------------------------------

  const placeBet = (betId: string) => {
    if (!open || balance < selectedChip) return
    setBalance((b) => b - selectedChip)
    setBets((prev) => ({ ...prev, [betId]: (prev[betId] ?? 0) + selectedChip }))
    setHistory((h) => [...h, { id: betId, amount: selectedChip }])
  }

  const undo = () => {
    if (!open || history.length === 0) return
    const last = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setBalance((b) => b + last.amount)
    setBets((prev) => {
      const next = { ...prev }
      const remaining = (next[last.id] ?? 0) - last.amount
      if (remaining > 0) next[last.id] = remaining
      else delete next[last.id]
      return next
    })
  }

  const clearBets = () => {
    if (!open) return
    const refund = Object.values(bets).reduce((s, a) => s + a, 0)
    if (refund > 0) setBalance((b) => b + refund)
    setBets({})
    setHistory([])
  }

  const totalWagered = useMemo(
    () => Object.values(bets).reduce((s, a) => s + a, 0),
    [bets],
  )

  const statusText =
    phase === 'betting'
      ? timeLeft > 0
        ? `Place your bets: ${timeLeft}s`
        : 'No more bets'
      : phase === 'spinning'
        ? 'No more bets. Spinning'
        : winning !== null
          ? `${winning} ${colorOf(winning).toUpperCase()}`
          : ''

  return (
    <main className="rl-container">
      <BackButton label="Exit" />

      <div className="rl-layout">
        {/* Left: wheel + recents + result */}
        <div className="rl-left">
          <div className="rl-recent" aria-label="Recent numbers">
            {recent.length === 0 && (
              <span className="rl-recent-empty">No spins yet</span>
            )}
            {recent.map((n, i) => (
              <span key={`${n}-${i}`} className={`rl-recent-pill rl-${colorOf(n)}`}>
                {n}
              </span>
            ))}
          </div>

          <div className="rl-wheel-wrap">
            <RouletteWheel
              ref={wheelRef}
              size={420}
              spinMs={SPIN_MS}
              highlight={phase === 'result' ? winning : null}
            />
            <div className={`rl-status rl-status-${phase}`}>{statusText}</div>
          </div>

          {phase === 'result' && result && (
            <div className="rl-result">
              <span
                className={`rl-result-net ${result.net > 0 ? 'is-win' : result.net < 0 ? 'is-lose' : 'is-push'}`}
              >
                {result.net > 0 ? '+' : ''}
                {result.net.toLocaleString()}
              </span>
              <span className="rl-result-sub">
                {result.totalWagered === 0
                  ? 'No bet this round'
                  : result.net > 0
                    ? 'You win!'
                    : result.net < 0
                      ? 'No luck'
                      : 'Push'}
              </span>
            </div>
          )}
        </div>

        {/* Right: HUD, board, chips */}
        <div className="rl-right">
          <div className="rl-hud">
            <div className="rl-hud-item">
              <span className="rl-hud-label">Balance</span>
              <span className="rl-hud-value">{balance.toLocaleString()}</span>
            </div>
            {totalWagered > 0 && (
              <div className="rl-hud-item">
                <span className="rl-hud-label">In play</span>
                <span className="rl-hud-value">{totalWagered.toLocaleString()}</span>
              </div>
            )}
          </div>

          <RouletteTable
            bets={bets}
            open={open}
            winningBetIds={result?.winningBetIds ?? []}
            winning={phase === 'result' ? winning : null}
            onPlace={placeBet}
          />

          <div className="rl-chip-row">
            {CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                className={`rl-chip chip-${c} ${selectedChip === c ? 'is-selected' : ''}`}
                onClick={() => setSelectedChip(c)}
                disabled={c > balance && selectedChip !== c}
                aria-pressed={selectedChip === c}
                aria-label={`Select ${c} chip`}
              >
                {abbrev(c)}
              </button>
            ))}
          </div>

          <div className="rl-bet-actions">
            <button
              type="button"
              className="rl-btn rl-btn-ghost"
              onClick={undo}
              disabled={!open || history.length === 0}
            >
              Undo
            </button>
            <button
              type="button"
              className="rl-btn rl-btn-ghost"
              onClick={clearBets}
              disabled={!open || totalWagered === 0}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="rl-note">
        {user
          ? ''
          : 'Playing with a demo bankroll. Sign in to wager your real points.'}
      </div>
    </main>
  )
}
