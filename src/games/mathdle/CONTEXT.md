# Mathdle

Daily 8-slot arithmetic puzzle inspired by classic Nerdle.

## Gameplay

- Route: `/games/mathdle`
- 6 guesses, 8 characters.
- Allowed characters: digits `0`-`9`, operators `+`, `-`, `*`, `/`, and exactly one `=`.
- Every submitted guess must be a mathematically valid equation. Standard precedence applies: `*` and `/` before `+` and `-`.
- Multi-digit numbers cannot start with `0`; unary negative numbers and parentheses are not supported.
- Tile feedback is duplicate-aware:
  - green = correct character and slot
  - purple = character exists elsewhere
  - gray = absent

## Daily generation

- `dayIndex = floor(Date.now() / 86_400_000)` in UTC, matching Daily Word's day math.
- `equationForDay(day)` uses a seeded PRNG to generate a deterministic valid `expression=result` answer that is exactly 8 characters.
- Guesses are validated with the same parser used by the generator.

## Files

| File | Role |
| --- | --- |
| `lib.ts` | Pure equation parser/evaluator, daily seeded answer generation, duplicate-aware feedback, keyboard aggregate states, share grid. |
| `MathdleGame.tsx` | UI, local per-day persistence, local stats/streaks, physical/on-screen keyboard, result overlay, share. |
| `styles.css` | Chamfered board/keyboard styling using shared `--board-*`, `--accent-*`, and `--shape-*` vars. |

## Persistence

- Today's board: `minigames:mathdle:state`, keyed by UTC day.
- Local stats: `minigames:mathdle:stats`.
- No Supabase columns, RPCs, rewards, or leaderboard yet.
