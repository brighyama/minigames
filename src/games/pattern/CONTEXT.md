# Memory Matrix Context

HumanBenchmark-style visual memory game.

## Files

- `PatternGame.tsx` — game state, pattern generation, score submit.
- `styles.css` — full-screen stage, HUD, board, tiles.

## Gameplay

- Route: `/games/pattern`.
- Initial phase waits for a centered click-to-play control.
- Level 1 flashes a random pattern of 3 tiles on a 3x3 board.
- The player clicks the remembered tiles. A wrong tile immediately ends the run.
- Completing the pattern advances to the next level.
- Pattern size increases linearly by 1 each level: level 1 = 3 tiles, level 2 = 4 tiles, etc.
- Board dimension is the smallest square grid where `patternTiles / gridTiles <= 1/3`, so:
  - 3 tiles → 3x3
  - 4-5 tiles → 4x4
  - 6-8 tiles → 5x5
  - and so on.

## Backend

- Profile column: `pattern_best_level int not null default 0`.
- RPC: `submit_pattern_result(completed_level int) returns (best int, reward int)`.
- The client submits the number of completed levels after a miss.
- The server rejects `< 0` and `> 80`, updates the best with `greatest`, and computes the reward as `5 + level*2`, capped at 60.
- Leaderboard RPC: `get_leaderboard_pattern(lim int)`, sorted descending.

## Theming

- Uses shared board variables: `--board-bg`, `--board-border`, `--board-grid`, `--board-cell-empty`, `--board-glow`.
- Uses `--pattern-board-surface`, `--pattern-tile-active-a`, `--pattern-tile-active-b`, and `--pattern-tile-active-fg` from the App theme effect. Default themes use a simple gray board and white flashed tiles; unlockable themes tint the active tiles from their accents.
- Uses `--accent-1` / `--accent-2` for the start panel.
- Uses shared clip-path geometry only; no `border-radius`.

## Gotchas

- Score is saved immediately at game-over, not on unmount.
- The start/restart control is intentionally centered so opening the route does not instantly start a run.
- During the flash phase, tiles are disabled. During the brief correct transition, tiles are also disabled to avoid accidental loss before the next pattern is generated.
