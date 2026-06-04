import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { useAuth } from './lib/auth'
import { fetchProfile, saveProfile } from './lib/profile'
import {
  themes,
  DEFAULT_ACCENT_1,
  DEFAULT_ACCENT_2,
} from './lib/themes'
import { cardDecks } from './lib/cardDecks'
import { AuthPanel } from './components/AuthPanel'
import { DailyBonus } from './components/DailyBonus'
import { RarityIcon, rarityLabel } from './components/RarityIcon'
import { applyTilePalette } from './games/g2048/palette'
import { HomePage } from './pages/HomePage'
import { LeaderboardsPage } from './pages/LeaderboardsPage'
import { ShopPage } from './pages/ShopPage'
import { ReactionGame } from './games/reaction/ReactionGame'
import { AimGame } from './games/aim/AimGame'
import { BlackjackGame } from './games/blackjack/BlackjackGame'
import { RouletteGame } from './games/roulette/RouletteGame'
import { RideBusGame } from './games/rideBus/RideBusGame'
import { Game2048 } from './games/g2048/Game2048'
import { ChessGame } from './games/chess/ChessGame'
import { applyChessPalette } from './games/chess/palette'
import { TetrisGame } from './games/tetris/TetrisGame'
import { MinesweeperGame } from './games/minesweeper/MinesweeperGame'
import { CasesGame } from './games/cases/CasesGame'
import { PatternGame } from './games/pattern/PatternGame'
import { ColorMatchGame } from './games/colorMatch/ColorMatchGame'
import { TypeSprintGame } from './games/typeSprint/TypeSprintGame'
import { MathdleGame } from './games/mathdle/MathdleGame'
// Lazy-loaded: its ~12.5k-word guess dictionary (allowed.ts) is split into its
// own chunk so it only downloads when a player opens Daily Word.
const WordleGame = lazy(() =>
  import('./games/wordle/WordleGame').then((m) => ({ default: m.WordleGame })),
)

const THEME_KEY = 'minigames:theme'
const DECK_KEY = 'minigames:deck'
const UNLOCKS_KEY = 'minigames:unlocks'

function boardPatternForTheme(theme: { rarity?: string }, accent1: string, accent2: string): string {
  const base = `linear-gradient(135deg, color-mix(in srgb, ${accent1} 22%, #08070e), color-mix(in srgb, ${accent2} 18%, #12101c))`
  if (theme.rarity === 'gold') {
    return `repeating-linear-gradient(45deg, color-mix(in srgb, ${accent2} 18%, transparent) 0 1px, transparent 1px 28px), radial-gradient(circle at 50% 0%, color-mix(in srgb, ${accent1} 28%, transparent), transparent 38%), ${base}`
  }
  if (theme.rarity === 'red') {
    return `linear-gradient(120deg, transparent 0 42%, color-mix(in srgb, ${accent1} 24%, transparent) 42% 44%, transparent 44% 100%), linear-gradient(38deg, transparent 0 58%, color-mix(in srgb, ${accent2} 22%, transparent) 58% 60%, transparent 60% 100%), ${base}`
  }
  if (theme.rarity === 'purple') {
    return `radial-gradient(circle at 18% 16%, color-mix(in srgb, ${accent1} 30%, transparent), transparent 32%), radial-gradient(circle at 82% 78%, color-mix(in srgb, ${accent2} 28%, transparent), transparent 34%), ${base}`
  }
  if (theme.rarity === 'blue') {
    return `linear-gradient(color-mix(in srgb, ${accent1} 14%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, ${accent2} 12%, transparent) 1px, transparent 1px), ${base}`
  }
  if (theme.rarity === 'green') {
    return `repeating-linear-gradient(135deg, color-mix(in srgb, ${accent2} 11%, transparent) 0 2px, transparent 2px 18px), ${base}`
  }
  return 'rgba(0, 0, 0, 0.35)'
}

function loadUnlocks(): string[] {
  try {
    const raw = localStorage.getItem(UNLOCKS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function App() {
  const { user } = useAuth()
  const location = useLocation()
  const isHome = location.pathname === '/'

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themeId, setThemeId] = useState<string>(() => {
    return localStorage.getItem(THEME_KEY) ?? themes[0].id
  })
  const [deckId, setDeckId] = useState<string>(() => {
    return localStorage.getItem(DECK_KEY) ?? cardDecks[0].id
  })
  const [unlocks, setUnlocks] = useState<string[]>(() => loadUnlocks())
  const [points, setPoints] = useState<number | null>(null)

  const themeDef = themes.find((t) => t.id === themeId)
  const themeIsAvailable =
    themeDef !== undefined && (!themeDef.locked || unlocks.includes(themeDef.id))
  const theme = themeIsAvailable ? themeDef! : themes[0]

  const deckDef = cardDecks.find((d) => d.id === deckId)
  const deckIsAvailable =
    deckDef !== undefined && (!deckDef.locked || unlocks.includes(deckDef.id))
  const deck = deckIsAvailable ? deckDef! : cardDecks[0]

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--theme-bg', theme.background)
    root.style.setProperty('--theme-bg-size', theme.backgroundSize ?? 'auto')
    root.style.setProperty('--theme-text', theme.text ?? '#ffffff')
    root.style.setProperty('--theme-font', theme.font ?? 'var(--sans)')
    root.style.setProperty(
      '--theme-title-shadow',
      theme.titleShadow ?? '0 8px 32px rgba(0, 0, 0, 0.3)',
    )
    root.style.setProperty('--accent-1', theme.accent1 ?? DEFAULT_ACCENT_1)
    root.style.setProperty('--accent-2', theme.accent2 ?? DEFAULT_ACCENT_2)
    const accent1 = theme.accent1 ?? DEFAULT_ACCENT_1
    const accent2 = theme.accent2 ?? DEFAULT_ACCENT_2
    root.style.setProperty('--board-bg', boardPatternForTheme(theme, accent1, accent2))
    root.style.setProperty('--board-bg-size', theme.rarity === 'blue' ? '32px 32px, 32px 32px, auto' : 'auto')
    root.style.setProperty('--board-border', `color-mix(in srgb, ${accent2} 46%, rgba(255, 255, 255, 0.18))`)
    root.style.setProperty('--board-glow', `0 0 28px -8px ${accent1}`)
    root.style.setProperty('--board-cell', `color-mix(in srgb, ${accent2} 18%, rgba(255, 255, 255, 0.12))`)
    root.style.setProperty('--board-cell-alt', `color-mix(in srgb, ${accent1} 22%, rgba(0, 0, 0, 0.28))`)
    root.style.setProperty('--board-cell-empty', `color-mix(in srgb, ${accent1} 11%, rgba(255, 255, 255, 0.055))`)
    const boardGridMix = theme.rarity === 'red' || theme.rarity === 'gold' ? 12 : 28
    root.style.setProperty('--board-grid', `color-mix(in srgb, ${accent2} ${boardGridMix}%, rgba(255, 255, 255, 0.09))`)
    root.style.setProperty('--board-grid-alpha', theme.rarity === 'red' || theme.rarity === 'gold' ? '0.07' : '0.16')

    // Game-card border: default themes get a neutral gray; unlockable themes
    // get their own accent so the edge pops in their palette.
    root.style.setProperty('--card-edge', theme.locked ? (theme.accent2 ?? DEFAULT_ACCENT_2) : '#9ca3af')

    // Aim trainer circle: plain white for the default themes; accent-tinted for
    // unlockable themes (the only ones with `locked`).
    if (theme.locked) {
      root.style.setProperty('--aim-circle-a', theme.accent2 ?? DEFAULT_ACCENT_2)
      root.style.setProperty('--aim-circle-b', theme.accent1 ?? DEFAULT_ACCENT_1)
      root.style.setProperty('--pattern-board-surface', 'rgba(0, 0, 0, 0.32)')
      root.style.setProperty('--pattern-tile-active-a', theme.accent2 ?? DEFAULT_ACCENT_2)
      root.style.setProperty('--pattern-tile-active-b', theme.accent1 ?? DEFAULT_ACCENT_1)
      root.style.setProperty('--pattern-tile-active-fg', '#ffffff')
    } else {
      root.style.setProperty('--aim-circle-a', '#ffffff')
      root.style.setProperty('--aim-circle-b', '#e2e2e2')
      root.style.setProperty('--pattern-board-surface', 'rgba(128, 128, 128, 0.28)')
      root.style.setProperty('--pattern-tile-active-a', '#ffffff')
      root.style.setProperty('--pattern-tile-active-b', '#f2f2f2')
      root.style.setProperty('--pattern-tile-active-fg', '#ffffff')
    }

    // 2048 tiles: unlockable themes get a unique ramp; defaults use CSS colors.
    applyTilePalette(root, theme.id)
    // Chess board: default themes use classic browns; unlockables get a
    // theme-specific board palette.
    applyChessPalette(root, theme.id)

    localStorage.setItem(THEME_KEY, theme.id)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--card-face', deck.face)
    root.style.setProperty('--card-red', deck.red)
    root.style.setProperty('--card-black', deck.black)
    root.style.setProperty('--card-back', deck.back)
    root.style.setProperty('--card-border', deck.border ?? 'rgba(0,0,0,0.1)')
    root.style.setProperty('--card-font', deck.font ?? 'Georgia, "Times New Roman", serif')
    localStorage.setItem(DECK_KEY, deck.id)
  }, [deck])

  useEffect(() => {
    localStorage.setItem(UNLOCKS_KEY, JSON.stringify(unlocks))
  }, [unlocks])

  // Hydrate profile (theme, unlocks, points) when the user signs in / out.
  useEffect(() => {
    if (!user) {
      setPoints(null)
      return
    }
    let cancelled = false
    fetchProfile(user.id).then((profile) => {
      if (cancelled || !profile) return

      const remoteUnlocks = profile.unlocks ?? []
      const mergedUnlocks = Array.from(new Set([...unlocks, ...remoteUnlocks]))

      if (profile.theme_id) {
        setThemeId(profile.theme_id)
      } else {
        saveProfile(user.id, { theme_id: themeId, unlocks: mergedUnlocks })
      }

      if (mergedUnlocks.length !== remoteUnlocks.length) {
        setUnlocks(mergedUnlocks)
        saveProfile(user.id, { unlocks: mergedUnlocks })
      }

      setPoints(profile.points)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Refresh points whenever something dispatches a 'points-changed' event.
  useEffect(() => {
    if (!user) return
    const refresh = () => {
      fetchProfile(user.id).then((profile) => {
        if (profile) setPoints(profile.points)
      })
    }
    window.addEventListener('points-changed', refresh)
    return () => window.removeEventListener('points-changed', refresh)
  }, [user])

  const selectTheme = (id: string) => {
    setThemeId(id)
    if (user) saveProfile(user.id, { theme_id: id })
  }

  const selectDeck = (id: string) => setDeckId(id)

  const addUnlock = (themeId: string) => {
    setUnlocks((prev) => {
      const next = Array.from(new Set([...prev, themeId]))
      if (user) saveProfile(user.id, { unlocks: next })
      return next
    })
  }

  return (
    <div className="page">
      <div className="nav-cluster">
        <button
          type="button"
          className="nav-button"
          aria-label="Open settings"
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.14 16.93l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.08a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.07 4.14l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.08a1.7 1.7 0 0 0-1.52 1.03Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <Link to="/leaderboards" className="nav-button" aria-label="Leaderboards">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M8 21h8M12 17v4M17 4h3v3a4 4 0 0 1-4 4M7 4H4v3a4 4 0 0 0 4 4M7 4h10v6a5 5 0 0 1-10 0V4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>

      {isHome && (
        <div className="top-right-cluster">
          <DailyBonus />
          {user && points !== null && (
            <div className="points-badge" aria-label="Points balance">
              <span className="points-badge-label">Points</span>
              <span className="points-badge-value">{points.toLocaleString()}</span>
            </div>
          )}
          <Link to="/shop" className="nav-button" aria-label="Shop">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M5 8h14l-1.4 11.2A2 2 0 0 1 15.6 21H8.4a2 2 0 0 1-2-1.8L5 8zM9 8V6a3 3 0 0 1 6 0v2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      )}

      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'is-open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}
        aria-label="Settings"
        aria-hidden={!sidebarOpen}
      >
        <div className="sidebar-header">
          <h2>Settings</h2>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Close settings"
            onClick={() => setSidebarOpen(false)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-label">Account</h3>
          <AuthPanel />
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-label">Theme</h3>
          <ul className="theme-list">
            {themes.map((t) => {
              const selected = t.id === theme.id
              const locked = !!t.locked && !unlocks.includes(t.id)
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`theme-option ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''} ${t.rarity ? `rarity-${t.rarity}` : ''}`}
                    onClick={() => !locked && selectTheme(t.id)}
                    aria-pressed={selected}
                    aria-disabled={locked}
                    title={locked ? (t.caseDropOnly ? 'locked. case drop only' : 'locked. buy in shop') : t.name}
                    style={
                      {
                        '--swatch': t.swatch,
                      } as CSSProperties
                    }
                  >
                    <span className="theme-name">{locked ? '???' : t.name}</span>
                    {t.rarity && (
                      <span
                        className={`theme-rarity-badge rarity-${t.rarity}`}
                        aria-label={rarityLabel(t.rarity)}
                      >
                        <RarityIcon rarity={t.rarity} />
                      </span>
                    )}
                    {locked && (
                      <span className="theme-lock" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="12" height="12">
                          <path
                            d="M7 10V8a5 5 0 0 1 10 0v2m-12 0h14v10H5V10z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-label">Card deck</h3>
          <ul className="theme-list">
            {cardDecks.map((d) => {
              const selected = d.id === deck.id
              const locked = !!d.locked && !unlocks.includes(d.id)
              const swatch = locked
                ? d.back
                : `linear-gradient(135deg, ${d.face} 0%, ${d.face} 60%, ${d.back} 60%)`
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    className={`theme-option ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''} ${d.rarity ? `rarity-${d.rarity}` : ''}`}
                    onClick={() => !locked && selectDeck(d.id)}
                    aria-pressed={selected}
                    aria-disabled={locked}
                    title={locked ? `locked. buy in shop` : d.name}
                    style={
                      {
                        '--swatch': swatch,
                      } as CSSProperties
                    }
                  >
                    <span className="theme-name">{locked ? '???' : d.name}</span>
                    {d.rarity && (
                      <span
                        className={`theme-rarity-badge rarity-${d.rarity}`}
                        aria-label={rarityLabel(d.rarity)}
                      >
                        <RarityIcon rarity={d.rarity} />
                      </span>
                    )}
                    {locked && (
                      <span className="theme-lock" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="12" height="12">
                          <path
                            d="M7 10V8a5 5 0 0 1 10 0v2m-12 0h14v10H5V10z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>

      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/leaderboards" element={<LeaderboardsPage />} />
        <Route
          path="/shop"
          element={
            <ShopPage unlocks={unlocks} points={points} onUnlock={addUnlock} />
          }
        />
        <Route path="/games/reaction" element={<ReactionGame />} />
        <Route path="/games/aim" element={<AimGame rarity={theme.rarity} />} />
        <Route path="/games/2048" element={<Game2048 />} />
        <Route path="/games/tetris" element={<TetrisGame />} />
        <Route path="/games/pattern" element={<PatternGame />} />
        <Route path="/games/color-match" element={<ColorMatchGame />} />
        <Route path="/games/type-sprint" element={<TypeSprintGame />} />
        <Route path="/games/mathdle" element={<MathdleGame />} />
        <Route path="/games/minesweeper" element={<MinesweeperGame />} />
        <Route path="/games/wordle" element={<WordleGame />} />
        <Route path="/games/chess" element={<ChessGame />} />
        <Route path="/games/blackjack" element={<BlackjackGame />} />
        <Route path="/games/roulette" element={<RouletteGame />} />
        <Route path="/games/ride-the-bus" element={<RideBusGame />} />
        <Route path="/games/cases" element={<CasesGame onUnlock={addUnlock} />} />
      </Routes>
      </Suspense>
    </div>
  )
}

export default App
