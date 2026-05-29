import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Leaderboard } from '../components/Leaderboard'
import { useAuth } from '../lib/auth'
import { fetchProfile } from '../lib/profile'
import {
  fetchTotalPointsLeaderboard,
  fetchReactionLeaderboard,
  fetchAimLeaderboard,
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
      ? 'Sign in and set a username to appear on the leaderboards.'
      : username === null
        ? 'Set a username in Settings → Account to appear on the leaderboards.'
        : null

  return (
    <main className="container">
      <header className="hero hero-compact">
        <Link to="/" className="back-link">← Back</Link>
        <h1 className="title title-md">Leaderboards</h1>
        <p className="subtitle">The best of the best, across every game.</p>
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
      </section>
    </main>
  )
}
