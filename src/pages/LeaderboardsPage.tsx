import { Link } from 'react-router-dom'
import { Leaderboard } from '../components/Leaderboard'
import { fetchTotalPointsLeaderboard } from '../lib/leaderboards'

export function LeaderboardsPage() {
  return (
    <main className="container">
      <header className="hero hero-compact">
        <Link to="/" className="back-link">← Back</Link>
        <h1 className="title title-md">Leaderboards</h1>
        <p className="subtitle">The best of the best, across every game.</p>
      </header>

      <section className="leaderboards-grid" aria-label="Leaderboards">
        <Leaderboard
          title="Total Points"
          scoreLabel="Lifetime"
          load={() => fetchTotalPointsLeaderboard(100)}
        />
        {/* Future leaderboards (per-game high scores, etc.) drop in here. */}
      </section>
    </main>
  )
}
