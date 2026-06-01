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
- **Manual DAS/ARR** input handling (not OS key-repeat): DAS delay before
  auto-shift, ARR repeat interval (0 = slam straight to the wall), and SDF soft
  drop speed (0 = instant sonic drop). This is the core of the responsive feel.
  **All three are player-tunable** (see Settings below) and read live from
  `handlingRef` each frame — not hardcoded constants.
- **T-spin detection** (3-corner rule, full vs mini), **combo** counter,
  **back-to-back** chain, and **perfect clear** — all tracked for juice/stats.
  The leaderboard metric is **purely the 40-line time**, not a score.
- Fixed timing constants live at the top of `TetrisGame.tsx` (`GRAVITY_MS`,
  `LOCK_DELAY_MS`, `MAX_LOCK_RESETS`, `NEXT_COUNT`). The tunable ones (DAS/ARR/
  SDF) and their defaults live in `settings.ts`.

## Settings, keybinds & input

- **Settings panel** (`TetrisSettings.tsx`) — opened by the ⚙ button in the
  header. A modal with two sections: **handling** (DAS/ARR/SDF sliders) and
  **controls** (rebindable keys). A "reset to defaults" button restores both.
- **Persistence** (`settings.ts`): handling → `minigames:tetris:handling`,
  keybinds → `minigames:tetris:keybinds` (localStorage; same pattern as the deck
  selector — device-local, no profile sync). `load*` clamps/merges against
  defaults so a corrupt or partial blob can't break the game.
- **Live application without remounting the loop.** The rAF loop is set up once;
  it reads `handlingRef.current` each frame and the input handler reads
  `codeMapRef.current`. Changing a slider/keybind updates React state (for the
  UI) **and** the ref (for the loop) — so changes apply mid-run. Never thread
  these through the loop effect's deps (that would reset the game on every
  tweak).
- **Unified input dispatcher.** Keyboard and on-screen touch buttons both funnel
  through `applyAction(action, down)` inside the loop closure, exposed via
  `actionsRef` so the JSX `TouchButton`s can call it. `applyAction` is the single
  gate: it no-ops unless `status === 'playing'` and settings is closed.
- **Keybinds are physical `KeyboardEvent.code` values** (layout-position based,
  the game convention). Each action holds up to 2 codes; codes are globally
  unique (`assignKey` strips a code from any other action before binding it to a
  slot). Rebinding captures the next keydown in the **capture phase** with
  `stopPropagation`, so it never leaks to the gameplay handler. The help strip
  and the panel render friendly labels via `keyLabel`.
- **Opening settings pauses the run** — `settingsOpenRef` makes the loop zero out
  `dt` (freezing countdown/timer/gravity) and short-circuits `applyAction`.

## Mobile

- **On-screen touch controls** (`.tetris-touch`, the `TouchButton` component):
  rotate CCW/CW, hold, ◀ ▼ ▶, and hard drop. Pointer down/up route through
  `applyAction`, so holding ◀/▶ drives DAS exactly like the keyboard and ▼ is a
  held soft drop. Shown on touch-primary devices (`(hover: none) and (pointer:
  coarse)`) **or** any viewport ≤ 640px; the keyboard help strip hides there.
- **Responsive layout.** `.tetris-stage` uses `grid-template-areas`. Desktop is
  the classic 3-column `hold | well | next`; ≤ 640px it restacks to
  `hold` / `next` / `well` with the side panels flattened into compact
  horizontal info strips above a shorter well, leaving room for the touch pad.

## Files

| File | Role |
| --- | --- |
| `lib.ts` | Pure engine: tetromino shapes, SRS rotation + kick tables, 7-bag (`SevenBag`), board ops, `collides`/`tryMove`/`tryRotate`/`hardDropPosition`/`lockPiece`/`clearLines`, `detectTSpin`, combo/B2B helpers. No React/Supabase. |
| `TetrisGame.tsx` | Canvas renderer + fixed-timestep game loop, input handling, hold/next/ghost, Sprint logic, HUD, overlays, and juice. |
| `palette.ts` | Constant per-piece colors (`PIECE_COLORS`/`PIECE_HIGHLIGHTS`) + `typeForId`. |
| `settings.ts` | Pure: handling/keybind types + defaults, localStorage load/save (clamped), `buildCodeMap`/`assignKey`/`clearKey`, `keyLabel`. No React. |
| `TetrisSettings.tsx` | The settings modal (handling sliders + rebindable keybinds + reset). |
| `styles.css` | Chamfered clip-path styling; board glow + particles read `--accent-1/2`; settings modal, touch controls, responsive (mobile) layout. |

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
  updates the account best via `least`, and awards a **server-bounded**,
  time-tiered reward: **40 base, +15 if under 2min, +30 if under 1min** (bonuses
  stack → 40 / 55 / 85).
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
- A watchable bot (mirror 2048's "Watch AI"); if added, it needs an
  `aiUsedRef`-style taint guard so bot runs are never ranked/rewarded.
- Sound effects (the site currently has no audio).
- Swipe/drag gesture input for mobile (currently on-screen buttons only).
