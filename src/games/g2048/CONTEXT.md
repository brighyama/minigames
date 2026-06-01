# 2048 — game context

Classic 4×4 2048 with a swappable built-in AI solver. See
[PROJECT.md](../../../PROJECT.md) for site-wide architecture (theming, economy,
leaderboard framework, conventions).

## Gameplay

- 4×4 board. Arrow keys / WASD / swipe. Win at the 2048 tile with an optional
  "Keep going". Fixed-size board (`grid-template-rows: repeat(4, 1fr)` +
  `aspect-ratio`) so empty rows never collapse; scales phone → desktop.
- **"Score" = the current game's highest tile; "Best" = the account's highest
  tile ever** (from `profiles.g2048_high_score`). There is no merge-points score.

## Files

| File | Role |
| --- | --- |
| `lib.ts` | Pure logic: board (flat 16-array), move/merge per direction, spawn, canMove, highestTile, hasWon. No React/Supabase. |
| `Game2048.tsx` | Board UI + keyboard/WASD/swipe, score/best boxes, win & game-over overlays, "Watch AI" toggle. |
| `styles.css` | Game styles (chamfered clip-paths). |
| `palette.ts` | Per-theme tile palettes. `applyTilePalette(root, themeId)` sets/clears `--g2048-bg-*`/`--g2048-fg-*` (called from App.tsx theme effect). |
| `solver/` | Modular AI solver package — `types.ts` (Solver interface), `expectimax.ts` (default), `index.ts` (`createSolver()` factory). |

## Scoring & backend

- **Points reward by top tile:** `5 × (top_tile / 64)` — 5 at 64, doubling each
  tile up (128→10, 256→20, 512→40, 1024→80, 2048→160, …). Computed server-side.
- **`submit_2048_result(top_tile int)`** validates the tile (power of two
  ≤131072), updates the account best via `greatest`, awards the points.
- **Profile column:** `g2048_high_score int` (highest tile ever, not a score).
- **Leaderboard:** "2048" via `get_leaderboard_2048`, ranks by best tile.

## Submission triggers

A non-AI game is submitted on **game over, leaving the page, or "New game"** —
whichever comes first.
- `submittedRef` guarantees one submit per game.
- `aiUsedRef` blocks any game the AI touched (AI-assisted games are never
  ranked or rewarded).
- Game-over submit runs from an **effect watching `over`**, not from inside the
  `setBoard` updater — that double-ran under StrictMode and dropped saves.

## Theming

- Tiles are theme-driven: `palette.ts` holds a curated 11-color palette per
  *unlockable* theme (mixes light/dark, rotates complementary hues, 2048 tile =
  the theme's signature color). The **4 default themes have no palette and fall
  back to the classic 2048 colors** baked into the tile CSS. Tile text color is
  auto-chosen per background by WCAG luminance. `applyTilePalette()` clears the
  vars on every theme switch so palettes never bleed.

## AI solver

- "Watch AI" toggle drives the board at a watchable cadence with a pluggable
  solver (default: depth-adaptive **expectimax**). To swap in your own (e.g. an
  RL policy), implement the `Solver` interface and return it from
  `createSolver()` in `solver/index.ts`.
