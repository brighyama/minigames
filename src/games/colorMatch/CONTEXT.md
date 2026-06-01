# Color Match Context

Dialed-inspired color memory game: memorize a flashed color, then recreate it
with Hue, Saturation, and Brightness sliders.

## Files

- `ColorMatchGame.tsx` - game state, HSB/RGB helpers, random colors, scoring, submit.
- `styles.css` - full-screen stage, color swatch, slider panel, result cards.

## Gameplay

- Route: `/games/color-match`.
- Initial phase waits for a centered click-to-play control.
- A run has 5 rounds.
- Each round flashes a random target HSB color for 3 seconds with a countdown.
- The target fades over 600ms into a different random starting color.
- The player adjusts Hue (0-360), Saturation (0-100), and Brightness (0-100), then submits once.
- The round result shows score plus target/guess swatches.
- After 5 rounds, the final screen shows total score, average score, saved best, and retry.

## Scoring

- Per-round score is `0..1000`.
- Convert target and guess from HSB to RGB and score by normalized RGB distance:
  `round(1000 * max(0, 1 - distance / sqrt(3 * 255^2)))`.
- Run score is the sum of 5 rounds, max `5000`. Higher is better.
- Target colors use hue `0..359`, saturation `35..100`, brightness `35..100`.
- The post-flash starting color rerolls up to 20 times for at least `120` RGB distance from the target, then falls back to the farthest candidate.

## Backend

- Profile column: `color_match_best_score int not null default 0`.
- RPC: `submit_color_match_result(score int) returns (best int, reward int)`.
- The client submits the final 5-round total.
- The server rejects `< 0` and `> 5000`, updates the best with `greatest`, and computes the reward as `least(75, 10 + floor(score / 100))`, or `0` for score `0`.
- Leaderboard RPC: `get_leaderboard_color_match(lim int)`, sorted descending.

## Theming

- Uses shared board variables: `--board-bg`, `--board-border`, `--board-grid`, `--board-glow`.
- Uses `--accent-1` / `--accent-2` for panel glow, buttons, and control highlights.
- Semantic/target colors are gameplay content and should not be theme-remapped.
- Uses shared clip-path geometry only; no `border-radius`.

## Gotchas

- Opening the route must not start a run; the centered start button begins play.
- Score is saved immediately on the final result, guarded by a one-submit ref.
- Signed-out play works locally; Supabase submit is skipped when unavailable.
- Keep the final/result overlays below or away from the universal `BackButton` so Exit remains clickable.
