import { Link } from 'react-router-dom'

type Game = {
  id: string
  name: string
  description: string
  emoji: string
  /** Set when the game has a playable route. */
  path?: string
}

// Order in this array = order on the home grid.
// Memory Match, Typing Race, and Snake are intentionally absent — they are
// future ideas that haven't been built yet.
const games: Game[] = [
  {
    id: 'reaction',
    name: 'Reaction Test',
    description: 'How fast can you react?',
    emoji: '⚡',
    path: '/games/reaction',
  },
  {
    id: 'aim-trainer',
    name: 'Aim Trainer',
    description: 'Sharpen your reflexes and precision.',
    emoji: '🎯',
  },
  {
    id: 'chess',
    name: 'Chess',
    description: 'The classic game of strategy.',
    emoji: '♟️',
  },
]

export function HomePage() {
  return (
    <main className="container">
      <header className="hero">
        <h1 className="title">minigames</h1>
        <p className="subtitle">A small collection of games to play in your browser.</p>
      </header>

      <section className="grid" aria-label="Games">
        {games.map((game) =>
          game.path ? (
            <Link key={game.id} to={game.path} className="card">
              <div className="card-emoji" aria-hidden="true">
                {game.emoji}
              </div>
              <h2 className="card-title">{game.name}</h2>
              <p className="card-desc">{game.description}</p>
            </Link>
          ) : (
            <div key={game.id} className="card card-soon" aria-disabled="true">
              <span className="card-badge">Coming Soon</span>
              <div className="card-emoji" aria-hidden="true">
                {game.emoji}
              </div>
              <h2 className="card-title">{game.name}</h2>
              <p className="card-desc">{game.description}</p>
            </div>
          ),
        )}
      </section>
    </main>
  )
}
