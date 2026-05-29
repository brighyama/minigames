# Minigames — Project Reference

A personal hub of small browser games (Reaction Test, Aim Trainer, more planned) with shared progression: accounts, points, daily bonuses, a shop, themes, achievement-style theme rarities, and leaderboards.

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
    leaderboards.ts           fetchTotalPointsLeaderboard / fetchReactionLeaderboard /
                              fetchAimLeaderboard helpers (thin wrappers over Supabase RPC calls).

  components/
    AuthPanel.tsx             Sign-in / Sign-up form OR signed-in view (username, password change,
                              sign out). Rendered inside the sidebar.
    DailyBonus.tsx             Top-right "+100" / countdown button. Pulls last_daily_claim, calls
                              claim_daily_points RPC.
    Leaderboard.tsx           Generic leaderboard card (loading/error/empty/data states, gold/silver/
                              bronze for ranks 1-3). Used in the LeaderboardsPage.
    RarityIcon.tsx            Renders 1/2/3 star SVGs for blue/purple/red, crown for gold.
                              rarityLabel() returns the accessible name.

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

### Theme rarity glow

- `Theme.rarity?: 'blue' | 'purple' | 'red' | 'gold'`.
- Visual indicator via [components/RarityIcon.tsx](src/components/RarityIcon.tsx): 1/2/3 stars for blue/purple/red, a crown SVG for gold (the "exclusive" tier).
- Glow effect: outer background swapped to the rarity color + `filter: drop-shadow(...)` traces the chamfered shape. Applied on both sidebar tiles and shop cards.

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
- Three boards so far: **Total Points**, **Reaction Time** (lower = better, formatted as `X ms`), **Aim Trainer** (higher = better).
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
