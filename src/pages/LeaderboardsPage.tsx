import { useEffect, useState } from 'react'
import { Leaderboard } from '../components/Leaderboard'
import { BackButton } from '../components/BackButton'
import { useAuth } from '../lib/auth'
import { fetchProfile } from '../lib/profile'
import {
  fetchTotalPointsLeaderboard,
  fetchReactionLeaderboard,
  fetchAimLeaderboard,
  fetch2048Leaderboard,
  fetchCasinoWinLeaderboard,
  fetchCasinoNetLeaderboard,
} from '../lib/leaderboards'

export function LeaderboardsPage() {
  const { user } = useAuth()
  const [username, setUsername] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!user) {
      setUsername(null)
      return
    }
    let cancelled = false
    fetchProfile(user.id).then((profile) => {
      if (cancelled) return
      setUsername(profile?.username ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // Show a banner if the player wouldn't appear in the leaderboards yet.
  const banner =
    user === null
      ? 'sign in and set a username to appear on the leaderboards.'
      : username === null
        ? 'set a username in Settings → Account to appear on the leaderboards.'
        : null

  return (
    <main className="container">
      <BackButton />
      <header className="hero hero-compact">
        <h1 className="title title-md">leaderboards</h1>
        <p className="subtitle">the best of the best</p>
      </header>

      {banner && <div className="leaderboard-banner">{banner}</div>}

      <section className="leaderboards-grid" aria-label="Leaderboards">
        <Leaderboard
          title="Total Points"
          scoreLabel="Lifetime"
          load={() => fetchTotalPointsLeaderboard(100)}
        />
        <Leaderboard
          title="Reaction Time"
          scoreLabel="Best avg"
          load={() => fetchReactionLeaderboard(100)}
          formatScore={(s) => `${s} ms`}
        />
        <Leaderboard
          title="Aim Trainer"
          scoreLabel="Best score"
          load={() => fetchAimLeaderboard(100)}
        />
        <Leaderboard
          title="2048"
          scoreLabel="Best tile"
          load={() => fetch2048Leaderboard(100)}
        />
        <Leaderboard
          title="Biggest Win"
          scoreLabel="Single round"
          load={() => fetchCasinoWinLeaderboard(100)}
        />
        <Leaderboard
          title="Casino Net"
          scoreLabel="Net winnings"
          load={() => fetchCasinoNetLeaderboard(100)}
          formatScore={(s) => (s > 0 ? `+${s.toLocaleString()}` : s.toLocaleString())}
        />
      </section>
    </main>
  )
}
