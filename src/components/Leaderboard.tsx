import { useEffect, useState } from 'react'
import type { LeaderboardRow } from '../lib/leaderboards'

type Props = {
  title: string
  scoreLabel: string
  load: () => Promise<{ rows: LeaderboardRow[]; error?: string }>
  formatScore?: (score: number) => string
}

export function Leaderboard({ title, scoreLabel, load, formatScore }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load().then((res) => {
      if (cancelled) return
      setRows(res.rows)
      setError(res.error ?? null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <article className="leaderboard">
      <header className="leaderboard-header">
        <h2 className="leaderboard-title">{title}</h2>
        <span className="leaderboard-meta">{scoreLabel}</span>
      </header>

      {loading && <div className="leaderboard-empty">Loading…</div>}
      {!loading && error && (
        <div className="leaderboard-empty leaderboard-error">{error}</div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="leaderboard-empty">
          No scores yet. Be the first.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <ol className="leaderboard-list">
          {rows.map((row) => (
            <li key={`${row.rank}-${row.username}`} className="leaderboard-row">
              <span className="leaderboard-rank">{row.rank}</span>
              <span className="leaderboard-name">{row.username}</span>
              <span className="leaderboard-score">
                {formatScore ? formatScore(row.score) : row.score.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}
