# Daily Word — game context

A date-seeded Wordle: guess a hidden 5-letter word in 6 tries. **The same word
for everyone each UTC day**, so it's an async daily competition. The competitive
metric is the **solve streak**. See [PROJECT.md](../../../PROJECT.md) for
site-wide architecture (theming, economy, leaderboard framework, conventions).

## Gameplay

- 6 guesses, 5 letters. Tile feedback after each guess: **green** = right
  letter & spot, **yellow** = in the word elsewhere, **gray** = absent (with
  correct duplicate-letter handling — see `evaluateGuess`).
- One puzzle per day. After finishing (win or loss), the board locks and shows
  the result + a live countdown to the next puzzle.
- **Share** copies the 🟩🟨⬛ emoji grid to the clipboard (the signature hook).
- On-screen keyboard (colored by best-known letter state) **and** physical
  keyboard both work — playable on mobile.

## Scoring & the competitive metric

- The leaderboard ("Daily Word") ranks by **best streak** (`wordle_best_streak`)
  — a monotonic high-score-style number, which fits the existing leaderboard
  framework. The **current streak** is shown prominently in-game.
- Streak rule: solving continues the streak only if the previous solved day was
  exactly *yesterday*; a loss (or a skipped day) resets the current streak to 0.

## Files

| File | Role |
| --- | --- |
| `words.ts` | Curated common 5-letter word list (`WORDS`) + `WORD_SET`. The daily **answer pool** (also accepted as guesses, so every answer is guessable). |
| `allowed.ts` | **AUTO-GENERATED** large guess-validation set (`ALLOWED_SET`, ~12.5k words). Do not hand-edit — regenerate with `npm run gen:wordle`. |
| `lib.ts` | Pure logic: `dayIndex`/`puzzleNumber`/`wordForDay` (UTC day math, mirrored server-side), `evaluateGuess` (dup-aware), `aggregateKeyStates`, `isValidWord`, `msUntilNextDay`, `shareGrid`. No React/Supabase. |
| `WordleGame.tsx` | UI + input (on-screen + physical keyboard), per-day localStorage persistence, result overlay, share, server submit. |
| `styles.css` | Chamfered clip-path board/keyboard; fixed semantic tile colors; accent-themed glow/overlay. |

## Date seeding (client ⇄ server agree)

- `dayIndex = floor(Date.now() / 86_400_000)` (UTC days since the Unix epoch).
  The server computes the identical `floor(epoch_s / 86400)`. The answer is
  `WORDS[dayIndex % WORDS.length]`. `puzzleNumber` offsets from 2026-01-01 for
  display only.

## Backend (hardened pattern)

- **`submit_wordle_result(puzzle_day, guesses, solved)`** — requires
  `puzzle_day = server's current UTC day` (**no backfilling streaks**),
  `guesses ∈ 1..6`, is **idempotent per day** (second call no-ops), updates the
  streak, and awards a **server-bounded, solve-only** reward:
  `5 + (6 − guesses) * 5` → 30 (1 guess) … 5 (6 guesses); 0 on a loss. Returns
  `(streak, best_streak, reward)`.
- **Profile columns:** `wordle_last_day`, `wordle_streak`, `wordle_best_streak`,
  `wordle_wins`, `wordle_played`. Locked by `hardening.sql` automatically (not in
  the cosmetic column grant) — only the RPC writes them.
- **Leaderboard:** `get_leaderboard_wordle`, ranks by `wordle_best_streak desc`.

## Persistence & offline

- Today's board (`minigames:wordle:state`, keyed by day) and a local stats blob
  (`minigames:wordle:stats`) are kept in localStorage, so refresh resumes the
  same puzzle and **signed-out players still get streaks**. The local stats use
  the same streak math as the server; on a signed-in submit the server response
  is treated as authoritative and reconciled back into local state.

## Behavior notes / gotchas

- **Submission fires once, at the moment of completion** (`submittedRef`
  one-shot) — reloading a finished board never re-submits. There's no
  exit/unmount submit to manage.
- **Documented residual:** the server trusts the client's `solved` flag (it
  doesn't replay guesses), so streak/points are *rate-limited to once per real
  UTC day* rather than fully cheat-proof. The reward ceiling is tiny (≤30/day)
  and the streak can't be fast-forwarded (each submit must match the real
  current day), so this matches the project's pragmatic security posture. Fully
  closing it would mean validating the answer server-side (shipping the word
  list to the DB).
- **Dictionary:** guesses are validated against `allowed.ts` (~12.5k words,
  generated from the SCOWL-based `word-list` devDependency via
  `npm run gen:wordle`) plus the curated answer pool. To widen/narrow the
  accepted guesses, tweak the filter in `scripts/gen-wordle-allowed.mjs` and
  regenerate. Daily answers stay limited to the curated `words.ts` so puzzles
  remain fair/common.
