# Cases — game context

CS-style case opening as a casino game (wagers points). Pick a case, set a
wager, and watch a horizontal reel decelerate onto a reward tier; the payout is
`wager × multiplier`. See [PROJECT.md](../../../PROJECT.md) for site-wide
architecture (theming, economy, casino conventions).

## Gameplay

- **Three cases**, each a weighted distribution over five reward tiers (the
  site's rarity colors green→gold). Higher tiers = bigger multiplier, rarer:
  - **Standard** — low volatility (top tier 10×), EV ≈ 0.93
  - **Classified** — medium volatility (top 25×), EV ≈ 0.95
  - **Covert** — high volatility (top 50×, ~60% total loss), EV ≈ 0.905
- **Wager** is built additively from the casino chip set (10/25/100/500/1000),
  with `max` / `clear` helpers. `open case` is disabled if wager > balance.
- The reel is a strip of rarity-colored tiles; it glides ~6s on a strong
  ease-out so the winning tile lands centered under the pointer (with a little
  in-tile jitter for realism). The landed tile pops and the net result banner
  shows the multiplier + signed payout.
- An **odds table** under the controls lists each tier's multiplier and exact
  drop chance for the selected case.

## Files

| File | Role |
| --- | --- |
| `lib.ts` | Rarity tiers + colors, the three `CaseDef`s (item order / weights / multipliers), `pickItemIndex` (weighted draw), `buildReel`, formatters. **Mirrored in SQL — see below.** |
| `CasesGame.tsx` | Case picker, chip wager builder, balance HUD, the reel animation (keyed remount + rAF glide + `transitionend`), server open, result reveal. |
| `styles.css` | Reel/tiles (rarity glow), center pointer, edge fades, chips, odds table. |

## Backend — server-authoritative

- Signed in: **`cases_open(case_id text, wager int)`** deducts the wager, draws
  the item with server-owned RNG, pays out `wager × multiplier`, updates points
  + casino stats atomically, and returns `(item_index, mult_x100, payout, net,
  new_points)`. The client animates the reel to land on `item_index`.
- Signed-out / demo: a local weighted draw (`pickItemIndex`) against a demo
  bankroll; nothing is persisted.
- **CRITICAL invariant:** the per-case item tables in `lib.ts` (`CASES`) and in
  `cases_open` (the `weights`/`mults` arrays) must stay identical — same order,
  same integer weights summing to 10000, same multipliers (SQL stores them as
  hundredths). The returned `item_index` is a 0-based index into that shared
  order. If you edit one, edit both.

## Profile columns

- No new columns. Reuses `casino_net` (bigint) and `casino_biggest_win` (int),
  shared with blackjack/roulette — drives the Casino Net and Biggest Win
  leaderboards. No dedicated Cases board.

## Gotchas

- **Reel reset.** Each spin remounts the strip via `key={spinId}` so it starts
  at `translateX(0)` with no transition; a double-checked `requestAnimationFrame`
  then applies the eased target transform. A `setTimeout(SPIN_MS + 250)` is a
  fallback for `transitionend` not firing (e.g. backgrounded tab); `land()` is
  guarded so it settles exactly once.
- **Optimistic deduction.** The wager leaves the balance the instant you open;
  the payout is credited on landing (from the server's `new_points` when signed
  in, else locally). On an RPC error it falls back to a local draw.
- Like the other casino games, the running reel animation can make automated
  screenshot tooling time out — verify with snapshots/eval instead.
