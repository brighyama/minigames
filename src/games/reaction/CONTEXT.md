# Reaction Test — game context

Full-screen reaction-time test. See [PROJECT.md](../../../PROJECT.md) for the
site-wide architecture (theming, economy, leaderboard framework, conventions).

## Gameplay

- Full-screen. Click anywhere to start a round. After a random 1.5–5s delay the
  background flips from `--accent-1` to `--accent-2`. Click as soon as it flips.
  Clicking before the flip = "Too soon".
- Five phases: `idle`, `waiting` (red / `--accent-1`), `ready` (green /
  `--accent-2`), `tooEarly`, `result`.
- Top of screen: live list of the last 5 reactions, a rolling 5-window average
  once 5 are recorded, and the user's all-time best avg.

## Files

| File | Role |
| --- | --- |
| `ReactionGame.tsx` | The full-screen test + the recent-times bar + phase state machine. |
| `styles.css` | Full-screen game CSS + recent-times bar. |

## Scoring & backend

- **High score** = lowest rolling 5-window avg ever recorded (ms, lower is
  better). **Saved immediately** when a new low is hit during play via
  `update_reaction_best(avg_ms)` — *not* on exit (see gotcha).
- **Points on exit:** 5–10 based on the session's best 5-avg (10 for ≤250ms,
  −1 per 10ms above, floor 5). `award_reaction(best_avg_ms)` computes the
  bounded reward server-side.
- **Profile column:** `best_reaction_avg int` (null = no record).
- **Leaderboard:** "Reaction Time" via `get_leaderboard_reaction`, formatted
  `X ms`, lower-is-better.

## Theming

- Reads `--accent-1` (waiting/red) and `--accent-2` (ready/green) from the
  active theme. No game-specific palette module.

## Gotchas

- **Timing is paint-synced.** The waiting→ready color flip has **no CSS
  transition** (an eased flip inflated measured times), and the clock starts
  inside a double `requestAnimationFrame` after the green frame paints — not
  when state is set. Don't add a transition to that flip.
- The best avg saves the instant it's beaten (in the bestAvg-change effect),
  because fire-and-forget RPCs from unmount cleanup get killed by navigation.
