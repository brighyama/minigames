# Snake — game context

A canvas-rendered Snake game with independently selectable modes and speed
presets. See [PROJECT.md](../../../PROJECT.md) for shared theming and UI
conventions.

## Modes

- **Classic:** walls and the snake's body kill the run. Speed gently ramps with
  collected fruit.
- **Wrap:** crossing an edge emerges from the opposite edge. Self-collision
  still ends the run.
- **Rush:** a 60-second score attack with a steeper speed ramp. Every fifth
  fruit is gold and worth 3 points.
- **Maze:** begins with fixed barriers and adds one safely placed obstacle every
  three fruit.

## Difficulty

- **Chill:** 150ms base tick.
- **Normal:** 105ms base tick.
- **Turbo:** 72ms base tick.

Mode speed ramps apply after the selected base speed. Best scores persist for
each mode/difficulty combination.

## Controls

- Keyboard: arrows or WASD; Space/Escape pauses; R restarts; Enter starts.
- Touch: swipe on the board or use the directional pad.
- Opposite-direction turns are rejected by the pure engine, preventing instant
  reversal into the snake's neck.

## Files

| File | Role |
| --- | --- |
| `lib.ts` | Pure grid engine, collision/wrap logic, food spawning, maze barriers, score rules, and speed calculation. |
| `SnakeGame.tsx` | Canvas renderer, mode/difficulty UI, timers, input, pause/restart flow, and local best persistence. |
| `styles.css` | Responsive board shell, selectors, overlays, and touch controls. |

## Persistence and backend

- Mode: `minigames:snake:mode`
- Difficulty: `minigames:snake:difficulty`
- Best-score map: `minigames:snake:bests`
- No Supabase writes, points, or leaderboard.

## Theming

Snake body/head colors use `--accent-1` and `--accent-2`; the board, grid,
panels, glow, typography, and chamfered geometry use shared site variables.
Food and maze barriers keep constant colors for immediate readability.
