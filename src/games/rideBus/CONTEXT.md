# Ride the Bus

Schedule 1-inspired casino card game.

## Gameplay

- Route: `/games/ride-the-bus`
- One standard 52-card deck, drawn without replacement.
- Stake is committed on deal.
- Four rounds:
  - Round 1: red or black.
  - Round 2: higher/equal or lower than the first card. Ace high.
  - Round 3: inside or outside the strict rank range between cards one and two.
  - Round 4: exact suit.
- Player can cash out after any successful round.
- Payouts are total returns on the original wager: 2x, 3x, 4x, 20x.
- Wrong guess loses the stake.

## Files

| File | Role |
| --- | --- |
| `RideBusGame.tsx` | UI, round flow, demo bankroll, live stake/settle RPC wiring; card faces use shared `components/CasinoCard.tsx`. |
| `lib.ts` | Pure card/deck/guess logic, rank values, multipliers. |
| `styles.css` / `../casino.css` | Table, HUD, action controls + shared casino card/chip surfaces. |

## Backend

- Live play uses `ride_bus_deal_stake(amount)` to deduct and escrow the stake.
- Settlement uses `ride_bus_settle(payout)`, capped at 20x the escrowed stake.
- Demo mode is local-only and bypasses RPCs.

## EV notes

Schedule 1-style payouts are generous because optimal play can cash out after
favorable rounds. To move EV closer to 1, reduce later multipliers first, make
round 2 ties lose, draw with replacement, or require a minimum round before cash
out. See PROJECT.md for the broader casino economy notes.
