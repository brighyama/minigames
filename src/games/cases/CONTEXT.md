# Cases - game context

Case opening as a casino game (wagers points). Set a wager and watch a
horizontal reel decelerate onto a reward. Most rewards are chip multipliers;
some are cosmetic unlocks that tie the game into the site-wide shop/progression
system. See [PROJECT.md](../../../PROJECT.md) for site-wide architecture
(theming, economy, casino conventions).

## Gameplay

- **One case**, `Arcade Case`, replacing the old Standard/Classified/Covert
  picker. The single weighted table has the current five site rarity colors.
- **Rarity names use the shop visual language**, not gambling-site labels:
  green = 1 star, blue = 2 stars, purple = 3 stars, red = 4 stars, gold =
  exclusive/crown.
- **Mixed rewards.** Most drops are chip multipliers; a few are cosmetics:
  mint theme, mono deck, prism theme, royal deck, casino royale theme.
- The multiplier-only expected return is about **1.173x**. First cosmetic drops
  unlock the item instead of paying points. Duplicate cosmetics return the
  original wager plus a generous flat net profit by rarity: green 100, blue 300,
  purple 1,200, red 5,000, gold 20,000.
- **Wager** is built additively from the casino chip set (10/25/100/500/1000),
  with `max` / `clear` helpers. `open case` is disabled if wager > balance.
- The reel is a strip of rarity-colored tiles; it glides ~6s on a strong
  ease-out so the winning tile lands centered under the pointer (with a little
  in-tile jitter for realism). The landed tile pops and the result banner shows
  either the multiplier result or the cosmetic unlock.
- Reel filler is presentation-only: it uses boosted visual rarity weights and a
  light repeat penalty so purple tiles scroll by more often than the true odds.
  Red filler is capped at one tile per opening, and gold filler appears in only
  about 20% of openings. The landing slot remains forced to the
  server-authoritative draw, so actual red/gold wins still land correctly.
- An **odds table** under the controls lists only each rarity's cumulative drop
  chance. Specific rewards and their weights within a rarity are hidden from the
  user. The displayed rarity chances are whole percentages: green 45%, blue
  35%, purple 15%, red 4%, gold 1%.

## Files

| File | Role |
| --- | --- |
| `lib.ts` | Rarity colors/labels, the single `CASE` reward table, `pickItemIndex`, `buildReel`, formatters. **Mirrored in SQL - see below.** |
| `CasesGame.tsx` | Chip wager builder, balance HUD, reel animation, server open, result reveal, cosmetic unlock callback. |
| `styles.css` / `../casino.css` | Reel/tiles (rarity glow), center pointer, edge fades, shared casino chips, odds table. |

## Backend - server-authoritative

- Signed in: **`cases_open(case_id text, wager int)`** deducts the wager, draws
  the item with server-owned RNG, pays out chip rewards or duplicate cosmetic
  refunds, adds first-time cosmetic drops to `profiles.unlocks`, updates points
  + casino stats atomically, and returns `(item_index, mult_x100, payout, net,
  new_points, reward_kind, unlock_id, unlock_name, duplicate)`. The client
  animates the reel to land on `item_index`.
- Signed-out / demo: a local weighted draw (`pickItemIndex`) against a demo
  bankroll; cosmetics are preview-only and nothing is persisted.
- **CRITICAL invariant:** the reward table in `lib.ts` (`CASE.items`) and in
  `cases_open` must stay identical - same order, integer weights summing to
  10000, reward kinds, multipliers (SQL stores them as hundredths), cosmetic
  IDs/names, and duplicate profits. The returned `item_index` is a 0-based
  index into that shared order. If you edit one, edit both.

## Profile columns

- No new columns. Reuses `unlocks` for cosmetic drops and `casino_net` /
  `casino_biggest_win` for the shared casino leaderboards. No dedicated Cases
  board.

## Gotchas

- **Reel reset.** Each spin remounts the strip via `key={spinId}` so it starts
  at `translateX(0)` with no transition; WAAPI then applies the eased target
  transform. A `setTimeout(SPIN_MS + 200)` is a fallback for hidden/backgrounded
  tabs; `land()` is guarded so it settles exactly once.
- **Optimistic deduction.** The wager leaves the balance the instant you open;
  the payout is credited on landing (from the server's `new_points` when signed
  in, else locally). On an RPC error it falls back to a local draw.
- **Unlock sync.** Server drops mutate `profiles.unlocks`; on landing the client
  calls the App-level unlock callback so the sidebar/shop update immediately.
- Like the other casino games, the running reel animation can make automated
  screenshot tooling time out - verify with snapshots/eval instead.
