# Roulette — game context

European single-zero roulette (casino game — wagers points). See
[PROJECT.md](../../../PROJECT.md) for site-wide architecture (theming, economy,
leaderboard framework, conventions).

## Gameplay

- European single-zero wheel. Animated canvas wheel + ball physics (continuous
  spin; the ball rides its pocket between rounds).
- Standard felt: straight numbers + columns / dozens / red-black / even-odd /
  1-18 / 19-36. Recent 10 numbers shown.
- **Autonomous round loop** runs forever (betting 12s → spinning 6.5s → result
  4.5s) even with no bet, so the wheel can be watched idle.

## Files

| File | Role |
| --- | --- |
| `RouletteGame.tsx` | The autonomous round loop + backend wiring. |
| `RouletteWheel.tsx` | Canvas wheel + ball physics; imperative `spinTo(n)` lands the ball in pocket n. |
| `RouletteTable.tsx` | European felt: 0 + 3×12 grid, columns/dozens/even-money. Chip placement. |
| `lib.ts` | Wheel order, `colorOf`, bet defs (covers + payout), `settleRound`, abbrev. |
| `styles.css` | Table/wheel styles. |

## Backend — server-authoritative

- When signed in **and** bets are placed, `roulette_spin(bets jsonb)` picks the
  number, computes payout, and moves points atomically — returning the number
  the client then animates to. The server owns the RNG.
- No-bet rounds and signed-out play use local RNG.
- `roulette_multiplier(bet_id, winning)` is the gross-return helper (mirrors the
  client `betDef`).

## Profile columns

- `casino_net bigint` and `casino_biggest_win int` (shared with blackjack) drive
  the Casino Net and Biggest Win leaderboards.

## Gotchas

- **StrictMode-safe:** a round-id guard (`settledRoundRef`) makes settlement
  idempotent; the spin RPC only fires from the `spinning` phase effect, not the
  double-invoked mount effect.
- Like the other canvas games, the continuous animation loop means the page
  never goes "idle" — automated screenshot tooling may time out on it.
