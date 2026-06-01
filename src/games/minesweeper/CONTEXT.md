# Minesweeper — game context

Classic timed minesweeper with three difficulty presets and a best-time
leaderboard per difficulty. See [PROJECT.md](../../../PROJECT.md) for site-wide
architecture (theming, economy, leaderboard framework, conventions).

## Gameplay

- Three presets (classic Windows sizes, chosen so times are world-comparable):
  - **easy** — 9×9, 10 mines
  - **medium** — 16×16, 40 mines
  - **hard** — 30×16, 99 mines
- **First-click safety:** mines are only placed on the first reveal, and never
  on the clicked cell or its 8 neighbours, so the opening click always opens a
  pocket and you can never lose on move one.
- **Timer** starts on the first reveal and stops on win/loss. Shown in the HUD
  next to the mine counter; the face button in the middle starts a new game.
- **Flagging:** right-click a hidden cell, or toggle **flag mode** (a button for
  touch devices) and tap. The mine counter shows `mines − flags`.
- **Chording:** clicking an already-revealed number whose adjacent flag count
  equals the number reveals all its remaining hidden neighbours at once.
- **New game** (the face button, or the overlay button) regenerates a brand-new
  puzzle for the current difficulty. Switching difficulty also starts a new one.
- Win = every non-mine cell revealed. Loss = a mine is uncovered (all mines are
  then exposed).

## Files

| File | Role |
| --- | --- |
| `lib.ts` | Pure logic: difficulty presets, board (flat array), mine seeding with first-click safety, flood-fill reveal, flag toggle, chord, win check, time formatting. No React/Supabase. |
| `MinesweeperGame.tsx` | Board UI, difficulty tabs, HUD (mine counter / face / timer), flag-mode toggle, win/loss overlay, server submit. |
| `styles.css` | Game styles (chamfered clip-paths, responsive grid driven by `--cols`). |

The chosen difficulty persists in `localStorage` under
`minigames:minesweeper:difficulty` (display-only convenience; not synced).

## Scoring & backend

- **Metric:** fastest clear time (ms) per difficulty — lower is better.
- **Reward (fixed per difficulty, server-computed):** easy 10, medium 25,
  hard 50. Fixed so it can't be inflated; only paid on a win.
- **`submit_minesweeper_result(difficulty text, time_ms int)`** validates the
  difficulty + a per-difficulty plausibility floor (easy 1s / medium 5s /
  hard 20s), updates the relevant account best via `least`, awards the reward.
  Returns `(best, reward)`.
- **Profile columns:** `mines_easy_ms`, `mines_medium_ms`, `mines_hard_ms`
  (`int`, null = no record).
- **Leaderboards:** three boards (Easy / Medium / Hard) via one parameterised
  RPC, `get_leaderboard_minesweeper(diff, lim)`, ranking by ascending time.

## Submission triggers

- A win submits exactly once, guarded by `submittedRef` (reset on every new
  game). Settlement runs inline in the reveal handler the moment `hasWon` is
  true — not from an unmount cleanup (those get killed by navigation; see the
  site-wide gotcha in PROJECT.md). Losses and signed-out wins never submit.

## Theming

- Cell **number colors (1–8) are constant across themes** for readability — same
  rationale as Tetris piece colors. The rest of the chrome (selected difficulty
  tab, win face, flag-mode toggle) is driven by the shared `--accent-1` /
  `--accent-2` vars set by the App.tsx theme effect, so the board still reskins
  with the active theme. No bespoke `palette.ts`.
