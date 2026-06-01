# Aim Trainer — game context

A 20-second click-the-target round. See [PROJECT.md](../../../PROJECT.md) for
site-wide architecture (theming, economy, leaderboard framework, conventions).

## Gameplay

- Large centered card (not full-screen). HUD shows time remaining + current
  score.
- 20-second round. One 60px circle on screen at a time; clicking it scores 1
  and immediately spawns the next at a random point. Circles persist until
  clicked or the timer ends.

## Files

| File | Role |
| --- | --- |
| `AimGame.tsx` | The card, target, 20s timer, score HUD, and hit particle effects. |
| `styles.css` | Game-specific styles. |

## Scoring & backend

- **High score** = most circles in a single round. **Saved immediately when a
  round ends** if it's a new personal best via `update_aim_high_score(score)`.
- **Points on exit:** `5 + floor(best_session_score / 2)`, min 5.
  `award_aim(best_score)` computes the reward server-side (score clamped to a
  plausible ≤200 ceiling).
- **Profile column:** `aim_high_score int` (0 = no record).
- **Leaderboard:** "Aim Trainer" via `get_leaderboard_aim`.

## Theming

- Circles use `radial-gradient(--accent-2, --accent-1)`. The App.tsx theme
  effect sets `--aim-circle-a/--aim-circle-b`: plain white for the 4 default
  themes, accent-tinted for unlockable themes.
- **Rarity-driven hit effects** (reads `theme.rarity`, passed as a prop):
  - **Red (★★★)** — 8-particle gravity explosion using accent colors.
  - **Gold (♛)** — 14-particle outward sparkle, no gravity, gold.
  - Anything else — no effect.

## Gotchas

- High score saves in the result/round-end effect, not on unmount (navigation
  kills fire-and-forget cleanup RPCs).
