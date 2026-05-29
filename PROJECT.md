# Minigames — Project Reference

A personal hub of small browser games with shared progression: accounts, points, daily bonuses, a shop, themes, card decks, achievement-style rarities, and leaderboards. Two families of games:
- **Skill games** — Reaction Test, Aim Trainer (high-score based).
- **Casino games** — Blackjack, Roulette (wager points). Grouped under a "Casino" section on the home page.

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
supabase/
  schema.sql                  Full DB schema + RPC functions. Source of truth for Supabase setup.

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
                              Total / Reaction / Aim / CasinoWin / CasinoNet.
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
- Locked themes (5, in shop): **Mint, Candy, Ember, Midnight, Noir.**

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
- All mutations go through server RPCs (`add_points`, `spend_points`, `claim_daily_points`) — clients never write to these columns directly.
- Displayed in the top-right cluster (home page only).
- `window.dispatchEvent(new CustomEvent('points-changed'))` is the convention for triggering a fresh profile fetch in App.tsx. Any code that mutates points fires this.

### Daily bonus

- One-click +100 every 24h. RPC `claim_daily_points()` enforces the cooldown server-side (`last_daily_claim` timestamp). Returns `(claimed, next_at, awarded)`.
- Button lives to the left of the points badge in the top-right cluster.
- Available state: gold-orange gradient with gift-box icon. Cooldown state: live `HH:MM:SS` countdown that ticks every second.

### Shop

- Route `/shop`. Top-right shop bag icon links to it (home-only).
- One section per cosmetic category. Currently: **Themes** (auto-renders one card per `theme.locked === true`).
- Cards show the rarity icon, gradient preview, price tag, and a buy button. Owned themes show only the "Owned" tag — no button.
- Buy flow: `spend_points` RPC → on success, `onUnlock(themeId)` is called by `ShopPage` which is passed down from App; App appends to `unlocks` state + persists to profile.

### Toasts

- Global queue in [src/lib/toast.tsx](src/lib/toast.tsx), `useToast().show(message, { tone, durationMs })`.
- Tones: `info`, `success` (green border), `error` (red border).
- Auto-dismiss after 3000ms.
- Bottom-right fixed viewport; toasts use the same polygonal clip-path as the rest of the UI.

### Leaderboards

- Route `/leaderboards`. Cards rendered in a responsive grid.
- Five boards: **Total Points**, **Reaction Time** (lower = better, `X ms`), **Aim Trainer**, **Biggest Win** (single casino round), **Casino Net** (cumulative, can be negative — signed display).
- All three driven by `SECURITY DEFINER` RPCs that filter `username is not null`. Users without a username never appear — the page shows a gold banner reminding them to set one.

### Games

#### Reaction Test (`src/games/reaction/`)

- Full-screen. Click anywhere to start a round. After a random 1.5–5s delay, the background flips from `--accent-1` to `--accent-2`. Click as soon as it flips. Clicking too early = "Too soon".
- Top of screen: live list of the last 5 reactions, plus a rolling 5-window average once 5 have been recorded, plus the user's all-time best avg.
- High score = lowest rolling 5-window avg ever recorded (ms). **Saved immediately** when a new low is achieved during play (RPC `update_reaction_best`), not on exit.
- Points on exit: 5–10 based on the session's best 5-avg (10 for ≤250ms, -1 per 10ms above, floor 5). RPC `add_points`.

#### Aim Trainer (`src/games/aim/`)

- Large centered card (not full-screen). HUD shows time remaining + current score.
- 20-second round. One 60px circle on screen at a time; clicking it scores 1 point and immediately spawns the next. Circles persist until clicked or until the timer ends.
- Circles use `radial-gradient(--accent-2, --accent-1)` — themed automatically.
- Rarity-driven hit effects (read from `theme.rarity` passed as prop from App):
  - **Red (★★★)** — 8-particle gravity explosion using accent colors.
  - **Gold (♛)** — 14-particle outward sparkle, no gravity, gold color.
  - Anything else — no effect.
- High score = most circles in a single round. **Saved immediately when a round ends** if it's a new personal best (RPC `update_aim_high_score`).
- Points on exit: `5 + Math.floor(best_session_score / 2)`. Minimum 5 for completing at least one full 20s round.

#### Blackjack (`src/games/blackjack/`)

- 6-deck shoe, dealer stands on all 17s (S17), blackjack pays 3:2. Hit / Stand / Double / Split / Insurance.
- Backend: **optimistic** (hybrid model). Outcome is computed client-side; each stake calls `spend_points`, the settle calls `add_points(totalReturn)` + `record_casino_result(net)`. Local `balance` (seeded from `points`) drives the UI instantly. Signed-out = local demo bankroll.

#### Roulette (`src/games/roulette/`)

- European single-zero wheel. Animated canvas wheel + ball physics (continuous spin; ball rides its pocket between rounds). Standard felt: straight numbers + columns / dozens / red-black / even-odd / 1-18 / 19-36. Recent 10 numbers shown.
- **Autonomous round loop** runs forever (betting 12s → spinning 6.5s → result 4.5s) even with no bet, so the wheel can be watched idle.
- Backend: **server-authoritative** when signed in AND bets are placed — `roulette_spin(bets)` RPC picks the number + computes payout + moves points atomically, returning the number the client then animates to. No-bet rounds and signed-out play use local RNG.
- StrictMode-safe: round-id guard (`settledRoundRef`) makes settlement idempotent; the spin RPC only fires from the `spinning` phase effect (not the double-invoked mount effect).

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
| `casino_net` | `bigint` | Cumulative casino net (can be negative). Drives Casino Net board. |
| `casino_biggest_win` | `int` | Best single-round net win. Drives Biggest Win board. |
| `updated_at` | `timestamptz` | Touched on every write. |

### RPC functions (all `SECURITY DEFINER`)

| Function | Who | Purpose |
| --- | --- | --- |
| `handle_new_user()` | trigger | Creates a profile row on `auth.users` insert. |
| `add_points(amount int)` | authenticated | Atomically increments points + lifetime_points. |
| `spend_points(amount int) returns boolean` | authenticated | Decrements points only if balance suffices. |
| `claim_daily_points() returns (claimed, next_at, awarded)` | authenticated | Awards 100 once every 24h. |
| `update_reaction_best(avg_ms int)` | authenticated | Writes only if better (lower). |
| `update_aim_high_score(score int)` | authenticated | Writes only if better (higher). |
| `get_leaderboard_total(lim int)` | anon, authenticated | Lifetime points, descending. |
| `get_leaderboard_reaction(lim int)` | anon, authenticated | Best reaction avg, ascending. |
| `get_leaderboard_aim(lim int)` | anon, authenticated | Aim high score, descending. |
| `roulette_multiplier(bet_id text, winning int)` | (helper) | Gross return factor for a bet (0/2/3/36). Mirrors `betDef`. |
| `roulette_spin(bets jsonb)` | authenticated | Server-authoritative: deducts wager, picks number, pays out, records stats. Returns `(winning, total_wagered, total_return, net, new_points)`. |
| `record_casino_result(net int)` | authenticated | Updates `casino_net` + `casino_biggest_win` (for client-settled games like blackjack). |
| `get_leaderboard_casino_win(lim int)` | anon, authenticated | Biggest single-round win, descending. |
| `get_leaderboard_casino_net(lim int)` | anon, authenticated | Cumulative casino net, descending. |

### RLS

- `profiles` has RLS enabled; three policies restrict read/insert/update to `auth.uid() = user_id`.
- Leaderboard RPCs bypass RLS via `SECURITY DEFINER` and return only the public-safe columns (username + score).

### Migrating an existing project

[supabase/schema.sql](supabase/schema.sql) is idempotent. Re-running it picks up any new columns/RPCs via `alter table … add column if not exists` and `create or replace function`. Supabase's SQL editor will warn about destructive operations because of the guarded `drop policy if exists` — safe to ignore.

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
update public.profiles set best_reaction_avg = null, aim_high_score = 0
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
4. For per-game high scores: add a column on `profiles`, an `update_<game>_high_score` RPC, and a `get_leaderboard_<game>` RPC. Use the existing reaction/aim ones as a template. Then add a `fetch<Game>Leaderboard` helper in [src/lib/leaderboards.ts](src/lib/leaderboards.ts) and a `<Leaderboard>` card in [src/pages/LeaderboardsPage.tsx](src/pages/LeaderboardsPage.tsx).

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
- **Casino backend is hybrid.** Roulette is server-authoritative (`roulette_spin` owns RNG + payout). Blackjack is optimistic (client computes outcome, mirrors stakes/payout via `spend_points`/`add_points`). This was a deliberate effort/security trade-off — note the **whole economy is already client-trusted**: `add_points`/`spend_points` accept arbitrary amounts from any signed-in user, so optimistic blackjack isn't a regression. Hardening blackjack into a server-side hand state machine is a known future option.
- **Reaction timing is paint-synced.** The waiting→ready color flip has **no CSS transition** (an eased flip inflated reaction times), and the clock starts inside a double `requestAnimationFrame` after the green frame paints, not when state is set.
- **Exit/back is universal.** All non-home pages use [components/BackButton.tsx](src/components/BackButton.tsx) (fixed top-center). Don't reintroduce per-game corner exit buttons.
