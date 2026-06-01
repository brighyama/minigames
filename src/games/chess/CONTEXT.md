# Chess — game context

Play vs a built-in JavaScript engine. **The only game with zero backend** — no
points, no leaderboard, no profile column, no Supabase RPC. See
[PROJECT.md](../../../PROJECT.md) for site-wide architecture and conventions.

## Gameplay

- The [chess.js](https://www.npmjs.com/package/chess.js) library handles rules /
  move generation / SAN. Click a piece → legal targets highlight → click to
  move; last-move and check squares are highlighted, with a move list and a
  clock panel alongside the board.
- **You auto-switch colors each "new game"** (the engine opens with a random
  first move when it plays white).

## Files

| File | Role |
| --- | --- |
| `ChessGame.tsx` | Board UI, click-to-move, engine-level / time-control / piece-skin controls, clocks, move list. |
| `lib.ts` | Pure engine: material eval + alpha-beta minimax, 3 levels, all time-bounded. No React/backend. |
| `palette.ts` | Per-theme board colors → `--chess-*` CSS vars (mirrors g2048). |
| `styles.css` | Board + piece styling (shared clip-path geometry). |

## Engine

- **Levels** (`lib.ts`): *casual* (greedy heuristic — favors captures / checks /
  promotions / center), *standard* (depth-1 minimax), *expert* (depth-2
  alpha-beta with positional terms). All searches are wall-clock-bounded
  (`maxMs`).
- **Time controls:** none / 1+1 / 3+2 / 5 (Fischer increment supported; "none" =
  untimed). Running out flags a loss.

## Theming & cosmetics

- **Board colors are theme-driven** via `applyChessPalette()` (called from the
  App.tsx theme effect): sets `--chess-light/dark/hint/capture`. The 4 default
  themes fall back to classic browns; unlockable themes get a bespoke palette.
- **Piece cosmetics are local UI selects, _not_ shop items:** 4 piece *color*
  skins (classic / walnut / frost / neon) × 3 piece *styles* (classic Staunton
  SVG / geometric / glyph).

## Note

- Purely client-side — there is **nothing to add to `schema.sql`** for chess.
