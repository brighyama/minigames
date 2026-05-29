import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { fetchProfile } from '../../lib/profile'
import { BackButton } from '../../components/BackButton'
import { Hand, badgeFor } from './Hand'
import {
  canDouble,
  canSplit,
  handTotal,
  isBlackjack,
  isBust,
  makeHand,
  newShoe,
  playDealer,
  settleHand,
  type Card,
  type Outcome,
  type PlayerHand,
  type SettledHand,
} from './lib'
import './styles.css'

type Phase = 'betting' | 'player_turn' | 'dealer_reveal' | 'settled'

const CHIPS = [10, 100, 1_000, 10_000, 100_000]
const DEFAULT_DEMO_BALANCE = 10_000
const MIN_BET = 10

export function BlackjackGame() {
  const { user } = useAuth()

  // Balance is hydrated from profile.points on mount when signed in (otherwise
  // a local demo bankroll). Hybrid backend model: this local value drives the
  // UI + affordability instantly, while each stake/payout is mirrored to the
  // server via spend_points / add_points (optimistic — outcome is client-side).
  const [balance, setBalance] = useState<number>(DEFAULT_DEMO_BALANCE)
  const [phase, setPhase] = useState<Phase>('betting')
  const [bet, setBet] = useState(MIN_BET)

  // Deck + hands. deckRef holds the live shoe (mutated via splice) so we don't
  // re-render on every draw; React state mirrors the visible hand contents.
  const deckRef = useRef<Card[]>([])
  const [playerHands, setPlayerHands] = useState<PlayerHand[]>([])
  const [dealer, setDealer] = useState<Card[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [insuranceOffered, setInsuranceOffered] = useState(false)
  const [insuranceBet, setInsuranceBet] = useState(0)
  const [results, setResults] = useState<SettledHand[]>([])

  // Pull real points on mount as the starting demo balance.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchProfile(user.id).then((p) => {
      if (cancelled || !p) return
      setBalance(Math.max(p.points, MIN_BET))
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // ---- Server mirroring (optimistic) ------------------------------------
  const isLive = !!user && !!supabase

  /** Mirror a stake to the server. Fire-and-forget; local check gates play. */
  const serverSpend = (amount: number) => {
    if (!isLive || amount <= 0) return
    void supabase!.rpc('spend_points', { amount }).then(({ error }) => {
      if (error) console.error('[blackjack] spend_points failed', error)
    })
  }

  /** Mirror a payout + record the round's net for casino stats/leaderboards. */
  const serverAwardAndRecord = (payout: number, net: number) => {
    if (!isLive) return
    if (payout > 0) {
      void supabase!.rpc('add_points', { amount: payout }).then(({ error }) => {
        if (error) console.error('[blackjack] add_points failed', error)
      })
    }
    void supabase!.rpc('record_casino_result', { net }).then(({ error }) => {
      if (error) console.error('[blackjack] record_casino_result failed', error)
      window.dispatchEvent(new CustomEvent('points-changed'))
    })
  }

  const activeHand = playerHands[activeIdx]
  const dealerUpcard = dealer[0]
  const dealerShowsAce = dealerUpcard?.rank === 'A'

  const totalWagered = useMemo(
    () => playerHands.reduce((s, h) => s + h.bet, 0) + insuranceBet,
    [playerHands, insuranceBet],
  )

  // ---- Helpers ----------------------------------------------------------

  const draw = (): Card => {
    const c = deckRef.current.shift()
    if (!c) {
      // Re-shoe mid-hand if we somehow ran dry. Shouldn't happen with 6 decks.
      deckRef.current = newShoe()
      return deckRef.current.shift()!
    }
    return c
  }

  // Advance to the next playable hand. If none, go to dealer.
  const advanceOrDealer = (handsSnapshot: PlayerHand[], fromIdx: number) => {
    for (let i = fromIdx + 1; i < handsSnapshot.length; i++) {
      if (handsSnapshot[i].status === 'playing') {
        setActiveIdx(i)
        return
      }
    }
    runDealer(handsSnapshot)
  }

  // ---- Phase transitions ------------------------------------------------

  const deal = () => {
    if (bet > balance || bet < MIN_BET) return
    deckRef.current = newShoe()

    const p1 = draw()
    const d1 = draw()
    const p2 = draw()
    const d2 = draw()
    const startingHand = makeHand([p1, p2], bet)

    setBalance((b) => b - bet)
    serverSpend(bet)
    setPlayerHands([startingHand])
    setDealer([d1, d2])
    setActiveIdx(0)
    setInsuranceOffered(d1.rank === 'A')
    setInsuranceBet(0)
    setResults([])
    setPhase('player_turn')

    // If dealer has natural blackjack (and no insurance to resolve), settle now.
    // We still let the insurance prompt resolve first when offered.
    if (d1.rank !== 'A' && isBlackjack([d1, d2])) {
      // Settle immediately against blackjack.
      setTimeout(() => runDealer([startingHand], [d1, d2]), 400)
    } else if (isBlackjack([p1, p2]) && d1.rank !== 'A') {
      // Player has blackjack and dealer can't have one — auto-stand & settle.
      setTimeout(() => runDealer([startingHand]), 600)
    }
  }

  const takeInsurance = (take: boolean) => {
    setInsuranceOffered(false)
    if (take) {
      const half = Math.floor(bet / 2)
      if (half > balance) return
      setBalance((b) => b - half)
      serverSpend(half)
      setInsuranceBet(half)
    }
    // After insurance decision, if dealer has BJ, end immediately.
    if (isBlackjack(dealer)) {
      runDealer(playerHands)
    } else if (playerHands[0] && isBlackjack(playerHands[0].cards)) {
      runDealer(playerHands)
    }
  }

  const hit = () => {
    if (!activeHand || activeHand.status !== 'playing') return
    const card = draw()
    const newCards = [...activeHand.cards, card]
    const busted = isBust(newCards)
    const next: PlayerHand = {
      ...activeHand,
      cards: newCards,
      status: busted ? 'busted' : 'playing',
    }
    const updated = playerHands.map((h, i) => (i === activeIdx ? next : h))
    setPlayerHands(updated)
    if (busted || handTotal(newCards).total === 21) {
      // Auto-advance on bust or 21.
      const finalized = updated.map((h, i) =>
        i === activeIdx && h.status === 'playing'
          ? { ...h, status: 'standing' as const }
          : h,
      )
      setPlayerHands(finalized)
      advanceOrDealer(finalized, activeIdx)
    }
  }

  const stand = () => {
    if (!activeHand || activeHand.status !== 'playing') return
    const updated = playerHands.map((h, i) =>
      i === activeIdx ? { ...h, status: 'standing' as const } : h,
    )
    setPlayerHands(updated)
    advanceOrDealer(updated, activeIdx)
  }

  const doubleDown = () => {
    if (!activeHand || !canDouble(activeHand, balance)) return
    setBalance((b) => b - activeHand.bet)
    serverSpend(activeHand.bet)
    const card = draw()
    const newCards = [...activeHand.cards, card]
    const busted = isBust(newCards)
    const next: PlayerHand = {
      ...activeHand,
      cards: newCards,
      bet: activeHand.bet * 2,
      doubled: true,
      status: busted ? 'busted' : 'standing',
    }
    const updated = playerHands.map((h, i) => (i === activeIdx ? next : h))
    setPlayerHands(updated)
    advanceOrDealer(updated, activeIdx)
  }

  const split = () => {
    if (!activeHand || !canSplit(activeHand, balance)) return
    setBalance((b) => b - activeHand.bet)
    serverSpend(activeHand.bet)
    const [c1, c2] = activeHand.cards
    const isAces = c1.rank === 'A'
    const draw1 = draw()
    const draw2 = draw()
    const hand1: PlayerHand = {
      cards: [c1, draw1],
      bet: activeHand.bet,
      // 21 after a split isn't a natural blackjack; just a strong hand.
      status: isAces ? 'standing' : 'playing',
      doubled: false,
      splitAces: isAces,
    }
    const hand2: PlayerHand = {
      cards: [c2, draw2],
      bet: activeHand.bet,
      status: isAces ? 'standing' : 'playing',
      doubled: false,
      splitAces: isAces,
    }
    const before = playerHands.slice(0, activeIdx)
    const after = playerHands.slice(activeIdx + 1)
    const updated = [...before, hand1, hand2, ...after]
    setPlayerHands(updated)
    // If split aces (both auto-stood), advance immediately.
    if (isAces) advanceOrDealer(updated, activeIdx + 1)
  }

  const runDealer = (handsSnapshot: PlayerHand[], dealerStart?: Card[]) => {
    setPhase('dealer_reveal')
    const start = dealerStart ?? dealer
    // If every player hand busted or surrendered, dealer doesn't draw.
    const anyAlive = handsSnapshot.some(
      (h) => h.status !== 'busted' && h.status !== 'surrendered',
    )
    // After short delay (for reveal animation), play dealer and settle.
    window.setTimeout(() => {
      const finalDealer = anyAlive ? playDealer(start, deckRef.current) : start
      setDealer(finalDealer)
      settle(handsSnapshot, finalDealer)
    }, 800)
  }

  const settle = (hands: PlayerHand[], finalDealer: Card[]) => {
    let payouts = 0
    const settled: SettledHand[] = hands.map((h) => {
      const r = settleHand(h, finalDealer)
      payouts += r.payout
      return { hand: h, outcome: r.outcome, payout: r.payout }
    })
    // Insurance settlement: pays 2:1 if dealer has blackjack.
    if (insuranceBet > 0) {
      if (isBlackjack(finalDealer)) payouts += insuranceBet * 3
    }
    setBalance((b) => b + payouts)
    setResults(settled)
    setPhase('settled')

    // Mirror to the server: award the total return, record the round's net
    // (return − everything staked this round) for casino stats.
    const wagered = hands.reduce((s, h) => s + h.bet, 0) + insuranceBet
    serverAwardAndRecord(payouts, payouts - wagered)
  }

  const newRound = () => {
    setPhase('betting')
    setPlayerHands([])
    setDealer([])
    setResults([])
    setInsuranceBet(0)
    setInsuranceOffered(false)
    setActiveIdx(0)
  }

  // ---- Derived UI flags -------------------------------------------------

  const showActions =
    phase === 'player_turn' && activeHand?.status === 'playing' && !insuranceOffered
  const showInsurance =
    phase === 'player_turn' && insuranceOffered && dealerShowsAce

  const netResult = useMemo(() => {
    if (phase !== 'settled') return 0
    // Net relative to total wagered (already deducted from balance).
    const winnings = results.reduce((s, r) => s + r.payout, 0)
    const insuranceWin = insuranceBet > 0 && isBlackjack(dealer) ? insuranceBet * 3 : 0
    return winnings + insuranceWin - totalWagered
  }, [phase, results, insuranceBet, dealer, totalWagered])

  // ---- Render -----------------------------------------------------------

  return (
    <main className="bj-container">
      <BackButton label="Exit" />

      <div className="bj-frame">
        <div className="bj-table">
          <div className="bj-hud">
            <div className="bj-hud-item">
              <span className="bj-hud-label">Balance</span>
              <span className="bj-hud-value">{balance.toLocaleString()}</span>
            </div>
            {totalWagered > 0 && (
              <div className="bj-hud-item">
                <span className="bj-hud-label">In play</span>
                <span className="bj-hud-value">{totalWagered.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Dealer area */}
          <div className="bj-dealer-area">
            {dealer.length > 0 && (
              <Hand
                cards={dealer}
                hideLast={phase === 'player_turn'}
                label="Dealer"
                badge={
                  phase !== 'player_turn' && isBlackjack(dealer)
                    ? 'BLACKJACK'
                    : phase !== 'player_turn' && handTotal(dealer).total > 21
                      ? 'BUST'
                      : undefined
                }
              />
            )}
          </div>

          {/* Player area */}
          <div className="bj-player-area">
            {playerHands.length === 0 && phase === 'betting' && (
              <div className="bj-empty-message">
                <h1 className="bj-heading">Blackjack</h1>
                <p className="bj-sub">
                  Place your bet, then click Deal. Dealer stands on all 17s.
                  Blackjack pays 3:2.
                </p>
              </div>
            )}
            <div className="bj-hands-row">
              {playerHands.map((h, i) => (
                <Hand
                  key={i}
                  cards={h.cards}
                  label={playerHands.length > 1 ? `Hand ${i + 1}` : 'You'}
                  bet={h.bet}
                  badge={badgeFor(h)}
                  active={phase === 'player_turn' && i === activeIdx && h.status === 'playing'}
                />
              ))}
            </div>
          </div>

          {/* Result overlay */}
          {phase === 'settled' && (
            <div className="bj-result">
              <div
                className={`bj-result-amount ${netResult > 0 ? 'is-win' : netResult < 0 ? 'is-lose' : 'is-push'}`}
              >
                {netResult > 0 ? '+' : ''}
                {netResult.toLocaleString()}
              </div>
              <div className="bj-result-breakdown">
                {results.map((r, i) => (
                  <span key={i} className={`bj-result-pill outcome-${r.outcome}`}>
                    {labelFor(r.outcome)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom action area */}
        <div className="bj-actions">
          {phase === 'betting' && (
            <BetControls
              bet={bet}
              balance={balance}
              onBet={setBet}
              onDeal={deal}
            />
          )}

          {showInsurance && (
            <div className="bj-action-row">
              <span className="bj-action-prompt">
                Insurance? ({Math.floor(bet / 2).toLocaleString()})
              </span>
              <button className="bj-btn" onClick={() => takeInsurance(true)}>
                Yes
              </button>
              <button className="bj-btn bj-btn-ghost" onClick={() => takeInsurance(false)}>
                No
              </button>
            </div>
          )}

          {showActions && activeHand && (
            <div className="bj-action-row">
              <button className="bj-btn" onClick={hit}>
                Hit
              </button>
              <button className="bj-btn" onClick={stand}>
                Stand
              </button>
              <button
                className="bj-btn"
                onClick={doubleDown}
                disabled={!canDouble(activeHand, balance)}
              >
                Double
              </button>
              <button
                className="bj-btn"
                onClick={split}
                disabled={!canSplit(activeHand, balance)}
              >
                Split
              </button>
            </div>
          )}

          {phase === 'settled' && (
            <div className="bj-action-row">
              <button
                className="bj-btn bj-btn-primary"
                onClick={newRound}
                disabled={balance < MIN_BET}
              >
                {balance < MIN_BET ? 'Out of chips' : 'New bet'}
              </button>
            </div>
          )}
        </div>
      </div>

      {!user && (
        <div className="bj-note">
          Playing with a demo bankroll — sign in to wager your real points.
        </div>
      )}
    </main>
  )
}

function labelFor(o: Outcome): string {
  switch (o) {
    case 'blackjack':
      return 'Blackjack'
    case 'win':
      return 'Win'
    case 'lose':
      return 'Lose'
    case 'push':
      return 'Push'
    case 'busted':
      return 'Bust'
    case 'surrendered':
      return 'Surrender'
  }
}

// ---- Bet controls subcomponent -----------------------------------------

function BetControls({
  bet,
  balance,
  onBet,
  onDeal,
}: {
  bet: number
  balance: number
  onBet: (n: number) => void
  onDeal: () => void
}) {
  const addChip = (amount: number) => {
    onBet(Math.min(balance, bet + amount))
  }
  const clear = () => onBet(MIN_BET)

  return (
    <div className="bj-bet-controls">
      <div className="bj-chip-row">
        {CHIPS.map((c) => (
          <button
            key={c}
            className={`bj-chip chip-${c}`}
            onClick={() => addChip(c)}
            disabled={bet + c > balance}
            aria-label={`Add ${c} chip`}
          >
            {c >= 1000 ? `${c / 1000}K` : c}
          </button>
        ))}
      </div>
      <div className="bj-bet-row">
        <button className="bj-btn bj-btn-ghost" onClick={clear}>
          Clear
        </button>
        <div className="bj-bet-display">
          <span className="bj-bet-label">Bet</span>
          <span className="bj-bet-value">{bet.toLocaleString()}</span>
        </div>
        <button
          className="bj-btn bj-btn-primary"
          onClick={onDeal}
          disabled={bet < MIN_BET || bet > balance}
        >
          Deal
        </button>
      </div>
    </div>
  )
}
