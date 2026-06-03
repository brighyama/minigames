# Type Sprint

20-second Monkeytype-style typing sprint.

## Files

- `TypeSprintGame.tsx` - game logic, word generation, timer, stats, and local best.
- `styles.css` - themed typing surface and result panel.

## Gameplay

- Route: `/games/type-sprint`
- The timer starts on the first typed character.
- Mode is fixed at 20 seconds for the first version.
- Stats:
  - `wpm` = correct characters / 5 / elapsed minutes.
  - `raw` = all typed characters / 5 / elapsed minutes.
  - `acc` = correct characters divided by typed characters.
  - `chars` in the result panel shows correct/incorrect typed characters.
- Best score is local-only via `localStorage` key `minigames:type-sprint:best`.

## Notes

- No Supabase RPC or leaderboard hook yet.
- The word stream is generated from a local common-word bank each restart.
- The visual surface uses shared `--board-*`, `--accent-*`, and chamfered shape variables from `App.tsx` / `App.css`.
