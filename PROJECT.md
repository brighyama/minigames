# Minigames — Project Reference

A personal hub of small browser games with shared progression: accounts, points, daily bonuses, a shop, themes, card decks, achievement-style rarities, and leaderboards. Two families of games:
- **Skill games** — Reaction Test, Aim Trainer, 2048, Tetris, Daily Word, Chess, Minesweeper.
- **Casino games** — Blackjack, Roulette, Cases (wager points). Grouped under a "Casino" section on the home page.

**One unified visual theme spans every game.** The active theme reskins the whole surface — page gradient, accents, card decks, and per-game palettes — and every game uses the same chamfered `clip-path` geometry (never `border-radius`). See "Unified theming across games" below.

**Deployment:** static SPA (`npm run build` → `dist/`) hosted on Vercel at `games.brightenhayama.dev` (a subdomain of the GitHub-Pages portfolio). [vercel.json](vercel.json) provides the SPA fallback rewrite so client-side routes deep-link correctly.

This file is the **catch-up doc for new chats**: it covers the high-level structure, the shared/cross-cutting systems (theming, economy, leaderboards, DB, security), and the conventions. **Game-specific details live next to each game** — every folder in `src/games/<game>/` has a `CONTEXT.md`. Read that file before working on a game.

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
                              home-only), all <Route> declarations, and the theme effect that pushes
                              theme state into every game's CSS variables.
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
    themes.ts                 The Theme type + the themes array. Edit to add / reprice / reskin a theme.
                              Also exports DEFAULT_ACCENT_1 / DEFAULT_ACCENT_2.
    leaderboards.ts           fetch*Leaderboard helpers (thin wrappers over Supabase RPC calls).
    cardDecks.ts              CardDeck type + cardDecks array. Active deck writes --card-* CSS vars.

  components/
    AuthPanel.tsx             Sign-in / Sign-up form OR signed-in view. Rendered inside the sidebar.
    DailyBonus.tsx            Top-right "+100" / countdown button. Calls claim_daily_points RPC.
    Leaderboard.tsx           Generic leaderboard card (loading/error/empty/data states, podium 1-3).
    RarityIcon.tsx            1/2/3/4 star SVGs for green/blue/purple/red, crown for gold.
    BackButton.tsx            Universal fixed top-center exit/back button. Used on every non-home page.

  pages/
    HomePage.tsx              Hero + grids of game cards (skill games, then a Casino section).
    LeaderboardsPage.tsx      Grid of Leaderboard cards. Gold banner if signed-out / no username.
    ShopPage.tsx              Sections of purchasable cosmetics (themes, card decks).

  games/                      One folder per game. Each has a CONTEXT.md with its gameplay, files,
                              backend, theming, and gotchas — read it before working on that game.
    reaction/                 Full-screen reaction-time test.            → reaction/CONTEXT.md
    aim/                      20s click-the-target trainer.              → aim/CONTEXT.md
    g2048/                    Classic 2048 + swappable AI solver.        → g2048/CONTEXT.md
    tetris/                   TETR.IO-style Sprint 40L (canvas).         → tetris/CONTEXT.md
    wordle/                   Date-seeded daily 5-letter word game.      → wordle/CONTEXT.md
    blackjack/                6-deck blackjack, escrowed economy.        → blackjack/CONTEXT.md
    roulette/                 European roulette, server-authoritative.   → roulette/CONTEXT.md
    cases/                    CS-style case opening, server-authoritative.→ cases/CONTEXT.md
    chess/                    Vs a built-in engine. No backend.          → chess/CONTEXT.md
    minesweeper/              Timed classic minesweeper, 3 difficulties. → minesweeper/CONTEXT.md
```

---

## Games index

| Game | Route | Folder | Scoring metric | Backend |
| --- | --- | --- | --- | --- |
| Reaction Test | `/games/reaction` | `reaction/` | Lowest rolling-5 avg (ms) | `award_reaction`, `update_reaction_best` |
| Aim Trainer | `/games/aim` | `aim/` | Most targets in 20s | `award_aim`, `update_aim_high_score` |
| 2048 | `/games/2048` | `g2048/` | Highest tile reached | `submit_2048_result` |
| Tetris | `/games/tetris` | `tetris/` | Fastest 40-line sprint (ms) | `submit_tetris_result` |
| Daily Word | `/games/wordle` | `wordle/` | Best daily solve streak | `submit_wordle_result` |
| Blackjack | `/games/blackjack` | `blackjack/` | Casino net / biggest win | `blackjack_deal_stake`/`add_stake`/`settle` |
| Roulette | `/games/roulette` | `roulette/` | Casino net / biggest win | `roulette_spin` (server-authoritative) |
| Cases | `/games/cases` | `cases/` | Casino net / biggest win | `cases_open` (server-authoritative) |
| Chess | `/games/chess` | `chess/` | — (no scoring) | none |
| Minesweeper | `/games/minesweeper` | `minesweeper/` | Fastest clear per difficulty (ms) | `submit_minesweeper_result` |

Each game's `CONTEXT.md` is the source of truth for its mechanics, points formula, theming hooks, and gotchas. The shared backend contract (columns + RPCs) is in the [Database](#database) section below.

---

## Cross-cutting systems

### Auth + profile

- Email/password via Supabase. AuthPanel lives in the sidebar (top section).
- Each user has one row in `public.profiles`, created by a trigger on `auth.users` insert (see schema).
- Username is editable in the AuthPanel signed-in view and is the column that drives leaderboard visibility.

### Themes

- Defined in [src/lib/themes.ts](src/lib/themes.ts) — `Theme` type + `themes` array (first = default for new users).
- Active theme writes these CSS variables on `:root`:
  - `--bg-start` / `--bg-stop` — full-page linear gradient (fixed-attached on `body`).
  - `--theme-text`, `--theme-font`, `--theme-title-shadow` — typography overrides.
  - `--accent-1` / `--accent-2` — general-purpose color slots that any game can read.
- Default themes (4, unlocked): **Classic, Forest, Lilac, Mono.**
- Locked themes (**15**, in the shop), grouped by rarity tier (priced per-item within each tier):
  - **green (40–60):** Mint 40, Aqua 50, Sakura 60
  - **blue (150–250):** Candy 150, Sunset 200, Glacier 250
  - **purple (600–900):** Ember 600, Amethyst 750, Verdant 900
  - **red (2k–3k):** Midnight 2,000, Synthwave 2,500, Inferno 3,000
  - **gold (8k–12k):** Noir 8,000, Celestial 10,000, Eclipse 12,000
- Higher tiers layer on more flourish: green = gradient + accents only; blue adds a tuned text color; purple does full text theming; red/gold add display fonts and glowing title shadows.

### Unified theming across games

The goal is that **every game looks like part of the same site** under whatever theme is active. **The App.tsx theme effect is the single place** that pushes theme state into game-specific CSS variables on `:root`. Each game then reads those vars (the per-game palette logic and exact var names are documented in that game's `CONTEXT.md`):

- **Geometry.** No game uses `border-radius`. All panels, tiles, buttons, and overlays use the shared `clip-path` chamfer shapes (`--shape-octagon`, `--shape-octagon-sm`, `--shape-diagonal`) defined at the top of [App.css](src/App.css).
- **Per-game color hooks** set by the theme effect:
  - `--accent-1/2` — reaction backgrounds, aim/tetris accents, particles (general-purpose).
  - `--aim-circle-a/b` — aim-trainer target gradient (`aim/palette` behavior).
  - `--g2048-bg-*/--g2048-fg-*` — 2048 tile palette (`applyTilePalette`).
  - `--chess-light/dark/hint/capture` — chess board (`applyChessPalette`).
  - `--card-*` — blackjack card deck (from the active card deck).
- **Default vs unlockable themes.** The 4 default themes generally fall back to each game's classic/neutral colors; unlockable themes get bespoke per-game palettes. Tetris is the exception: its pieces keep constant colors across all themes (readability is a gameplay requirement) and theme only via the board chrome — see `tetris/CONTEXT.md`.

### Rarity glow (themes + card decks)

- `Rarity = 'green' | 'blue' | 'purple' | 'red' | 'gold'` (in [themes.ts](src/lib/themes.ts); shared by card decks).
- Visual indicator via [components/RarityIcon.tsx](src/components/RarityIcon.tsx): 1/2/3/4 stars for green/blue/purple/red, a crown SVG for gold (the "exclusive" tier).
- Glow effect: outer background swapped to the rarity color + `filter: drop-shadow(...)` traces the chamfered shape. Applied on sidebar tiles and shop cards.
- **Cost tiers** follow a compressed "collectible" ladder, priced per-item within each rarity: green ~40–60, blue ~150–250, purple ~600–900, red ~2k–3k, gold ~8k–12k (reachable given the flat game rewards). Casino chips are a small flat set: **10 / 25 / 100 / 500 / 1,000** (colored green→gold to echo the rarity order, but no longer 1:1 with the price tiers).

### Card decks

- Defined in [src/lib/cardDecks.ts](src/lib/cardDecks.ts) — `CardDeck` type + `cardDecks` array (first = default, always unlocked).
- Active deck writes `--card-face`, `--card-red`, `--card-black`, `--card-back`, `--card-border`, `--card-font` on `:root` from [App.tsx](src/App.tsx). Blackjack's `Card.tsx` consumes them, so a deck change reskins cards live.
- Selector lives in the sidebar (below Theme). Locked decks auto-appear in the Shop "Card decks" section. Decks: **Classic** (free), **Mono** (green), **Neon** (purple), **Royal** (red).
- NOTE: deck choice is **localStorage-only** (`minigames:deck`) — no `deck_id` profile column yet, so it doesn't sync across devices.

### Selected-cosmetic indicator

- The active theme/deck tile shows a translucent checkmark overlay (`.theme-option.is-selected::after` in [App.css](src/App.css)). The hover-name label sits above it (`z-index: 3`).

### Points + lifetime points

- `profiles.points` (spendable balance) and `profiles.lifetime_points` (monotonic, drives the Total Points leaderboard).
- All point gains go through **purpose-specific server RPCs that compute the amount themselves** (`award_reaction`, `award_aim`, `submit_2048_result`, `submit_tetris_result`, `claim_daily_points`, `roulette_spin`, `blackjack_settle`). There is **no generic "add N points" endpoint** callable by clients — see "Security model". `spend_points` (shop) is the only remaining client-callable mutation, and it can only *decrease* points.
- Displayed in the top-right cluster (home page only).
- `window.dispatchEvent(new CustomEvent('points-changed'))` is the convention for triggering a fresh profile fetch in App.tsx. Any code that mutates points fires this.

### Daily bonus

- One-click +100 every 24h. RPC `claim_daily_points()` enforces the cooldown server-side (`last_daily_claim` timestamp). Returns `(claimed, next_at, awarded)`.
- Button lives to the left of the points badge in the top-right cluster. Available state: gold-orange gift-box. Cooldown state: live `HH:MM:SS` countdown.

### Shop

- Route `/shop`. Top-right shop bag icon links to it (home-only).
- One section per cosmetic category: **Themes** (one card per `theme.locked === true`) and **Card decks** (one card per `deck.locked === true`, fanned 3-card preview).
- Buy flow: `spend_points` RPC → on success, `onUnlock(themeId)` bubbles the unlock back into App state + persists to profile.

### Toasts

- Global queue in [src/lib/toast.tsx](src/lib/toast.tsx), `useToast().show(message, { tone, durationMs })`.
- Tones: `info`, `success` (green border), `error` (red border). Auto-dismiss after 3000ms. Bottom-right fixed viewport, polygonal clip-path.

### Leaderboards

- Route `/leaderboards`. Cards rendered in a responsive grid.
- Eleven boards: **Total Points**, **Reaction Time** (lower = better, `X ms`), **Aim Trainer**, **2048** (best tile), **Tetris Sprint** (lower = better, 40-line time), **Daily Word** (best solve streak), **Minesweeper · Easy/Medium/Hard** (lower = better, clear time), **Biggest Win** (single casino round), **Casino Net** (cumulative, signed display).
- All driven by `SECURITY DEFINER` RPCs that filter `username is not null`. Users without a username never appear — the page shows a gold banner reminding them to set one.

### Home page categories & top-right cluster

- [HomePage.tsx](src/pages/HomePage.tsx) renders two grids: skill games up top, then a **Casino** section (`.home-section` + `.home-section-title`).
- The points badge, daily-bonus button, and shop link **only render on `/`** (App.tsx gates the cluster with `useLocation()`/`isHome`). Other routes hide them.

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
| `g2048_high_score` | `int` | Highest **tile** ever reached in 2048 (e.g. 2048), not a merge score. |
| `tetris_sprint_ms` | `int` | Best time (ms) to clear 40 lines in Tetris Sprint. Null = no record. **Lower is better.** |
| `wordle_last_day` | `int` | UTC day index of the last submitted Daily Word puzzle. Null = never played. |
| `wordle_streak` | `int` | Current consecutive-day solve streak. |
| `wordle_best_streak` | `int` | Max streak ever. Drives the Daily Word leaderboard. |
| `wordle_wins` / `wordle_played` | `int` | Total puzzles solved / attempted. |
| `mines_easy_ms` / `mines_medium_ms` / `mines_hard_ms` | `int` | Best clear time (ms) per Minesweeper difficulty. Null = no record. **Lower is better.** |
| `casino_net` | `bigint` | Cumulative casino net (can be negative). Drives Casino Net board. |
| `casino_biggest_win` | `int` | Best single-round net win. Drives Biggest Win board. |
| `bj_open_stake` | `bigint` | Server-side blackjack escrow: points staked in the current open round. 0 between rounds. |
| `updated_at` | `timestamptz` | Touched on every write. |

### RPC functions (all `SECURITY DEFINER`)

Grants below reflect the **post-`hardening.sql`** state (run schema.sql, then hardening.sql). Per-game reward formulas/validation are documented in each game's `CONTEXT.md`.

| Function | Who | Purpose |
| --- | --- | --- |
| `handle_new_user()` | trigger | Creates a profile row on `auth.users` insert. |
| `spend_points(amount int) returns boolean` | authenticated | Decrements points only if balance suffices (shop). Can only *decrease*. |
| `claim_daily_points() returns (claimed, next_at, awarded)` | authenticated | Awards 100 once every 24h. |
| `award_reaction(best_avg_ms int) returns int` | authenticated | Server-computes the bounded 5–10 reaction reward. Rejects `< 100ms`. |
| `award_aim(best_score int) returns int` | authenticated | Server-computes the aim reward (`5 + score/2`, score clamped ≤200). |
| `update_reaction_best(avg_ms int)` | authenticated | Writes the best avg only if better (lower). Rejects `< 100ms`. |
| `update_aim_high_score(score int)` | authenticated | Writes the high score only if better. Rejects `> 200`. |
| `submit_2048_result(top_tile int) returns (best, reward)` | authenticated | Updates best tile (`greatest`) + awards `5×(tile/64)`. Validates power of two ≤131072. |
| `submit_tetris_result(time_ms int, lines int) returns (best, reward)` | authenticated | Requires `lines = 40`; rejects `< 8000ms`. Updates best (`least`) + awards a tiered reward: 40 base, +15 under 2min, +30 under 1min (stacking, max 85). |
| `submit_wordle_result(puzzle_day int, guesses int, solved bool) returns (streak, best_streak, reward)` | authenticated | Requires `puzzle_day = current UTC day` (no backfill); idempotent per day. Updates streak + awards solve-only `5 + (6−guesses)*5` (max 30). |
| `submit_minesweeper_result(difficulty text, time_ms int) returns (best, reward)` | authenticated | Validates difficulty + per-difficulty time floor (easy 1s / medium 5s / hard 20s). Updates that difficulty's best (`least`) + awards a fixed reward (easy 10 / medium 25 / hard 50). |
| `blackjack_deal_stake(amount int)` | authenticated | First stake of a round: deducts points, **resets** the escrow `bj_open_stake`. |
| `blackjack_add_stake(amount int)` | authenticated | Double/split/insurance: deducts points, adds to the escrow. |
| `blackjack_settle(payout int) returns int` | authenticated | Pays out (**capped at 2.5× the escrow**), records casino stats, clears the escrow. |
| `roulette_multiplier(bet_id text, winning int)` | (helper) | Gross return factor for a bet (0/2/3/36). Mirrors `betDef`. |
| `roulette_spin(bets jsonb)` | authenticated | Server-authoritative: deducts wager, picks number, pays out, records stats. |
| `cases_open(case_id text, wager int) returns (item_index, mult_x100, payout, net, new_points)` | authenticated | Server-authoritative case open: deducts wager, weighted-draws an item, pays `wager×multiplier`, records casino stats. Item tables mirror `src/games/cases/lib.ts`. |
| `get_leaderboard_total / _reaction / _aim / _2048 / _tetris / _wordle / _casino_win / _casino_net (lim int)` | anon, authenticated | Public leaderboards, each filtering `username is not null`. |
| `get_leaderboard_minesweeper(diff text, lim int)` | anon, authenticated | Public per-difficulty Minesweeper board (fastest time asc). `diff` ∈ easy/medium/hard. |
| `add_points(amount int)`, `record_casino_result(net int)` | **revoked** | Legacy arbitrary-amount mutators. `hardening.sql` revokes EXECUTE. Do not reintroduce grants. |

### RLS

- `profiles` has RLS enabled; three policies restrict read/insert/update to `auth.uid() = user_id` (insert/update carry a `with check` so a row can't be repointed to another user).
- Leaderboard RPCs bypass RLS via `SECURITY DEFINER` and return only the public-safe columns (username + score).

### Security model (post-hardening)

Run `schema.sql` then **`hardening.sql`**. The model: **no client can inject points or fabricate scores; every point that enters the system is computed/owned server-side.** What `hardening.sql` enforces:

1. **Column-level write lockdown.** Supabase grants the `authenticated` role full column UPDATE/INSERT on public tables by default (RLS only gates *rows*, not *columns*). Hardening **revokes** that and re-grants writes to only the cosmetic columns (`username`, `theme_id`, `unlocks`, `updated_at`). Economic columns (`points`, `lifetime_points`, all scores, `casino_*`) change **only** via the RPCs. A signed-in user running `supabase.from('profiles').update({points: 1e9})` is rejected.
2. **No generic point injection.** `add_points` / `record_casino_result` had their EXECUTE revoked. Rewards come only from purpose-specific RPCs that derive the amount themselves and bound it.
3. **Plausibility guards.** Reaction `< 100ms`, aim `> 200`, non-power-of-two 2048 tiles, and Tetris sprints `< 8000ms` / `lines ≠ 40` are rejected.
4. **Server-authoritative / escrowed economy.** Roulette owns its RNG. Blackjack escrows stakes server-side and caps the settle payout at 2.5× the wager.

**Documented residuals** (acceptable for a portfolio arcade; noted at the bottom of `hardening.sql`): `unlocks` stays client-writable (free *cosmetics* only); and a scripted user could grind blackjack always claiming the 2.5× cap. Fully closing the latter means dealing cards server-side like roulette.

### Migrating an existing project

[supabase/schema.sql](supabase/schema.sql) is idempotent. Re-running it picks up new columns/RPCs via `alter table … add column if not exists` and `create or replace function`. **Always run [supabase/hardening.sql](supabase/hardening.sql) after schema.sql** (also idempotent). Order matters: schema.sql defines the functions hardening.sql then revokes/replaces.

---

## Extension cookbook

### Add a new theme

1. Open [src/lib/themes.ts](src/lib/themes.ts).
2. Append to the `themes` array. Required: `id`, `name`, `start`, `stop`. Optional: `locked`, `cost`, `rarity`, `accent1`, `accent2`, `text`, `font`, `titleShadow`.
3. If locked, it auto-appears in the shop.

### Manually inject points / relock items (for testing)

```sql
-- Set balance
update public.profiles set points = 10000, lifetime_points = greatest(lifetime_points, 10000)
 where username = 'your-username';

-- Wipe unlocks / reset daily / reset scores / reset casino
update public.profiles set unlocks = array[]::text[] where username = 'your-username';
update public.profiles set last_daily_claim = null where username = 'your-username';
update public.profiles set best_reaction_avg = null, aim_high_score = 0,
       g2048_high_score = 0, tetris_sprint_ms = null where username = 'your-username';
update public.profiles set casino_net = 0, casino_biggest_win = 0 where username = 'your-username';
```

After running, sign out + back in to refresh client state (or rely on the existing `points-changed` event).

### Add a new game

1. Create `src/games/<id>/<GameName>.tsx` + `styles.css`, and a **`CONTEXT.md`** documenting the game (gameplay, files, backend, theming, gotchas) — mirror an existing game's CONTEXT.md.
2. Add a `<Route path="/games/<id>" element={<GameName … />}>` in [src/App.tsx](src/App.tsx).
3. Add an entry to the `games` array (or `casinoGames`) in [src/pages/HomePage.tsx](src/pages/HomePage.tsx): `{ id, name, tagline, path: '/games/<id>', gradient }`. The home page lists games as compact monogram tiles (a small gradient chip with the name's first letter + a one-line tagline) — no per-game artwork needed.
4. For per-game high scores: add a column on `profiles`, a write/award RPC, and a `get_leaderboard_<game>` RPC. Use the existing reaction/aim/2048/tetris ones as templates — **the RPC must compute any points reward itself and bound it** (never accept a client-supplied amount), and validate score plausibility. Then add a `fetch<Game>Leaderboard` helper in [src/lib/leaderboards.ts](src/lib/leaderboards.ts) and a `<Leaderboard>` card in [src/pages/LeaderboardsPage.tsx](src/pages/LeaderboardsPage.tsx).
5. For theme integration, drive game colors from `:root` CSS vars set in the App.tsx theme effect, and use the shared `--shape-*` clip-paths instead of `border-radius`.
6. Add the game to the [Games index](#games-index) table above.

### Restyle a game's home-page tile

Each game tile is a compact row: a gradient **monogram chip** (the name's first letter on the game's `gradient`) + name + `tagline`. To tweak a game's look, edit its `gradient`/`tagline` in [src/pages/HomePage.tsx](src/pages/HomePage.tsx); tile styling lives in `.game-tile`/`.game-mono` in [App.css](src/App.css). (There is no per-game image system — the dense monogram layout exists precisely so the catalog looks intentional without bespoke art.)

### Add a new shop section (e.g., avatars)

Add a second `<section className="shop-section">` to [src/pages/ShopPage.tsx](src/pages/ShopPage.tsx) with its own grid. The shop card classes are reusable.

---

## Gotchas / conventions (cross-cutting)

Game-specific gotchas live in each game's `CONTEXT.md`. These apply site-wide:

- **No `border-radius`.** All chamfered/octagonal corners come from `clip-path: var(--shape-…)` defined at the top of [App.css](src/App.css). Borders are faked with a colored outer background + a slightly-inset (`::before`) inner layer with the same clip-path.
- **High scores save the instant they're set**, not on unmount. Fire-and-forget RPCs from cleanup functions get killed by route navigation, so save in the result-phase effect. Only session-wide-dependent point awards stay in unmount.
- **`saveProfile` writes are explicit.** Avoid `useEffect`s that auto-save on every change — they cause re-save loops with the hydration effect. `selectTheme`/`addUnlock` call `saveProfile` directly only in response to user actions.
- **`saveProfile` uses UPDATE, not UPSERT.** An upsert compiles to `INSERT … ON CONFLICT DO UPDATE SET …` that includes `user_id` in the SET clause, but `hardening.sql` grants column-level UPDATE only on the cosmetic columns (not `user_id`) — so an upsert fails with *"permission denied for table profiles"*. `saveProfile` updates the existing row (created by the `handle_new_user` trigger) and only falls back to insert if no row matched. Don't switch it back to `.upsert()`.
- **Leaderboard rows require `username is not null`.** Anonymous profiles never appear; the LeaderboardsPage shows a banner reminding the user.
- **Don't put points/daily/shop on non-home routes.** App.tsx gates the top-right cluster with `useLocation()`/`isHome`.
- **The economy is server-guarded (post-hardening) — keep it that way.** No client-callable "add N points" RPC; every reward is computed and bounded server-side. When adding features, **never** grant a function that takes a client-supplied point amount, and never grant column UPDATE on economic columns.
- **Exit/back is universal.** All non-home pages use [components/BackButton.tsx](src/components/BackButton.tsx) (fixed top-center). Don't reintroduce per-game corner exit buttons.
- **StrictMode-safety.** Several games run effects that fire RPCs; guard them against StrictMode's double-invoke (one-submit refs, round-id guards). See the relevant game's CONTEXT.md.
