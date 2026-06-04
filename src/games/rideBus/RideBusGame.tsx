/* eslint-disable react-hooks/refs */
import { useEffect, useRef, useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { CasinoCard } from '../../components/CasinoCard'
import { DemoBankrollToggle } from '../../components/DemoBankrollToggle'
import { useAuth } from '../../lib/auth'
import { fetchProfile } from '../../lib/profile'
import { supabase } from '../../lib/supabase'
import {
  abbrev,
  draw,
  isCorrectGuess,
  newDeck,
  nextRound,
  payoutFor,
  ROUND_MULTIPLIER,
  SUIT_LABEL,
  type Card,
  type Guess,
  type RoundId,
  type Suit,
} from './lib'
import './styles.css'
import '../casino.css'

type Phase = 'betting' | 'guessing' | 'revealed' | 'settled'

type ServerSettle = {
  new_points: number
  net: number
}

const CHIPS = [10, 25, 100, 500, 1_000]
const DEMO_BANKROLL = 250
const MIN_BET = 10

function roundTitle(round: RoundId): string {
  switch (round) {
    case 1:
      return 'red or black'
    case 2:
      return 'higher or lower'
    case 3:
      return 'inside or outside'
    case 4:
      return 'pick the suit'
  }
}

function CardView({ card, hidden = false, index = 0 }: { card?: Card; hidden?: boolean; index?: number }) {
  return <CasinoCard card={card} faceDown={hidden || !card} index={index} className="rtb-card" />
}

export function RideBusGame() {
  const { user } = useAuth()

  const [demoMode, setDemoMode] = useState(() => !user)
  const [balance, setBalance] = useState(DEMO_BANKROLL)
  const [wager, setWager] = useState(MIN_BET)
  const [phase, setPhase] = useState<Phase>('betting')
  const [round, setRound] = useState<RoundId>(1)
  const [cards, setCards] = useState<Card[]>([])
  const [lastGuess, setLastGuess] = useState<Guess | null>(null)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [resultNet, setResultNet] = useState<number | null>(null)

  const deckRef = useRef<Card[]>([])
  const liveRoundRef = useRef(false)
  const opChain = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!user) {
        setDemoMode(true)
        setBalance(DEMO_BANKROLL)
        return
      }
      setDemoMode(false)
      setBalance(0)
    }, 0)
    return () => window.clearTimeout(id)
  }, [user])

  useEffect(() => {
    if (!user || demoMode) return
    let cancelled = false
    fetchProfile(user.id).then((profile) => {
      if (cancelled || !profile) return
      setBalance(Math.max(profile.points, 0))
    })
    return () => {
      cancelled = true
    }
  }, [user, demoMode])

  const isLive = !!user && !!supabase && !demoMode
  const currentPayout = cards.length > 0 ? payoutFor(wager, Math.min(cards.length, 4) as RoundId) : 0
  const canCashOut = phase === 'guessing' && cards.length > 0

  const serverDealStake = (amount: number) => {
    if (!isLive || amount <= 0) return
    liveRoundRef.current = true
    opChain.current = opChain.current
      .then(() => supabase!.rpc('ride_bus_deal_stake', { amount }))
      .then(({ error }) => {
        if (error) console.error('[ride-bus] deal stake failed', error)
      })
      .catch((error) => console.error('[ride-bus] deal stake threw', error))
  }

  const serverSettle = (payout: number) => {
    if (!isLive || !liveRoundRef.current) return
    liveRoundRef.current = false
    opChain.current = opChain.current
      .then(() => supabase!.rpc('ride_bus_settle', { payout }))
      .then(({ data, error }) => {
        if (error) {
          console.error('[ride-bus] settle failed', error)
          return
        }
        const row = (Array.isArray(data) ? data[0] : data) as ServerSettle | null
        if (row) {
          setBalance(row.new_points)
          setResultNet(row.net)
          window.dispatchEvent(new CustomEvent('points-changed'))
        }
      })
      .catch((error) => console.error('[ride-bus] settle threw', error))
  }

  const resetRoundState = () => {
    setPhase('betting')
    setRound(1)
    setCards([])
    setLastGuess(null)
    setLastCorrect(null)
    setResultNet(null)
    deckRef.current = []
    liveRoundRef.current = false
  }

  const toggleDemoBankroll = (enabled: boolean) => {
    if (phase === 'guessing' || phase === 'revealed') return
    resetRoundState()
    setWager(MIN_BET)
    if (enabled || !user) {
      setDemoMode(true)
      setBalance(DEMO_BANKROLL)
    } else {
      setDemoMode(false)
      setBalance(0)
    }
  }

  const addChip = (amount: number) => {
    if (phase !== 'betting') return
    setWager((w) => Math.min(balance, w + amount))
  }

  const clearWager = () => {
    if (phase !== 'betting') return
    setWager(MIN_BET)
  }

  const deal = () => {
    if (phase !== 'betting' || wager < MIN_BET || wager > balance) return
    deckRef.current = newDeck()
    setBalance((b) => b - wager)
    serverDealStake(wager)
    setRound(1)
    setCards([])
    setLastGuess(null)
    setLastCorrect(null)
    setResultNet(null)
    setPhase('guessing')
  }

  const settle = (payout: number) => {
    const net = payout - wager
    setResultNet(net)
    if (!isLive) {
      setBalance((b) => b + payout)
    }
    serverSettle(payout)
    setPhase('settled')
  }

  const choose = (guess: Guess) => {
    if (phase !== 'guessing') return
    const card = draw(deckRef.current)
    const correct = isCorrectGuess(round, guess, cards, card)
    const nextCards = [...cards, card]
    setCards(nextCards)
    setLastGuess(guess)
    setLastCorrect(correct)
    setPhase('revealed')

    window.setTimeout(() => {
      if (!correct) {
        settle(0)
        return
      }
      const upcoming = nextRound(round)
      if (!upcoming) {
        settle(payoutFor(wager, 4))
        return
      }
      setRound(upcoming)
      setPhase('guessing')
    }, 650)
  }

  const cashOut = () => {
    if (!canCashOut) return
    settle(currentPayout)
  }

  const newHand = () => {
    resetRoundState()
  }

  const optionButtons =
    round === 1 ? (
      <>
        <button className="rtb-btn" onClick={() => choose('red')}>red</button>
        <button className="rtb-btn" onClick={() => choose('black')}>black</button>
      </>
    ) : round === 2 ? (
      <>
        <button className="rtb-btn" onClick={() => choose('higher')}>higher/equal</button>
        <button className="rtb-btn" onClick={() => choose('lower')}>lower</button>
      </>
    ) : round === 3 ? (
      <>
        <button className="rtb-btn" onClick={() => choose('inside')}>inside</button>
        <button className="rtb-btn" onClick={() => choose('outside')}>outside</button>
      </>
    ) : (
      (['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]).map((suit) => (
        <button key={suit} className="rtb-btn" onClick={() => choose(suit)}>
          {SUIT_LABEL[suit]}
        </button>
      ))
    )

  return (
    <main className="rtb-container">
      <BackButton label="Exit" />

      <div className="rtb-frame">
        <div className="rtb-table">
          <div className="rtb-hud">
            <DemoBankrollToggle
              enabled={demoMode}
              disabled={phase === 'guessing' || phase === 'revealed'}
              onChange={toggleDemoBankroll}
            />
            <div className="rtb-hud-item">
              <span className="rtb-hud-label">balance</span>
              <span className="rtb-hud-value">{balance.toLocaleString()}</span>
            </div>
            {phase !== 'betting' && (
              <div className="rtb-hud-item">
                <span className="rtb-hud-label">stake</span>
                <span className="rtb-hud-value">{wager.toLocaleString()}</span>
              </div>
            )}
          </div>

          <section className="rtb-stage" aria-label="Ride the Bus table">
            <div className="rtb-cards">
              {Array.from({ length: 4 }).map((_, index) => (
                <CardView
                  key={index}
                  card={cards[index]}
                  index={index}
                  hidden={phase !== 'betting' && index === cards.length && phase === 'guessing'}
                />
              ))}
            </div>

            <div className="rtb-message">
              <h1 className="rtb-title">ride the bus</h1>
              <p className="rtb-sub">
                {phase === 'betting'
                  ? 'place your bet'
                  : phase === 'settled'
                    ? resultNet !== null && resultNet > 0
                      ? `+${resultNet.toLocaleString()}`
                      : resultNet === 0
                        ? 'push'
                        : `${resultNet?.toLocaleString() ?? 0}`
                    : roundTitle(round)}
              </p>
              {phase !== 'betting' && phase !== 'settled' && (
                <div className="rtb-progress">
                  round {round} / 4
                  {canCashOut && <span>cash out {currentPayout.toLocaleString()}</span>}
                </div>
              )}
              {lastGuess && lastCorrect !== null && (
                <div className={`rtb-verdict ${lastCorrect ? 'is-win' : 'is-lose'}`}>
                  {String(lastGuess)} {lastCorrect ? 'hit' : 'missed'}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="rtb-actions">
          {phase === 'betting' && (
            <>
              <div className="rtb-chip-row">
                {CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={`rtb-chip casino-chip chip-${chip}`}
                    onClick={() => addChip(chip)}
                    disabled={wager + chip > balance}
                    aria-label={`Add ${chip} chip`}
                  >
                    {abbrev(chip)}
                  </button>
                ))}
              </div>
              <div className="rtb-bet-row">
                <button className="rtb-btn rtb-btn-ghost" onClick={clearWager}>clear</button>
                <div className="rtb-bet-display">
                  <span>wager</span>
                  <strong>{wager.toLocaleString()}</strong>
                </div>
                <button className="rtb-btn rtb-btn-primary" onClick={deal} disabled={wager < MIN_BET || wager > balance}>
                  deal
                </button>
              </div>
            </>
          )}

          {(phase === 'guessing' || phase === 'revealed') && (
            <div className="rtb-action-row">
              {optionButtons}
              <button className="rtb-btn rtb-btn-primary" onClick={cashOut} disabled={phase !== 'guessing' || !canCashOut}>
                cash out {canCashOut ? currentPayout.toLocaleString() : ''}
              </button>
            </div>
          )}

          {phase === 'settled' && (
            <div className="rtb-action-row">
              <button className="rtb-btn rtb-btn-primary" onClick={newHand} disabled={balance < MIN_BET}>
                {balance < MIN_BET ? 'out of chips' : 'new ride'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rtb-note">
        {demoMode ? 'Demo bankroll is local to this ride.' : 'Wagering your real points.'}
        <span> Full clear pays {ROUND_MULTIPLIER[4]}x.</span>
      </div>
    </main>
  )
}
