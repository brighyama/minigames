# Blackjack — game context

A full blackjack table (casino game — wagers points). See
[PROJECT.md](../../../PROJECT.md) for site-wide architecture (theming, economy,
leaderboard framework, conventions).

## Gameplay

- 6-deck shoe, dealer stands on all 17s (S17), blackjack pays 3:2.
- Actions: Hit / Stand / Double / Split / Insurance.
- Local `balance` (seeded from `points`) drives the UI instantly. Signed-out =
  local demo bankroll.

## Files

| File | Role |
| --- | --- |
| `BlackjackGame.tsx` | Full table + action buttons + backend wiring. |
| `lib.ts` | Pure deck/hand logic: shoe, totals, dealer S17, settle (3:2 BJ). |
| `Card.tsx` / `Hand.tsx` | Card wrapper around shared `components/CasinoCard.tsx` (reads `--card-*` deck vars) + hand with total badge. |
| `styles.css` / `../casino.css` | Table styles + shared casino card/chip surfaces. |

## Backend — escrowed settlement

The outcome is still computed client-side, but the **economy is server-guarded**:

- Each committed bet calls `blackjack_deal_stake` (first stake of a round —
  resets the escrow `bj_open_stake`) or `blackjack_add_stake` (double / split /
  insurance). Points leave the balance immediately, so abandoning a losing hand
  can't dodge the loss.
- Settle calls `blackjack_settle(payout)`, which **caps the payout at 2.5× the
  accumulated wager** and records casino stats.
- RPC calls are serialized through a promise chain so settle always lands after
  its stakes.

## Profile columns & casino stats

- `bj_open_stake bigint` — server-side escrow for the current open round.
- `casino_net bigint` (cumulative, can be negative) and `casino_biggest_win int`
  drive the Casino Net and Biggest Win leaderboards (shared with roulette).

## Theming

- Cards read the active card deck's `--card-face/red/black/back/border/font`
  CSS vars (see card decks in PROJECT.md), so a deck change reskins cards live.
- Wager chips use the shared `.casino-chip` classes from `src/games/casino.css`
  so blackjack, roulette, Ride the Bus, and Cases stay visually aligned.

## Known residual

- A scripted user could loop `blackjack_deal_stake` + `blackjack_settle` always
  claiming the 2.5× cap. Fully closing this means dealing cards server-side like
  roulette. Documented and accepted for a portfolio arcade.
