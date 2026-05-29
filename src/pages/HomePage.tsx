import { Link } from 'react-router-dom'

type Game = {
  id: string
  name: string
  /** Set when the game has a playable route. */
  path?: string
  /**
   * Optional URL to an image file (e.g., '/games/reaction.png' placed in
   * `public/games/`). When set it fills the top 80% of the card.
   */
  image?: string
  /**
   * CSS background used when `image` is not set. Lets each game have a
   * distinct placeholder until art is added.
   */
  placeholderGradient?: string
}

// Order in each array = order within that section on the home page.
// Memory Match, Typing Race, and Snake are intentionally absent — they are
// future ideas that haven't been built yet.
const games: Game[] = [
  {
    id: 'reaction',
    name: 'Reaction Test',
    path: '/games/reaction',
    placeholderGradient:
      'linear-gradient(135deg, #c0392b 0%, #f4f4f4 50%, #27ae60 100%)',
  },
  {
    id: 'aim-trainer',
    name: 'Aim Trainer',
    path: '/games/aim',
    placeholderGradient:
      'radial-gradient(circle at 30% 30%, #6db2ff 0%, #2d4ea0 60%, #0e1a3a 100%)',
  },
  {
    id: 'chess',
    name: 'Chess',
    placeholderGradient: 'linear-gradient(135deg, #5e3a1c 0%, #d4b08c 100%)',
  },
]

// Wager-based games. Shown in their own "Casino" section below the rest.
const casinoGames: Game[] = [
  {
    id: 'blackjack',
    name: 'Blackjack',
    path: '/games/blackjack',
    placeholderGradient:
      'radial-gradient(ellipse at 50% 40%, #1f7a4d 0%, #0c3a26 60%, #06140d 100%)',
  },
  {
    id: 'roulette',
    name: 'Roulette',
    path: '/games/roulette',
    placeholderGradient:
      'radial-gradient(circle at 50% 45%, #b8862b 0%, #7a1f2b 45%, #1c0c10 100%)',
  },
]

function GameCard({ game }: { game: Game }) {
  const imageStyle = game.image
    ? { backgroundImage: `url(${game.image})` }
    : { background: game.placeholderGradient }

  const inner = (
    <>
      <div className="card-image" style={imageStyle} aria-hidden="true">
        {!game.path && <span className="card-badge">Coming Soon</span>}
      </div>
      <div className="card-footer">
        <h2 className="card-title">{game.name}</h2>
      </div>
    </>
  )

  return game.path ? (
    <Link to={game.path} className="card">
      {inner}
    </Link>
  ) : (
    <div className="card card-soon" aria-disabled="true">
      {inner}
    </div>
  )
}

export function HomePage() {
  return (
    <main className="container">
      <header className="hero">
        <h1 className="title">minigames</h1>
        <p className="subtitle">A small collection of games to play in your browser.</p>
      </header>

      <section className="grid" aria-label="Games">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </section>

      <section className="home-section" aria-labelledby="casino-heading">
        <h2 id="casino-heading" className="home-section-title">Casino</h2>
        <div className="grid">
          {casinoGames.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>
    </main>
  )
}
