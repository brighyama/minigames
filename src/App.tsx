import { useEffect, useState, type CSSProperties } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import './App.css'
import { useAuth } from './lib/auth'
import { fetchProfile, saveProfile } from './lib/profile'
import {
  themes,
  DEFAULT_REACTION_WAIT,
  DEFAULT_REACTION_GO,
} from './lib/themes'
import { AuthPanel } from './components/AuthPanel'
import { HomePage } from './pages/HomePage'
import { LeaderboardsPage } from './pages/LeaderboardsPage'
import { ShopPage } from './pages/ShopPage'
import { ReactionGame } from './games/reaction/ReactionGame'

const THEME_KEY = 'minigames:theme'
const UNLOCKS_KEY = 'minigames:unlocks'

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

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themeId, setThemeId] = useState<string>(() => {
    return localStorage.getItem(THEME_KEY) ?? themes[0].id
  })
  const [unlocks, setUnlocks] = useState<string[]>(() => loadUnlocks())
  const [points, setPoints] = useState<number | null>(null)

  const themeDef = themes.find((t) => t.id === themeId)
  const themeIsAvailable =
    themeDef !== undefined && (!themeDef.locked || unlocks.includes(themeDef.id))
  const theme = themeIsAvailable ? themeDef! : themes[0]

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--bg-start', theme.start)
    root.style.setProperty('--bg-stop', theme.stop)
    root.style.setProperty('--theme-text', theme.text ?? '#ffffff')
    root.style.setProperty('--theme-font', theme.font ?? 'inherit')
    root.style.setProperty(
      '--theme-title-shadow',
      theme.titleShadow ?? '0 8px 32px rgba(0, 0, 0, 0.3)',
    )
    root.style.setProperty('--reaction-wait', theme.reactionWait ?? DEFAULT_REACTION_WAIT)
    root.style.setProperty('--reaction-go', theme.reactionGo ?? DEFAULT_REACTION_GO)
    localStorage.setItem(THEME_KEY, theme.id)
  }, [theme])

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

      <div className="top-right-cluster">
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
                    className={`theme-option ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}
                    onClick={() => !locked && selectTheme(t.id)}
                    aria-pressed={selected}
                    aria-disabled={locked}
                    title={locked ? `Locked — buy in shop` : t.name}
                    style={
                      {
                        '--swatch': `linear-gradient(135deg, ${t.start}, ${t.stop})`,
                      } as CSSProperties
                    }
                  >
                    <span className="theme-name">{locked ? '???' : t.name}</span>
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
      </Routes>
    </div>
  )
}

export default App
