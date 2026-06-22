export type HigherLowerCategoryId =
  | 'searches'
  | 'movies'
  | 'cs2'
  | 'games'
  | 'population'

export type HigherLowerItem = {
  id: string
  name: string
  subtitle: string
  value: number
  symbol: string
  gradient: string
}

export type HigherLowerCategory = {
  id: HigherLowerCategoryId
  name: string
  description: string
  question: string
  metric: string
  snapshot: string
  format: (value: number) => string
  items: HigherLowerItem[]
}

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const item = (
  id: string,
  name: string,
  subtitle: string,
  value: number,
  symbol: string,
  gradient: string,
): HigherLowerItem => ({ id, name, subtitle, value, symbol, gradient })

export const HIGHER_LOWER_CATEGORIES: HigherLowerCategory[] = [
  {
    id: 'searches',
    name: 'internet searches',
    description: 'the original-style popularity showdown',
    question: 'monthly searches',
    metric: 'estimated monthly searches',
    snapshot: 'curated popularity estimates · June 2026',
    format: (value) => compact.format(value),
    items: [
      item('youtube', 'YouTube', 'video platform', 1_200_000_000, '▶', 'linear-gradient(145deg, #ff0033, #5d0719)'),
      item('weather', 'Weather', 'forecast searches', 410_000_000, '☀', 'linear-gradient(145deg, #38bdf8, #1d4ed8)'),
      item('facebook', 'Facebook', 'social network', 680_000_000, 'f', 'linear-gradient(145deg, #1877f2, #0f2d6b)'),
      item('amazon', 'Amazon', 'online shopping', 510_000_000, 'a', 'linear-gradient(145deg, #ffb13b, #6f3c00)'),
      item('netflix', 'Netflix', 'streaming service', 290_000_000, 'N', 'linear-gradient(145deg, #e50914, #3b070a)'),
      item('gmail', 'Gmail', 'email service', 360_000_000, 'M', 'linear-gradient(145deg, #ea4335, #7a1e18)'),
      item('instagram', 'Instagram', 'photo sharing', 460_000_000, '◎', 'linear-gradient(145deg, #f9ce34, #ee2a7b 52%, #6228d7)'),
      item('tiktok', 'TikTok', 'short-form video', 250_000_000, '♪', 'linear-gradient(145deg, #25f4ee, #111 48%, #fe2c55)'),
      item('spotify', 'Spotify', 'music streaming', 120_000_000, '●', 'linear-gradient(145deg, #1ed760, #075126)'),
      item('reddit', 'Reddit', 'community forums', 150_000_000, 'r/', 'linear-gradient(145deg, #ff4500, #6a1d00)'),
      item('chatgpt', 'ChatGPT', 'AI assistant', 330_000_000, '✦', 'linear-gradient(145deg, #10a37f, #163c35)'),
      item('wikipedia', 'Wikipedia', 'online encyclopedia', 190_000_000, 'W', 'linear-gradient(145deg, #f5f5f5, #4b5563)'),
      item('roblox', 'Roblox', 'game platform', 180_000_000, '◇', 'linear-gradient(145deg, #f4f4f5, #27272a)'),
      item('minecraft', 'Minecraft', 'sandbox game', 95_000_000, '▦', 'linear-gradient(145deg, #7bb33d, #3e5e22)'),
      item('nba', 'NBA', 'basketball league', 76_000_000, '●', 'linear-gradient(145deg, #f97316, #7c2d12)'),
      item('wordle', 'Wordle', 'daily word puzzle', 24_000_000, 'W', 'linear-gradient(145deg, #6aaa64, #31572c)'),
      item('costco', 'Costco', 'warehouse retailer', 34_000_000, 'C', 'linear-gradient(145deg, #e31837, #07549a)'),
      item('duolingo', 'Duolingo', 'language learning', 18_000_000, 'D', 'linear-gradient(145deg, #58cc02, #1f6b00)'),
      item('steam', 'Steam', 'PC game store', 82_000_000, '◉', 'linear-gradient(145deg, #1b2838, #66c0f4)'),
      item('linkedin', 'LinkedIn', 'professional network', 110_000_000, 'in', 'linear-gradient(145deg, #0a66c2, #07315a)'),
    ],
  },
  {
    id: 'movies',
    name: 'movie ratings',
    description: 'which film did audiences rate higher?',
    question: 'audience rating',
    metric: 'IMDb-style audience rating',
    snapshot: 'rounded reference ratings · June 2026',
    format: (value) => `${value.toFixed(1)} / 10`,
    items: [
      item('shawshank', 'The Shawshank Redemption', '1994 · drama', 9.3, '⛏', 'linear-gradient(145deg, #6b7280, #1f2937)'),
      item('godfather', 'The Godfather', '1972 · crime', 9.2, '♛', 'linear-gradient(145deg, #6b1f1f, #160707)'),
      item('dark-knight', 'The Dark Knight', '2008 · action', 9.0, '◥', 'linear-gradient(145deg, #273449, #05070b)'),
      item('pulp-fiction', 'Pulp Fiction', '1994 · crime', 8.9, '✦', 'linear-gradient(145deg, #facc15, #9f1239)'),
      item('lotr-return', 'The Return of the King', '2003 · fantasy', 9.0, '◉', 'linear-gradient(145deg, #d4a94d, #365314)'),
      item('interstellar', 'Interstellar', '2014 · sci-fi', 8.7, '✺', 'linear-gradient(145deg, #60a5fa, #111827 65%)'),
      item('parasite', 'Parasite', '2019 · thriller', 8.5, '▰', 'linear-gradient(145deg, #d1d5db, #172554)'),
      item('spirited-away', 'Spirited Away', '2001 · animation', 8.6, '✿', 'linear-gradient(145deg, #f9a8d4, #0f766e)'),
      item('gladiator', 'Gladiator', '2000 · epic', 8.5, '⚔', 'linear-gradient(145deg, #d6b46b, #713f12)'),
      item('whiplash', 'Whiplash', '2014 · drama', 8.5, '♫', 'linear-gradient(145deg, #f59e0b, #7f1d1d)'),
      item('alien', 'Alien', '1979 · horror', 8.5, '⌁', 'linear-gradient(145deg, #84cc16, #111827)'),
      item('inception', 'Inception', '2010 · sci-fi', 8.8, '◫', 'linear-gradient(145deg, #38bdf8, #172554)'),
      item('goodfellas', 'Goodfellas', '1990 · crime', 8.7, '♠', 'linear-gradient(145deg, #ef4444, #18181b)'),
      item('social-network', 'The Social Network', '2010 · drama', 7.8, 'ƒ', 'linear-gradient(145deg, #3b82f6, #172554)'),
      item('barbie', 'Barbie', '2023 · comedy', 6.8, 'B', 'linear-gradient(145deg, #fb60c5, #9d174d)'),
      item('avatar-water', 'Avatar: The Way of Water', '2022 · sci-fi', 7.5, '≈', 'linear-gradient(145deg, #22d3ee, #075985)'),
      item('joker', 'Joker', '2019 · drama', 8.3, '☺', 'linear-gradient(145deg, #facc15, #166534)'),
      item('mad-max', 'Mad Max: Fury Road', '2015 · action', 8.1, '☼', 'linear-gradient(145deg, #fb923c, #7c2d12)'),
      item('everything', 'Everything Everywhere All at Once', '2022 · sci-fi', 7.7, '◌', 'linear-gradient(145deg, #a78bfa, #be123c)'),
      item('shrek', 'Shrek', '2001 · animation', 7.9, 'S', 'linear-gradient(145deg, #84cc16, #365314)'),
    ],
  },
  {
    id: 'cs2',
    name: 'CS2 skin prices',
    description: 'compare iconic Factory New market references',
    question: 'reference price',
    metric: 'Factory New reference price',
    snapshot: 'market snapshot · June 22, 2026 · prices fluctuate',
    format: (value) => money.format(value),
    items: [
      item('dragon-lore', 'AWP | Dragon Lore', 'Factory New', 11_062, 'AWP', 'linear-gradient(145deg, #d6a63b, #6f2c13)'),
      item('howl', 'M4A4 | Howl', 'Factory New', 6_500, 'M4', 'linear-gradient(145deg, #ef4444, #451a03)'),
      item('fire-serpent', 'AK-47 | Fire Serpent', 'Factory New', 2_200, 'AK', 'linear-gradient(145deg, #65a30d, #713f12)'),
      item('glock-fade', 'Glock-18 | Fade', 'Factory New', 1_791, 'G', 'linear-gradient(145deg, #f9a8d4, #60a5fa 55%, #facc15)'),
      item('karambit-doppler', 'Karambit | Doppler', 'Factory New · standard phase', 1_234, 'K', 'linear-gradient(145deg, #a855f7, #0f172a 60%, #2563eb)'),
      item('butterfly-tiger', 'Butterfly Knife | Tiger Tooth', 'Factory New', 1_068, 'B', 'linear-gradient(145deg, #facc15, #b45309 52%, #111827)'),
      item('deagle-blaze', 'Desert Eagle | Blaze', 'Factory New', 659, 'DE', 'linear-gradient(145deg, #f97316, #7f1d1d)'),
      item('case-hardened', 'AK-47 | Case Hardened', 'Factory New · standard pattern', 560, 'AK', 'linear-gradient(145deg, #2563eb, #d97706)'),
      item('printstream', 'M4A1-S | Printstream', 'Factory New', 458, 'M1', 'linear-gradient(145deg, #fafafa, #6b7280)'),
      item('kill-confirmed', 'USP-S | Kill Confirmed', 'Factory New', 254, 'USP', 'linear-gradient(145deg, #ef4444, #f8fafc 45%, #111827)'),
      item('awp-asiimov', 'AWP | Asiimov', 'Field-Tested · best available wear', 115, 'AWP', 'linear-gradient(145deg, #f97316, #f8fafc 48%, #111827)'),
      item('ak-redline', 'AK-47 | Redline', 'Minimal Wear · best available wear', 176, 'AK', 'linear-gradient(145deg, #ef4444, #18181b 55%)'),
    ],
  },
  {
    id: 'games',
    name: 'video game scores',
    description: 'critic scores for landmark releases',
    question: 'critic score',
    metric: 'rounded Metacritic-style score',
    snapshot: 'reference critic scores · all platforms',
    format: (value) => `${Math.round(value)} / 100`,
    items: [
      item('zelda-ocarina', 'Ocarina of Time', 'Nintendo 64 · 1998', 99, '▲', 'linear-gradient(145deg, #22c55e, #d4a017)'),
      item('gta-v', 'Grand Theft Auto V', '2013', 97, 'V', 'linear-gradient(145deg, #34d399, #1f2937)'),
      item('rdr2', 'Red Dead Redemption 2', '2018', 97, 'R', 'linear-gradient(145deg, #dc2626, #451a03)'),
      item('elden-ring', 'Elden Ring', '2022', 96, '◉', 'linear-gradient(145deg, #d4a94d, #292524)'),
      item('baldurs-gate-3', "Baldur's Gate 3", '2023', 96, 'Ⅲ', 'linear-gradient(145deg, #f59e0b, #7f1d1d)'),
      item('portal-2', 'Portal 2', '2011', 95, '◌', 'linear-gradient(145deg, #fb923c, #38bdf8)'),
      item('last-of-us', 'The Last of Us', '2013', 95, 'Ⅱ', 'linear-gradient(145deg, #84cc16, #292524)'),
      item('hades', 'Hades', '2020', 93, 'Ψ', 'linear-gradient(145deg, #ef4444, #111827)'),
      item('minecraft-game', 'Minecraft', '2011', 93, '▦', 'linear-gradient(145deg, #84cc16, #713f12)'),
      item('half-life-2', 'Half-Life 2', '2004', 96, 'λ', 'linear-gradient(145deg, #f97316, #374151)'),
      item('mass-effect-2', 'Mass Effect 2', '2010', 96, 'N7', 'linear-gradient(145deg, #ef4444, #172554)'),
      item('hollow-knight', 'Hollow Knight', '2017', 90, '♜', 'linear-gradient(145deg, #c4b5fd, #111827)'),
      item('stardew', 'Stardew Valley', '2016', 89, '♣', 'linear-gradient(145deg, #60a5fa, #65a30d)'),
      item('cyberpunk', 'Cyberpunk 2077', '2020 launch', 86, 'C', 'linear-gradient(145deg, #facc15, #06b6d4)'),
      item('fortnite', 'Fortnite', '2017', 81, 'F', 'linear-gradient(145deg, #a855f7, #38bdf8)'),
      item('among-us', 'Among Us', '2018', 85, 'ඞ', 'linear-gradient(145deg, #ef4444, #111827)'),
      item('no-mans-sky', "No Man's Sky", '2016 launch', 71, '◭', 'linear-gradient(145deg, #ec4899, #2563eb)'),
      item('pokemon-sv', 'Pokémon Scarlet & Violet', '2022', 72, '●', 'linear-gradient(145deg, #dc2626, #7c3aed)'),
    ],
  },
  {
    id: 'population',
    name: 'country populations',
    description: 'which country has more people?',
    question: 'population',
    metric: 'estimated population',
    snapshot: 'rounded 2025–2026 estimates',
    format: (value) => compact.format(value),
    items: [
      item('india', 'India', 'South Asia', 1_460_000_000, 'IN', 'linear-gradient(145deg, #f97316, #f8fafc 48%, #16a34a)'),
      item('china', 'China', 'East Asia', 1_410_000_000, 'CN', 'linear-gradient(145deg, #ef4444, #facc15)'),
      item('usa', 'United States', 'North America', 347_000_000, 'US', 'linear-gradient(145deg, #2563eb, #f8fafc 48%, #dc2626)'),
      item('indonesia', 'Indonesia', 'Southeast Asia', 286_000_000, 'ID', 'linear-gradient(145deg, #ef4444, #f8fafc)'),
      item('pakistan', 'Pakistan', 'South Asia', 255_000_000, 'PK', 'linear-gradient(145deg, #15803d, #f8fafc)'),
      item('nigeria', 'Nigeria', 'West Africa', 238_000_000, 'NG', 'linear-gradient(145deg, #16a34a, #f8fafc 50%, #16a34a)'),
      item('brazil', 'Brazil', 'South America', 213_000_000, 'BR', 'linear-gradient(145deg, #16a34a, #facc15 50%, #2563eb)'),
      item('bangladesh', 'Bangladesh', 'South Asia', 176_000_000, 'BD', 'linear-gradient(145deg, #15803d, #dc2626)'),
      item('russia', 'Russia', 'Europe & Asia', 144_000_000, 'RU', 'linear-gradient(145deg, #f8fafc, #2563eb 50%, #dc2626)'),
      item('mexico', 'Mexico', 'North America', 132_000_000, 'MX', 'linear-gradient(145deg, #16a34a, #f8fafc 48%, #dc2626)'),
      item('japan', 'Japan', 'East Asia', 123_000_000, 'JP', 'linear-gradient(145deg, #f8fafc, #dc2626)'),
      item('philippines', 'Philippines', 'Southeast Asia', 117_000_000, 'PH', 'linear-gradient(145deg, #2563eb, #dc2626 55%, #facc15)'),
      item('egypt', 'Egypt', 'North Africa', 116_000_000, 'EG', 'linear-gradient(145deg, #dc2626, #f8fafc 48%, #111827)'),
      item('vietnam', 'Vietnam', 'Southeast Asia', 101_000_000, 'VN', 'linear-gradient(145deg, #dc2626, #facc15)'),
      item('germany', 'Germany', 'Central Europe', 84_000_000, 'DE', 'linear-gradient(145deg, #111827, #dc2626 50%, #facc15)'),
      item('turkey', 'Türkiye', 'Europe & Asia', 87_000_000, 'TR', 'linear-gradient(145deg, #dc2626, #f8fafc)'),
      item('thailand', 'Thailand', 'Southeast Asia', 72_000_000, 'TH', 'linear-gradient(145deg, #dc2626, #f8fafc 45%, #1e3a8a)'),
      item('uk', 'United Kingdom', 'Northern Europe', 69_000_000, 'UK', 'linear-gradient(145deg, #1d4ed8, #f8fafc 45%, #dc2626)'),
      item('france', 'France', 'Western Europe', 66_000_000, 'FR', 'linear-gradient(145deg, #1d4ed8, #f8fafc 50%, #dc2626)'),
      item('south-africa', 'South Africa', 'Southern Africa', 65_000_000, 'ZA', 'linear-gradient(145deg, #16a34a, #facc15 45%, #2563eb)'),
    ],
  },
]

export function categoryById(id: HigherLowerCategoryId): HigherLowerCategory {
  return HIGHER_LOWER_CATEGORIES.find((category) => category.id === id)!
}

