import { Link } from 'react-router-dom'

type Game = {
  id: string
  name: string
  /** One-line descriptor shown under the name. */
  tagline: string
  /** Set when the game has a playable route. */
  path?: string
  /** Gradient used for the small monogram chip (the game's color identity). */
  gradient: string
}

// Order in each array = order within that section on the home page.
const games: Game[] = [
  {
    id: 'wordle',
    name: 'wordle',
    tagline: 'guess the word of the day',
    path: '/games/wordle',
    gradient: 'linear-gradient(135deg, #2e7d46 0%, #5a8b2c 50%, #b59230 100%)',
  },
  {
    id: 'reaction',
    name: 'reaction time',
    tagline: 'test your reflexes',
    path: '/games/reaction',
    gradient: 'linear-gradient(135deg, #c0392b 0%, #5c1c15 49%, #000000 50%, #1e5836 51%, #5cdb91 100%)',
  },
  {
    id: 'aim-trainer',
    name: 'aim trainer',
    tagline: 'click targets',
    path: '/games/aim',
    gradient: 'radial-gradient(circle at 40% 35%, #6f9cff 0%, #2d4ea0 55%, #0e1a3a 100%)',
  },
  {
    id: '2048',
    name: '2048',
    tagline: 'merge tiles to 2048',
    path: '/games/2048',
    gradient: 'linear-gradient(135deg, #edc22e 0%, #f67c5f 55%, #776e65 100%)',
  },
  {
    id: 'tetris',
    name: 'tetris',
    tagline: '40-line sprint',
    path: '/games/tetris',
    gradient: 'linear-gradient(135deg, #22d3d3 0%, #b15bd8 45%, #f59331 100%)',
  },
  {
    id: 'tetris-versus',
    name: 'tetris versus',
    tagline: 'battle a bot with garbage',
    path: '/games/tetris-versus',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #b15bd8 48%, #22d3d3 100%)',
  },
  {
    id: 'pattern',
    name: 'memory matrix',
    tagline: 'visual memory game',
    path: '/games/pattern',
    gradient: 'linear-gradient(135deg, #ffffff 0%, #3b7044 75%, #000000 100%)',
  },
  {
    id: 'color-match',
    name: 'color match',
    tagline: 'match the flash',
    path: '/games/color-match',
    gradient: 'linear-gradient(135deg, #ff4d6d 0%, #ffd166 33%, #06d6a0 66%, #4d96ff 100%)',
  },
  {
    id: 'type-sprint',
    name: 'type sprint',
    tagline: '20-second typing test',
    path: '/games/type-sprint',
    gradient: 'linear-gradient(135deg, #f8fafc 0%, #8bd3ff 34%, #1f8a70 68%, #0f172a 100%)',
  },
  {
    id: 'mathdle',
    name: 'mathdle',
    tagline: 'daily equation puzzle',
    path: '/games/mathdle',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #facc15 48%, #1f2937 100%)',
  },
  {
    id: 'chess',
    name: 'chess',
    tagline: 'play the engine',
    path: '/games/chess',
    gradient: 'linear-gradient(135deg, #5e3a1c 0%, #d4b08c 100%)',
  },
  {
    id: 'minesweeper',
    name: 'minesweeper',
    tagline: 'clear the field',
    path: '/games/minesweeper',
    gradient: 'linear-gradient(135deg, #2d5de2 0%, #7e2f2f 55%, #471717 100%)',
  },
]

// Wager-based games. Shown in their own "Casino" section below the rest.
const casinoGames: Game[] = [
  {
    id: 'blackjack',
    name: 'blackjack',
    tagline: 'beat the dealer to 21',
    path: '/games/blackjack',
    gradient: 'radial-gradient(ellipse at 50% 35%, #1f7a4d 0%, #0c3a26 65%, #06140d 100%)',
  },
  {
    id: 'roulette',
    name: 'roulette',
    tagline: 'spin the wheel',
    path: '/games/roulette',
    gradient: 'radial-gradient(circle at 50% 40%, #b8862b 0%, #7a1f2b 50%, #1c0c10 100%)',
  },
  {
    id: 'ride-the-bus',
    name: 'ride the bus',
    tagline: 'four calls, one ride',
    path: '/games/ride-the-bus',
    gradient: 'linear-gradient(135deg, #16a34a 0%, #7c3aed 48%, #111827 100%)',
  },
  {
    id: 'cases',
    name: 'cases',
    tagline: 'gold, gold, gold',
    path: '/games/cases',
    gradient: 'linear-gradient(135deg, #ffd764 0%, #c7a94d 45%, #a38b42 100%)',
  },
]

/** First letter/number of the name, for the monogram chip. */
function monogram(name: string): string {
  const m = name.match(/[a-z0-9]/i)
  return (m ? m[0] : '?').toUpperCase()
}

function GameCard({ game }: { game: Game }) {
  const inner = (
    <>
      <span className="game-mono" style={{ background: game.gradient }} aria-hidden="true">
        {monogram(game.name)}
      </span>
      <span className="game-info">
        <span className="game-name">{game.name}</span>
        {/* <span className="game-tag">{game.path ? game.tagline : 'coming soon'}</span> */}
      </span>
      <span className="game-go" aria-hidden="true">
        {game.path ? '›' : ''}
      </span>
    </>
  )

  return game.path ? (
    <Link to={game.path} className="game-tile">
      {inner}
    </Link>
  ) : (
    <div className="game-tile game-tile-soon" aria-disabled="true">
      {inner}
    </div>
  )
}

export function HomePage() {
  return (
    <main className="container">
      <header className="hero">
        <h1 className="title">minigames</h1>
        <p className="subtitle">a small collection of games to play in your browser</p>
      </header>

      <section className="home-section" aria-labelledby="games-heading">
        <h2 id="games-heading" className="home-section-title">games</h2>
        <div className="game-grid">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="casino-heading">
        <h2 id="casino-heading" className="home-section-title">casino</h2>
        <div className="game-grid">
          {casinoGames.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>
    </main>
  )
}
