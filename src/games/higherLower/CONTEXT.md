# Higher or Lower — game context

A local category-based comparison game inspired by the classic Higher Lower
format. See [PROJECT.md](../../../PROJECT.md) for site-wide architecture and
visual conventions.

## Gameplay

- Choose a dataset, then compare a known left-hand value with a hidden
  right-hand value.
- Guess **higher** or **lower**. Correct guesses extend the streak and move the
  revealed item to the known side. One wrong answer ends the run.
- Keyboard: `H` / `ArrowUp` = higher, `L` / `ArrowDown` = lower, `R` = restart.
- Best streaks persist independently per category in localStorage.

## Categories

- Internet searches — curated monthly-search estimates in the style of the
  original game.
- Movie ratings — rounded audience-rating references.
- CS2 skin prices — Factory New (or best available wear when noted) reference
  prices. Snapshot dated June 22, 2026; prices are intentionally not live.
- Video-game scores — rounded critic-score references.
- Country populations — rounded 2025–2026 estimates.

The values are gameplay snapshots, not authoritative live data. Keeping them
static makes rounds instant, avoids public API keys, and ensures the ordering
does not change halfway through a run.

## Files

| File | Role |
| --- | --- |
| `data.ts` | Category metadata, formatting, snapshot notes, and curated items. |
| `images.ts` | On-demand image resolver and URL cache: Wikimedia summary images for general categories and selected open CSGO-API/Steam CDN URLs for CS2 renders. |
| `HigherLowerGame.tsx` | Category picker, shuffled run state, guessing/reveal flow, keyboard input, and local bests. |
| `styles.css` | Split-card arena, category picker, responsive stacked layout, and theme-aware chrome. |

## Persistence and backend

- Last category: `minigames:higher-lower:category`
- Best streak map: `minigames:higher-lower:bests`
- Resolved remote image URLs: `minigames:higher-lower:image-cache:v1`
- No Supabase writes, points, or leaderboard.

## Images

- Images are resolved lazily for the visible and next few cards rather than
  bundled into the app. General entities use Wikimedia article-summary image
  metadata. CS2 skin URLs were selected from the MIT-licensed
  [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API) index and load directly
  from Steam's image CDN, avoiding a multi-megabyte index download at runtime.
- Resolved URLs are cached in memory and localStorage. The item's original
  gradient and symbol remain underneath as loading/error fallbacks.
- This avoids manually importing every image, but it introduces a network
  dependency. If a future deployment requires fully deterministic/offline
  assets, download selected images into `public/games/higher-lower/` and replace
  the resolver with local URLs.

## Theming

Each item has a category-appropriate gradient for quick visual identity. Shared
page text, board glow, controls, fonts, and chamfered geometry use the global
theme variables. No `border-radius`.
