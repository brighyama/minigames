# Minigames — Project Reference

A personal hub of small browser games with shared progression: accounts, points, daily bonuses, a shop, themes, card decks, achievement-style rarities, and leaderboards. Two families of games:
- **Skill games** — Reaction Test, Aim Trainer, 2048 (high-score based; 2048 also ships with a built-in, swappable AI solver), and Chess (play vs a built-in `chess.js` engine — the one game with **no** points/leaderboard/backend).
- **Casino games** — Blackjack, Roulette (wager points). Grouped under a "Casino" section on the home page.

**One unified visual theme spans every game.** The active theme reskins the whole surface — page gradient, accents, card decks, **2048 tile palettes**, and **aim-trainer targets** — and every game uses the same chamfered `clip-path` geometry (never `border-radius`). See "Unified theming across games" below.

**Deployment:** static SPA (`npm run build` → `dist/`) hosted on Vercel at `games.brightenhayama.dev` (a subdomain of the GitHub-Pages portfolio). [vercel.json](vercel.json) provides the SPA fallback rewrite so client-side routes deep-link correctly.

This file is the catch-up doc for new chats. Read top to bottom — the architecture sections come first, then the feature inventory, then the extension cookbook at the bottom.

---

## Stack

- **Vite + React 19 + TypeScript** — single-page app, dev server via `npm run dev`.
- **react-router-dom v7** — `BrowserRouter` at app root; routes declared inline in [src/App.tsx](src/App.tsx).
- **Supabase** — auth (email/password), Postgres for `profiles`, and SQL RPC functions for anything the client must not control (points math, leaderboards, daily cooldown, high-score writes).
- **No CSS framework.** All styles in plain CSS. Visual language: dark gradient backgrounds, glassy translucent panels, **`clip-path` polygons** (chamfered/octagonal corners — never `border-radius`).

### Env vars (in `.env.local`, gitignored)

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable / anon key>
```

If these are missing, [src/lib/supabase.ts](src/lib/supabase.ts) exports `supabase = null` and the app degrades gracefully (auth panel shows a "not configured" message, all RPCs no-op).

---

## Project structure

```
public/                       Static assets (drop game images here, e.g. public/games/reaction.png)
vercel.json                   Vercel SPA-fallback rewrite (all paths → /index.html).
supabase/
  schema.sql                  Full DB schema + RPC functions. Source of truth for Supabase setup.
  hardening.sql               Security migration — run AFTER schema.sql. Locks down direct table
                              writes, retires the arbitrary-amount points RPCs, adds bounded rewards
                              + escrowed blackjack settlement. See "Security model" below.

src/
  main.tsx                    Root render: <BrowserRouter><AuthProvider><ToastProvider><App />…
  App.tsx                     The shell. Holds theme/unlocks/points state, the sidebar, the top-left
                              nav (gear + trophy), the top-right cluster (daily + points + shop —
                              home-only), and all <Route> declarations.
  App.css                     Most styles — sidebar, theme tiles, cards, points/daily/shop, toasts,
                              leaderboards, shop, polygon shape variables.
  index.css                   :root CSS variables (defaults for --bg-start, --bg-stop, --theme-text,
                              --theme-font, --accent-1, --accent-2), body gradient binding.

  lib/
    supabase.ts               Creates the supabase client; null if env vars missing.
    auth.tsx                  <AuthProvider> + useAuth() — exposes user/session/signIn/signUp/signOut.
    toast.tsx                 <ToastProvider> + useToast() — global toast queue, bottom-right viewport.
    profile.ts                Profile type + fetchProfile()/saveProfile(). The single source of truth
                              for the columns the client cares about.
    themes.ts                 The Theme type + the themes array. Edit this file to add / reprice /
                              reskin any theme. Also exports DEFAULT_ACCENT_1 / DEFAULT_ACCENT_2.
    leaderboards.ts           fetch*Leaderboard helpers (thin wrappers over Supabase RPC calls):
                              Total / Reaction / Aim / 2048 / CasinoWin / CasinoNet.
    cardDecks.ts              CardDeck type + cardDecks array. Active deck writes --card-* CSS
                              vars on :root (face/red/black/back/border/font). Mirrors themes.ts.

  components/
    AuthPanel.tsx             Sign-in / Sign-up form OR signed-in view (username, password change,
                              sign out). Rendered inside the sidebar.
    DailyBonus.tsx             Top-right "+100" / countdown button. Pulls last_daily_claim, calls
                              claim_daily_points RPC.
    Leaderboard.tsx           Generic leaderboard card (loading/error/empty/data states, gold/silver/
                              bronze for ranks 1-3). Used in the LeaderboardsPage.
    RarityIcon.tsx            Renders 1/2/3/4 star SVGs for green/blue/purple/red, crown for gold.
                              rarityLabel() returns the accessible name.
    BackButton.tsx            Universal fixed top-center exit/back button. Used on every non-home
                              page (shop, leaderboards, all games). label defaults to "Back".

  pages/
    HomePage.tsx              Hero + grid of game cards. Each card = 80% image / 20% name strip. No
                              emojis, no descriptions (cards have placeholderGradient until real images
                              are dropped in public/games/).
    LeaderboardsPage.tsx      Grid of Leaderboard cards: Total Points, Reaction Time, Aim Trainer.
                              Shows a gold banner if signed-out / no username (those users can't be
                              ranked because RPCs filter `username is not null`).
    ShopPage.tsx              Sections of purchasable cosmetics. Theme section reads `themes` array,
                              shows one card per locked theme. Buy = spend_points RPC, then
                              onUnlock(themeId) to bubble unlock back into App state.

  games/
    reaction/
      ReactionGame.tsx        Full-screen color-flip test. Five phases: idle, waiting (red/--accent-1),
                              ready (green/--accent-2), tooEarly, result.
      styles.css              Full-screen game CSS + the recent-times bar.
    aim/
      AimGame.tsx             Large centered card with a 60px circle that respawns at a random point
                              on hit. 20s timer. Rarity-driven particle effects on hit (red →
                              gravity explosion, gold → no-gravity sparkle).
      styles.css              Game-specific styles.
    g2048/
      lib.ts                  Pure 2048 logic: board (flat 16-array), move/merge per direction,
                              spawn, canMove, highestTile, hasWon. No React, no Supabase.
      Game2048.tsx            Board UI + keyboard/WASD/swipe controls, score/best boxes, win &
                              game-over overlays, the "Watch AI" toggle.
      styles.css              Game-specific styles (chamfered clip-paths, matching the site).
      palette.ts              Per-theme tile palettes. applyTilePalette(root, themeId) sets/clears
                              --g2048-bg-*/--g2048-fg-* CSS vars (called from App.tsx theme effect).
      solver/                 Modular AI solver package (swap createSolver() to plug in your own):
        types.ts                The Solver interface (chooseMove / reset) + SolverFactory.
        expectimax.ts           Default depth-adaptive expectimax solver + heuristic.
        index.ts                solvers registry + createSolver() factory (the active solver).
    blackjack/
      BlackjackGame.tsx       Full table. Hit/stand/double/split/insurance. Optimistic backend
                              (spend_points on stakes, add_points + record_casino_result on settle).
      lib.ts                  Pure deck/hand logic: shoe, totals, dealer S17, settle (3:2 BJ).
      Card.tsx / Hand.tsx     Card render (reads --card-* deck vars) + hand with total badge.
      styles.css
    roulette/
      RouletteGame.tsx        Autonomous round loop (betting 12s → spinning 6.5s → result 4.5s),
                              runs forever even with no bet. Server-authoritative when signed in +
                              bets placed (roulette_spin RPC); local RNG otherwise.
      RouletteWheel.tsx       Canvas wheel + ball physics. Continuous rotation; imperative spinTo(n)
                              lands the ball in pocket n; ball rides the pocket at rest.
      RouletteTable.tsx       European felt: 0 + 3×12 grid, columns/dozens/even-money. Chip placement.
      lib.ts                  Wheel order, colorOf, bet defs (covers + payout), settleRound, abbrev.
      styles.css
    chess/
      ChessGame.tsx           Board UI, click-to-move, engine-level / time-control / piece-skin
                              controls, clocks, move list. Uses the chess.js library.
      lib.ts                  Pure engine: material eval + alpha-beta minimax, 3 levels
                              (casual/standard/expert), all time-bounded. No React, no backend.
      palette.ts              Per-theme board colors → --chess-* CSS vars (mirrors g2048).
      styles.css              Board + piece styling (shared clip-path geometry).
```

---

## Features implemented

### Auth + profile

- Email/password via Supabase. AuthPanel lives in the sidebar (top section).
- Each user has one row in `public.profiles`, created by a trigger on `auth.users` insert (see schema).
- Username is editable in the AuthPanel signed-in view and is the column that drives leaderboard visibility.

### Themes

- Defined in [src/lib/themes.ts](src/lib/themes.ts) — `Theme` type + `themes` array (first = default for new users).
- Active theme writes these CSS variables on `:root`:
  - `--bg-start` / `--bg-stop` — full-page linear gradient (fixed-attached on `body`).
  - `--theme-text`, `--theme-font`, `--theme-title-shadow` — typography overrides.
  - `--accent-1` / `--accent-2` — general-purpose color slots. Reaction test reads them for the wait/go backgrounds; aim circles use them for their radial gradient and explosion particles. Naming is intentional — these are for any future game/feature, not reaction-specific.
- Default themes (4, unlocked): **Classic, Forest, Lilac, Mono.**
- Locked themes (**15**, in the shop), grouped by rarity tier (price shared within a tier):
  - **green (~100):** Mint, Aqua, Sakura
  - **blue (~1K):** Candy, Sunset, Glacier
  - **purple (~10K):** Ember, Amethyst, Verdant
  - **red (~100K):** Midnight, Synthwave, Inferno
  - **gold (~1M):** Noir, Celestial, Eclipse
- Higher tiers layer on more flourish: green = gradient + accents only; blue adds a tuned text color; purple does full text theming; red/gold add display fonts and glowing title shadows.

### Unified theming across games

The goal is that **every game looks like part of the same site** under whatever theme is active. The App.tsx theme effect is the single place that pushes theme state into game-specific CSS variables on `:root`:

- **Geometry.** No game uses `border-radius`. All panels, tiles, buttons, and overlays use the shared `clip-path` chamfer shapes (`--shape-octagon`, `--shape-octagon-sm`, `--shape-diagonal`) defined at the top of [App.css](src/App.css). The 2048 board/overlay use `--shape-octagon`; its tiles/score boxes/buttons use `--shape-octagon-sm`.
- **2048 tile colors are theme-driven.** [palette.ts](src/games/g2048/palette.ts) holds a curated 11-color palette per *unlockable* theme — deliberately mixing light/dark shades and rotating complementary hues (not a flat gradient), with the 2048 tile as the theme's signature color. The **4 default themes have no palette → they fall back to the classic 2048 colors** baked into the tile CSS. Tile text color is auto-chosen per background by WCAG luminance. `applyTilePalette()` clears the vars on every theme switch so palettes never bleed across themes.
- **Aim-trainer targets are theme-driven.** Circles read `--aim-circle-a/--aim-circle-b`. For the **4 default themes the circle is plain white** (`#ffffff → #e2e2e2`); unlockable themes tint it with their accents. Set in the same App.tsx theme effect.
- **Chess board is theme-driven.** [src/games/chess/palette.ts](src/games/chess/palette.ts)'s `applyChessPalette()` (called from the App.tsx theme effect) sets `--chess-light/dark/hint/capture`; the **4 default themes fall back to classic browns**, unlockable themes get a bespoke board palette.
- **Accents + decks** (`--accent-1/2`, `--card-*`) continue to flow into reaction/aim/blackjack as before.

### Rarity glow (themes + card decks)

- `Rarity = 'green' | 'blue' | 'purple' | 'red' | 'gold'` (in [themes.ts](src/lib/themes.ts); shared by card decks).
- Visual indicator via [components/RarityIcon.tsx](src/components/RarityIcon.tsx): 1/2/3/4 stars for green/blue/purple/red, a crown SVG for gold (the "exclusive" tier).
- Glow effect: outer background swapped to the rarity color + `filter: drop-shadow(...)` traces the chamfered shape. Applied on sidebar tiles and shop cards.
- **Cost tiers scale ~exponentially** with rarity: green ~100, blue ~1K, purple ~10K, red ~100K, gold ~1M. Casino chip denominations mirror this ladder (10 / 100 / 1K / 10K / 100K, colored green→blue→purple→red→gold).

### Card decks

- Defined in [src/lib/cardDecks.ts](src/lib/cardDecks.ts) — `CardDeck` type + `cardDecks` array (first = default, always unlocked).
- Active deck writes `--card-face`, `--card-red`, `--card-black`, `--card-back`, `--card-border`, `--card-font` on `:root` from [App.tsx](src/App.tsx). `Card.tsx` (blackjack) consumes them, so a deck change reskins cards live.
- Selector lives in the sidebar (below Theme). Locked decks auto-appear in the Shop "Card decks" section. Decks: **Classic** (free), **Mono** (green), **Neon** (purple), **Royal** (red).
- NOTE: deck choice is **localStorage-only** (`minigames:deck`) — no `deck_id` profile column yet, so it doesn't sync across devices.

### Selected-cosmetic indicator

- The active theme/deck tile shows a translucent checkmark overlay (`.theme-option.is-selected::after` in [App.css](src/App.css)). The hover-name label sits above it (`z-index: 3`).

### Points + lifetime points

- `profiles.points` (spendable balance) and `profiles.lifetime_points` (monotonic, drives the Total Points leaderboard).
- All point gains go through **purpose-specific server RPCs that compute the amount themselves** (`award_reaction`, `award_aim`, `submit_2048_result`, `claim_daily_points`, `roulette_spin`, `blackjack_settle`). There is **no generic "add N points" endpoint** callable by clients — see "Security model". `spend_points` (shop) is the only remaining client-callable mutation, and it can only *decrease* points.
- Displayed in the top-right cluster (home page only).
- `window.dispatchEvent(new CustomEvent('points-changed'))` is the convention for triggering a fresh profile fetch in App.tsx. Any code that mutates points fires this.

### Daily bonus

- One-click +100 every 24h. RPC `claim_daily_points()` enforces the cooldown server-side (`last_daily_claim` timestamp). Returns `(claimed, next_at, awarded)`.
- Button lives to the left of the points badge in the top-right cluster.
- Available state: gold-orange gradient with gift-box icon. Cooldown state: live `HH:MM:SS` countdown that ticks every second.

### Shop

- Route `/shop`. Top-right shop bag icon links to it (home-only).
- One section per cosmetic category. Currently two: **Themes** (one card per `theme.locked === true`) and **Card decks** (one card per `deck.locked === true`, with a fanned 3-card preview).
- Cards show the rarity icon, gradient preview, price tag, and a buy button. Owned themes show only the "Owned" tag — no button.
- Buy flow: `spend_points` RPC → on success, `onUnlock(themeId)` is called by `ShopPage` which is passed down from App; App appends to `unlocks` state + persists to profile.

### Toasts

- Global queue in [src/lib/toast.tsx](src/lib/toast.tsx), `useToast().show(message, { tone, durationMs })`.
- Tones: `info`, `success` (green border), `error` (red border).
- Auto-dismiss after 3000ms.
- Bottom-right fixed viewport; toasts use the same polygonal clip-path as the rest of the UI.

### Leaderboards

- Route `/leaderboards`. Cards rendered in a responsive grid.
- Six boards: **Total Points**, **Reaction Time** (lower = better, `X ms`), **Aim Trainer**, **2048** (best tile reached), **Biggest Win** (single casino round), **Casino Net** (cumulative, can be negative — signed display).
- All driven by `SECURITY DEFINER` RPCs that filter `username is not null`. Users without a username never appear — the page shows a gold banner reminding them to set one.

### Games

#### Reaction Test (`src/games/reaction/`)

- Full-screen. Click anywhere to start a round. After a random 1.5–5s delay, the background flips from `--accent-1` to `--accent-2`. Click as soon as it flips. Clicking too early = "Too soon".
- Top of screen: live list of the last 5 reactions, plus a rolling 5-window average once 5 have been recorded, plus the user's all-time best avg.
- High score = lowest rolling 5-window avg ever recorded (ms). **Saved immediately** when a new low is achieved during play (RPC `update_reaction_best`), not on exit.
- Points on exit: 5–10 based on the session's best 5-avg (10 for ≤250ms, -1 per 10ms above, floor 5). RPC `award_reaction(best_avg_ms)` computes the (bounded) reward server-side.

#### Aim Trainer (`src/games/aim/`)

- Large centered card (not full-screen). HUD shows time remaining + current score.
- 20-second round. One 60px circle on screen at a time; clicking it scores 1 point and immediately spawns the next. Circles persist until clicked or until the timer ends.
- Circles use `radial-gradient(--accent-2, --accent-1)` — themed automatically.
- Rarity-driven hit effects (read from `theme.rarity` passed as prop from App):
  - **Red (★★★)** — 8-particle gravity explosion using accent colors.
  - **Gold (♛)** — 14-particle outward sparkle, no gravity, gold color.
  - Anything else — no effect.
- High score = most circles in a single round. **Saved immediately when a round ends** if it's a new personal best (RPC `update_aim_high_score`).
- Points on exit: `5 + Math.floor(best_session_score / 2)`, minimum 5. RPC `award_aim(best_score)` computes the reward server-side (score clamped to a plausible ≤200 ceiling).

#### 2048 (`src/games/g2048/`)

- Classic 4×4 2048. Arrow keys / WASD / swipe. Win at the 2048 tile with an optional "Keep going". Fixed-size board (`grid-template-rows: repeat(4, 1fr)` + `aspect-ratio`) so empty rows never collapse; scales phone → desktop.
- **"Score" = the current game's highest tile; "Best" = the account's highest tile ever** (loaded from `profiles.g2048_high_score`). The old merge-points score was removed entirely.
- **Points reward by top tile:** `5 × (top_tile / 64)` — i.e. 5 at 64, doubling each tile up (128→10, 256→20, 512→40, 1024→80, 2048→160, …). Computed server-side.
- **Submission triggers:** a non-AI game is submitted on **game over, leaving the page, or "New game"** — whichever comes first. `submittedRef` guarantees one submit per game; `aiUsedRef` blocks any game the AI touched. Game-over submit runs from an effect watching `over` (not a side effect inside the `setBoard` updater — that double-ran under StrictMode and dropped saves).
- **`submit_2048_result(top_tile int)`** validates the tile (power of two ≤ 131072), updates the account best via `greatest`, and awards the points. **`get_leaderboard_2048`** ranks by best tile.
- **AI solver ("Watch AI" toggle).** Drives the board at a watchable cadence using a pluggable solver ([solver/](src/games/g2048/solver/)). Default is depth-adaptive **expectimax**. To swap in your own (e.g. an RL policy), implement the `Solver` interface and return it from `createSolver()` in `solver/index.ts`. **AI-assisted games are never ranked or rewarded.**

#### Blackjack (`src/games/blackjack/`)

- 6-deck shoe, dealer stands on all 17s (S17), blackjack pays 3:2. Hit / Stand / Double / Split / Insurance.
- Backend: **escrowed settlement** (outcome still computed client-side, but the economy is server-guarded). Each committed bet calls `blackjack_deal_stake` (first stake of a round, resets the escrow) or `blackjack_add_stake` (double/split/insurance) — points leave the balance immediately, so abandoning a losing hand can't dodge the loss. The settle calls `blackjack_settle(payout)`, which **caps the payout at 2.5× the accumulated wager** and records casino stats. RPC calls are serialized through a promise chain so settle always lands after its stakes. Local `balance` (seeded from `points`) drives the UI instantly. Signed-out = local demo bankroll.

#### Roulette (`src/games/roulette/`)

- European single-zero wheel. Animated canvas wheel + ball physics (continuous spin; ball rides its pocket between rounds). Standard felt: straight numbers + columns / dozens / red-black / even-odd / 1-18 / 19-36. Recent 10 numbers shown.
- **Autonomous round loop** runs forever (betting 12s → spinning 6.5s → result 4.5s) even with no bet, so the wheel can be watched idle.
- Backend: **server-authoritative** when signed in AND bets are placed — `roulette_spin(bets)` RPC picks the number + computes payout + moves points atomically, returning the number the client then animates to. No-bet rounds and signed-out play use local RNG.
- StrictMode-safe: round-id guard (`settledRoundRef`) makes settlement idempotent; the spin RPC only fires from the `spinning` phase effect (not the double-invoked mount effect).

#### Chess (`src/games/chess/`)

- Play vs a built-in JavaScript engine (the [chess.js](https://www.npmjs.com/package/chess.js) library handles rules / move generation / SAN). Click a piece → legal targets highlight → click to move; last-move and check squares are highlighted, with a move list and a clock panel alongside the board. **You auto-switch colors each "new game"** (the engine opens with a random first move when it plays white).
- **Engine levels** ([lib.ts](src/games/chess/lib.ts)): *casual* (greedy heuristic — favors captures/checks/promotions/center), *standard* (depth-1 minimax), *expert* (depth-2 alpha-beta with positional terms). All searches are wall-clock-bounded (`maxMs`).
- **Time controls:** none / 1+1 / 3+2 / 5 (Fischer increment supported; "none" = untimed). Running out flags a loss.
- **Cosmetics are local UI selects, _not_ shop items:** 4 piece *color* skins (classic / walnut / frost / neon) × 3 piece *styles* (classic Staunton SVG / geometric / glyph).
- **Board colors are theme-driven** via [palette.ts](src/games/chess/palette.ts) — see "Unified theming across games".
- **Purely client-side: chess awards no points and has no leaderboard, profile column, or Supabase RPC.** It's the only game with zero backend integration — nothing to add to `schema.sql` for it.

### Home page categories

- [HomePage.tsx](src/pages/HomePage.tsx) renders two grids: skill games up top, then a **Casino** section (`.home-section` + `.home-section-title`) with Blackjack + Roulette.

### Top-right cluster visibility

- The points badge, daily-bonus button, and shop link only render when `location.pathname === '/'`. Other routes (games, shop, leaderboards) hide them so the focus is on whatever's there.

---

## Database

### `public.profiles` columns

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `uuid` (PK) | FK to `auth.users(id)`; cascading delete. |
| `username` | `text unique` | Required for leaderboard visibility. |
| `theme_id` | `text` | Null until the user explicitly picks one (lets first-login merge local prefs). |
| `unlocks` | `text[]` | Theme IDs the user has purchased. |
| `points` | `int` | Spendable balance. |
| `lifetime_points` | `int` | Monotonic; drives Total Points leaderboard. |
| `last_daily_claim` | `timestamptz` | Set by `claim_daily_points`. Null = never claimed. |
| `best_reaction_avg` | `int` | Lowest rolling-5 avg in ms. Null = no record. |
| `aim_high_score` | `int` | Most circles in 20s. 0 = no record. |
| `g2048_high_score` | `int` | Highest **tile** ever reached in 2048 (e.g. 2048), not a merge score. Drives the 2048 board. |
| `casino_net` | `bigint` | Cumulative casino net (can be negative). Drives Casino Net board. |
| `casino_biggest_win` | `int` | Best single-round net win. Drives Biggest Win board. |
| `bj_open_stake` | `bigint` | Server-side blackjack escrow: points staked in the current open round. Caps the settle payout. 0 between rounds. |
| `updated_at` | `timestamptz` | Touched on every write. |

### RPC functions (all `SECURITY DEFINER`)

Grants below reflect the **post-`hardening.sql`** state (run schema.sql, then hardening.sql).

| Function | Who | Purpose |
| --- | --- | --- |
| `handle_new_user()` | trigger | Creates a profile row on `auth.users` insert. |
| `spend_points(amount int) returns boolean` | authenticated | Decrements points only if balance suffices (shop). Can only *decrease*. |
| `claim_daily_points() returns (claimed, next_at, awarded)` | authenticated | Awards 100 once every 24h. |
| `award_reaction(best_avg_ms int) returns int` | authenticated | Server-computes the bounded 5–10 reaction reward and adds it. Rejects `< 100ms`. |
| `award_aim(best_score int) returns int` | authenticated | Server-computes the aim reward (`5 + score/2`, score clamped ≤200) and adds it. |
| `update_reaction_best(avg_ms int)` | authenticated | Writes the best avg only if better (lower). Rejects implausible `< 100ms`. |
| `update_aim_high_score(score int)` | authenticated | Writes the high score only if better. Rejects implausible `> 200`. |
| `submit_2048_result(top_tile int) returns (best, reward)` | authenticated | Updates best tile (`greatest`) + awards `5×(tile/64)`. Validates tile is a power of two ≤131072. |
| `blackjack_deal_stake(amount int)` | authenticated | First stake of a round: deducts points, **resets** the escrow `bj_open_stake`. |
| `blackjack_add_stake(amount int)` | authenticated | Double/split/insurance: deducts points, adds to the escrow. |
| `blackjack_settle(payout int) returns int` | authenticated | Pays out (**capped at 2.5× the escrow**), records casino stats, clears the escrow. |
| `roulette_multiplier(bet_id text, winning int)` | (helper) | Gross return factor for a bet (0/2/3/36). Mirrors `betDef`. |
| `roulette_spin(bets jsonb)` | authenticated | Server-authoritative: deducts wager, picks number, pays out, records stats. Returns `(winning, total_wagered, total_return, net, new_points)`. |
| `get_leaderboard_total / _reaction / _aim / _2048 / _casino_win / _casino_net (lim int)` | anon, authenticated | Public leaderboards, each filtering `username is not null`. |
| `add_points(amount int)`, `record_casino_result(net int)` | **revoked** | Legacy arbitrary-amount mutators. `hardening.sql` revokes EXECUTE from clients — kept only so old migrations don't error. Do not reintroduce grants. |

### RLS

- `profiles` has RLS enabled; three policies restrict read/insert/update to `auth.uid() = user_id` (insert/update now carry a `with check` so a row can't be repointed to another user).
- Leaderboard RPCs bypass RLS via `SECURITY DEFINER` and return only the public-safe columns (username + score).

### Security model (post-hardening)

Run `schema.sql` then **`hardening.sql`**. The model: **no client can inject points or fabricate scores; every point that enters the system is computed/owned server-side.** What `hardening.sql` enforces:

1. **Column-level write lockdown.** Supabase grants the `authenticated` role full column UPDATE/INSERT on public tables by default (RLS only gates *rows*, not *columns*). Hardening **revokes** that and re-grants writes to only the cosmetic columns (`username`, `theme_id`, `unlocks`, `updated_at`). Economic columns (`points`, `lifetime_points`, scores, `casino_*`, `g2048_high_score`) can therefore change **only** via the RPCs. A signed-in user running `supabase.from('profiles').update({points: 1e9})` is rejected.
2. **No generic point injection.** `add_points` / `record_casino_result` had their EXECUTE revoked. Rewards now come only from purpose-specific RPCs that derive the amount themselves and bound it.
3. **Plausibility guards.** Reaction `< 100ms` and aim `> 200` and non-power-of-two 2048 tiles are rejected.
4. **Server-authoritative / escrowed economy.** Roulette already owned its RNG. Blackjack now escrows stakes server-side and caps the settle payout at 2.5× the wager.

**Documented residuals** (acceptable for a portfolio arcade; noted at the bottom of `hardening.sql`): `unlocks` stays client-writable (free *cosmetics* only, no points/leaderboard impact); and a scripted user could grind blackjack always claiming the 2.5× cap. Fully closing the latter means dealing cards server-side like roulette.

### Migrating an existing project

[supabase/schema.sql](supabase/schema.sql) is idempotent. Re-running it picks up any new columns/RPCs via `alter table … add column if not exists` and `create or replace function`. Supabase's SQL editor will warn about destructive operations because of the guarded `drop policy if exists` — safe to ignore.

**Always run [supabase/hardening.sql](supabase/hardening.sql) after schema.sql** (also idempotent). Without it the economy is wide open (default column grants + arbitrary-amount RPCs). Order matters: schema.sql defines the functions hardening.sql then revokes/replaces.

---

## Extension cookbook

### Add a new theme

1. Open [src/lib/themes.ts](src/lib/themes.ts).
2. Append to the `themes` array. Required fields: `id`, `name`, `start`, `stop`. Optional: `locked`, `cost` (when locked), `rarity`, `accent1`, `accent2`, `text`, `font`, `titleShadow`.
3. If locked, it'll auto-appear in the shop.

### Modify theme prices / rarities

Edit the same array. `cost` is in points; `rarity` is `'blue' | 'purple' | 'red' | 'gold'`. Stars/crown follow the rarity automatically.

### Manually inject points / relock items (for testing)

```sql
-- Set balance
update public.profiles set points = 10000, lifetime_points = greatest(lifetime_points, 10000)
 where username = 'your-username';

-- Wipe unlocks (relock everything)
update public.profiles set unlocks = array[]::text[] where username = 'your-username';

-- Reset daily cooldown
update public.profiles set last_daily_claim = null where username = 'your-username';

-- Reset high scores (to retest leaderboard writes)
update public.profiles set best_reaction_avg = null, aim_high_score = 0, g2048_high_score = 0
 where username = 'your-username';

-- Reset casino stats
update public.profiles set casino_net = 0, casino_biggest_win = 0
 where username = 'your-username';
```

After running, sign out + back in to refresh client state (or rely on the existing `points-changed` event).

### Add a new game

1. Create `src/games/<id>/<GameName>.tsx` + `styles.css`.
2. Add a `<Route path="/games/<id>" element={<GameName … />}>` in [src/App.tsx](src/App.tsx).
3. Add an entry to the `games` array in [src/pages/HomePage.tsx](src/pages/HomePage.tsx) with a `path: '/games/<id>'`.
4. For per-game high scores: add a column on `profiles`, a write/award RPC, and a `get_leaderboard_<game>` RPC. Use the existing reaction/aim/2048 ones as a template — **the RPC must compute any points reward itself and bound it** (never accept a client-supplied amount), and validate score plausibility. Then add a `fetch<Game>Leaderboard` helper in [src/lib/leaderboards.ts](src/lib/leaderboards.ts) and a `<Leaderboard>` card in [src/pages/LeaderboardsPage.tsx](src/pages/LeaderboardsPage.tsx).
5. For theme integration, drive game colors from `:root` CSS vars set in the App.tsx theme effect (like 2048's `--g2048-*` and aim's `--aim-circle-*`), and use the shared `--shape-*` clip-paths instead of `border-radius`.

### Add a real image for a game card

Drop a file at `public/games/<id>.png` (or `.svg`/`.jpg`), then set `image: '/games/<id>.png'` on the game in [src/pages/HomePage.tsx](src/pages/HomePage.tsx). The placeholder gradient stops being used.

### Add a new shop section (e.g., avatars)

Add a second `<section className="shop-section">` to [src/pages/ShopPage.tsx](src/pages/ShopPage.tsx) with its own grid. The shop card classes are reusable.

---

## Gotchas / conventions

- **No `border-radius`.** All chamfered/octagonal corners come from `clip-path: var(--shape-…)` defined at the top of [App.css](src/App.css). Borders are faked with a colored outer background + a slightly-inset (`::before`) inner layer with the same clip-path.
- **High scores save the instant they're set**, not on unmount. This was a bug fix — fire-and-forget RPCs from cleanup functions were being killed by route navigation. The pattern is: save in the result-phase effect (aim) or the bestAvg-change effect (reaction). Only points stay in unmount (since they depend on session-wide bests).
- **`saveProfile` writes are explicit.** Avoid `useEffect`s that auto-save on every change — they cause re-save loops with the hydration effect. The pattern in App.tsx: `selectTheme`/`addUnlock` call `saveProfile` directly only in response to user actions.
- **Leaderboard rows require `username is not null`.** Anonymous profiles never appear. The LeaderboardsPage shows a banner reminding the user.
- **Don't put points/daily/shop on non-home routes.** App.tsx uses `useLocation()` and `isHome` to gate the top-right cluster.
- **The economy is server-guarded (post-hardening) — keep it that way.** There is no client-callable "add N points" RPC; every reward is computed and bounded server-side. When adding features, **never** grant a function that takes a client-supplied point amount, and never grant column UPDATE on economic columns. See "Security model". (History: the economy used to be fully client-trusted via `add_points`/`record_casino_result`; `hardening.sql` closed that.)
- **Casino backend.** Roulette is fully server-authoritative (`roulette_spin` owns RNG + payout). Blackjack computes the outcome client-side but the economy is server-guarded by escrow (`blackjack_deal_stake`/`add_stake`/`settle`, payout capped at 2.5× wager). Making blackjack dealing fully server-authoritative (like roulette) is the known next step to close the residual "always claim the cap" grind.
- **Reaction timing is paint-synced.** The waiting→ready color flip has **no CSS transition** (an eased flip inflated reaction times), and the clock starts inside a double `requestAnimationFrame` after the green frame paints, not when state is set.
- **Exit/back is universal.** All non-home pages use [components/BackButton.tsx](src/components/BackButton.tsx) (fixed top-center). Don't reintroduce per-game corner exit buttons.
