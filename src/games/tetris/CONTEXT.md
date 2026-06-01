# Tetris — game context

A TETR.IO-style **Sprint** (clear 40 lines as fast as possible). Canvas-rendered
with guideline mechanics. See [PROJECT.md](../../../PROJECT.md) for site-wide
architecture (theming, economy, leaderboard framework, conventions).

## Gameplay

- **Sprint 40L:** clear 40 lines; fastest time wins. A 3-2-1 countdown precedes
  each run; the timer starts on "go".
- 10×20 visible playfield with a hidden spawn buffer above (the board is
  internally `WIDTH=10 × HEIGHT=40`, `VISIBLE=20`; pieces spawn in the buffer
  and fall into view).
- **Controls:** ←/→ move, ↓ soft drop, space hard drop, ↑/X rotate CW, Z rotate
  CCW, A 180, Shift/C hold.

## Mechanics ("the feel")

- **SRS** (Super Rotation System) with full wall-kick tables — separate tables
  for JLSTZ and I, plus a compact **180-spin** kick table.
- **7-bag randomizer** — every group of 7 contains each tetromino once.
- **Hold** (one swap per piece), 5-piece **next** queue, **ghost** piece.
- **Lock delay** (500ms) with capped move/rotation resets (`MAX_LOCK_RESETS`,
  "infinity"-lite) so you can slide/spin on the floor briefly before locking.
- **Manual DAS/ARR** input handling (not OS key-repeat): `DAS_MS` delay before
  auto-shift, `ARR_MS` repeat interval (0 = slam straight to the wall). This is
  the core of the responsive feel.
- **T-spin detection** (3-corner rule, full vs mini), **combo** counter,
  **back-to-back** chain, and **perfect clear** — all tracked for juice/stats.
  The leaderboard metric is **purely the 40-line time**, not a score.
- All handling constants live at the top of `TetrisGame.tsx`
  (`GRAVITY_MS`, `SOFT_DROP_MS`, `LOCK_DELAY_MS`, `MAX_LOCK_RESETS`, `DAS_MS`,
  `ARR_MS`, `NEXT_COUNT`).

## Files

| File | Role |
| --- | --- |
| `lib.ts` | Pure engine: tetromino shapes, SRS rotation + kick tables, 7-bag (`SevenBag`), board ops, `collides`/`tryMove`/`tryRotate`/`hardDropPosition`/`lockPiece`/`clearLines`, `detectTSpin`, combo/B2B helpers. No React/Supabase. |
| `TetrisGame.tsx` | Canvas renderer + fixed-timestep game loop, input handling, hold/next/ghost, Sprint logic, HUD, overlays, and juice. |
| `palette.ts` | Constant per-piece colors (`PIECE_COLORS`/`PIECE_HIGHLIGHTS`) + `typeForId`. |
| `styles.css` | Chamfered clip-path styling; board glow + particles read `--accent-1/2`. |

## Architecture notes

- **State lives in refs, not React state.** `gameRef` (the mutable
  `GameState`), `statusRef`, `countdownRef`, etc. are read/written by the rAF
  loop so the loop never forces a per-frame re-render. React state is used only
  for low-frequency UI: `phase` (countdown/playing/done/topout), `finalMs`,
  `best`, `isPb`.
- **HUD is written to the DOM imperatively.** Time / lines-left / PPS are set via
  `textContent` on ref'd elements each frame. The **countdown number is also
  DOM-written** (`countdownElRef`) — React doesn't re-render during the
  countdown, so don't try to drive that number from state.
- **Fixed-timestep gravity** via a `requestAnimationFrame` accumulator, frame-
  rate independent. `dt` is clamped (≤100ms) after a tab-out so the piece
  doesn't fast-forward on resume.
- **Hold/next previews** repaint only when the queue signature changes.

## Scoring & backend (hardened pattern)

- Completion calls **`submit_tetris_result(time_ms, lines)`** — requires
  `lines = 40`, rejects sub-8s superhuman times (and absurdly large values),
  updates the account best via `least`, and awards a **server-bounded** reward:
  `5 + floor(max(0, 120000 − time_ms) / 3000)`, capped at 50.
- **Only finished sprints submit** (`submittedRef` one-shot guard); abandoning a
  partial run records nothing — so there's no exit/unmount submit to manage.
- **Profile column:** `tetris_sprint_ms int` (null = no record, **lower is
  better**). Locked down by `hardening.sql` automatically (not in the cosmetic
  column grant), so only the RPC can write it.
- **Leaderboard:** "Tetris Sprint" via `get_leaderboard_tetris`, ranks by
  ascending time, formatted as `M:SS.cc` / `SS.ccs`.

## Theming

- **Pieces keep constant, vivid, mutually-distinguishable colors across every
  theme** — recoloring them per theme would hurt readability, which is a
  gameplay requirement. So unlike 2048's tiles, there is **no per-theme piece
  palette**. Theme integration happens *around* the pieces:
  - the board panel is translucent (the theme's page gradient shows through),
  - the board glow, grid, line-clear flash, and particle colors come from
    `--accent-1/--accent-2` (read once from `getComputedStyle` at mount).
- Uses the shared `--shape-octagon*` clip-paths, no `border-radius`.

## Behavior notes / gotchas

- **The game pauses when the tab is hidden.** `requestAnimationFrame` is
  throttled to zero in a hidden/background tab, so the loop (and timer) pause and
  resume cleanly — the timer accumulates from the clamped `dt`, never wall-clock,
  so tabbing out mid-run doesn't add idle time. (Consequence: automated
  screenshot tools that load the page in a hidden tab will see a blank, static
  canvas. Verify the engine via a Node harness importing `lib.ts` instead.)
- **Top-out** = a piece that locks entirely in the hidden buffer, or a freshly
  spawned piece that immediately collides (block-out).
- **T-spin flag:** set by a successful rotation, cleared only by a successful
  *horizontal* move. Hard drop and gravity do NOT clear it, so "rotate into the
  slot, then hard drop" still registers as a T-spin.

## Not implemented (extension ideas)

- Other modes (Blitz score-attack, Marathon, Zen) — would need a mode selector
  and a decision on which single metric the leaderboard tracks.
- A settings panel for tunable DAS/ARR/SDF (persist to localStorage).
- A watchable bot (mirror 2048's "Watch AI"); if added, it needs an
  `aiUsedRef`-style taint guard so bot runs are never ranked/rewarded.
- Sound effects (the site currently has no audio).
