import type { HigherLowerCategoryId, HigherLowerItem } from './data'

const STORAGE_KEY = 'minigames:higher-lower:image-cache:v1'
const WIKIPEDIA_SUMMARY_API = 'https://en.wikipedia.org/api/rest_v1/page/summary'

type ImageCache = Record<string, string>

const memoryCache = new Map<string, string | null>()
const pending = new Map<string, Promise<string | null>>()
let persistedCache: ImageCache | null = null

const CS2_IMAGE_URLS: Record<string, string> = {
  'dragon-lore': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk4veqYaF7IfysCnWRxuF4j-B-Xxa_nBovp3Pdwtj9cC_GaAd0DZdwQu9fuhS4kNy0NePntVTbjYpCyyT_3CgY5i9j_a9cBkcCWUKV',
  howl: 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwiFO0P_6afVSKP-EAm6extF6ueZhW2exwkl2tmTXwt39eCiUPQR2DMN4TOVetUK8xoLgM-K341eM2otDnC6okGoXufBz_TAB',
  'fire-serpent': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0PSneqF-JeKDC2mE_u995LZWTTuygxIYvzSCkpu3cnvFPQB2DpUkROFY4Rntw93lP7i241DbiI1BxSuviHlKunk_6-sHU71lpPMTRLyP4Q',
  'glock-fade': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2kpnj9h1a7s2oaaBoH_yaCW-Ej-8u5bZvHnq1w0Vz62TUzNj4eCiVblMmXMAkROJeskLpkdXjMrzksVTAy9US8PY25So',
  'karambit-doppler': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Q7uCvZaZkNM-SA1iSze91u_FsTju_qhAmoT-Jn4bjJC_4Ml93UtZuRLQPsBawkNfiMbnl5AKMiopCnin7iCJBv31j4rkBBKEg-6zUjV3GY6p9v8dpLWT3Fg',
  'butterfly-tiger': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Z-ua6bbZrLOmsD2mv1edxtfNWQDuymxoijDGMnYftb3mfOg8hAsFzRrYCtxKxxtPlZOnl5gaM3ogQmX_7jnkdvHppseoGVvI7uvqAJhUGkWs',
  'deagle-blaze': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL1m5fn8Sdk7vORbqhsLfWAMWuZxuZi_uI_TX6wxxkjsGXXnImsJ37COlUoWcByEOMOtxa5kdXmNu3htVPZjN1bjXKpkHLRfQU',
  'case-hardened': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiNK0P2nZKFpH_yaCW-Ej7sk5bE8Sn-2lEpz4zndzoyvdHuUPwFzWZYiE7EK4Bi4k9TlY-y24FbAy9USGSiZd5Q',
  printstream: 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwjFS4_ega6F_H_OGMWrEwL9lj_F7Rienhgk1tjyIpYPwJiPTcAAoCpsiEO5ZsUbpm9C2Zuni4VHW3o5EzSX62HxP7Sg96-hWVqYi_6TJz1aW0nxrkGs',
  'kill-confirmed': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLkjYbf7itX6vytbbZSI-WsG3SA_uV_vO1WTCa9kxQ1vjiBpYPwJiPTcFB2Xpp5TO5cskG9lYCxZu_jsVCL3o4Xnij23ClO5ik9tegFA_It8qHJz1aWe-uc160',
  'awp-asiimov': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V6V-Kf2cGFidxOp_pewnF3nhxEt0sGnSzN76dH3GOg9xC8FyEORftRe-x9PuYurq71bW3d8UnjK-0H0YSTpMGQ',
  'ak-redline': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0POlPPNSI_-RHGavzedxuPUnFniykEtzsWWBzoyuIiifaAchDZUjTOZe4RC_w4buM-6z7wzbgokUyzK-0H08hRGDMA',
}

const DIRECT_IMAGE_URLS: Record<string, string> = {
  spotify: 'https://cdn.simpleicons.org/spotify/ffffff',
  roblox: 'https://cdn.simpleicons.org/roblox/ffffff',
  linkedin: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/LinkedIn_logo_initials.png?width=1200',
  wordle: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Wordle_196_example.svg?width=1200',
  hades: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/header.jpg',
  'hollow-knight': 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/header.jpg',
  'last-of-us': 'https://cdn.cloudflare.steamstatic.com/steam/apps/1888930/header.jpg',
  stardew: 'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/header.jpg',
  cyberpunk: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg',
}

const COUNTRY_CODES: Record<string, string> = {
  india: 'in',
  china: 'cn',
  usa: 'us',
  indonesia: 'id',
  pakistan: 'pk',
  nigeria: 'ng',
  brazil: 'br',
  bangladesh: 'bd',
  russia: 'ru',
  mexico: 'mx',
  japan: 'jp',
  philippines: 'ph',
  egypt: 'eg',
  vietnam: 'vn',
  germany: 'de',
  turkey: 'tr',
  thailand: 'th',
  uk: 'gb',
  france: 'fr',
  'south-africa': 'za',
}

const WIKIPEDIA_TITLES: Record<string, string> = {
  youtube: 'YouTube',
  weather: 'Weather',
  facebook: 'Facebook',
  amazon: 'Amazon_(company)',
  netflix: 'Netflix',
  gmail: 'Gmail',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  spotify: 'Spotify',
  reddit: 'Reddit',
  chatgpt: 'ChatGPT',
  wikipedia: 'Wikipedia',
  roblox: 'Roblox',
  minecraft: 'Creeper_(Minecraft)',
  nba: 'National_Basketball_Association',
  wordle: 'Wordle',
  costco: 'Costco',
  duolingo: 'Duolingo',
  steam: 'Steam_(service)',
  linkedin: 'LinkedIn',

  shawshank: 'The_Shawshank_Redemption',
  godfather: 'The_Godfather',
  'dark-knight': 'The_Dark_Knight',
  'pulp-fiction': 'Pulp_Fiction',
  'lotr-return': 'The_Lord_of_the_Rings:_The_Return_of_the_King',
  interstellar: 'Interstellar_(film)',
  parasite: 'Parasite_(2019_film)',
  'spirited-away': 'Spirited_Away',
  gladiator: 'Gladiator_(2000_film)',
  whiplash: 'Whiplash_(2014_film)',
  alien: 'Alien_(film)',
  inception: 'Inception',
  goodfellas: 'Goodfellas',
  'social-network': 'The_Social_Network',
  barbie: 'Barbie_(film)',
  'avatar-water': 'Avatar:_The_Way_of_Water',
  joker: 'Joker_(2019_film)',
  'mad-max': 'Mad_Max:_Fury_Road',
  everything: 'Everything_Everywhere_All_at_Once',
  shrek: 'Shrek',

  'zelda-ocarina': 'The_Legend_of_Zelda:_Ocarina_of_Time',
  'gta-v': 'Grand_Theft_Auto_V',
  rdr2: 'Red_Dead_Redemption_2',
  'elden-ring': 'Elden_Ring',
  'baldurs-gate-3': "Baldur's_Gate_3",
  'portal-2': 'Portal_2',
  'last-of-us': 'The_Last_of_Us',
  hades: 'Hades_(video_game)',
  'minecraft-game': 'Creeper_(Minecraft)',
  'half-life-2': 'Half-Life_2',
  'mass-effect-2': 'Mass_Effect_2',
  'hollow-knight': 'Hollow_Knight',
  stardew: 'Stardew_Valley',
  cyberpunk: 'Cyberpunk_2077',
  fortnite: 'Meowscles',
  'among-us': 'Among_Us',
  'no-mans-sky': "No_Man's_Sky",
  'pokemon-sv': 'Pokémon_Scarlet_and_Violet',

  india: 'India',
  china: 'China',
  usa: 'United_States',
  indonesia: 'Indonesia',
  pakistan: 'Pakistan',
  nigeria: 'Nigeria',
  brazil: 'Brazil',
  bangladesh: 'Bangladesh',
  russia: 'Russia',
  mexico: 'Mexico',
  japan: 'Japan',
  philippines: 'Philippines',
  egypt: 'Egypt',
  vietnam: 'Vietnam',
  germany: 'Germany',
  turkey: 'Turkey',
  thailand: 'Thailand',
  uk: 'United_Kingdom',
  france: 'France',
  'south-africa': 'South_Africa',
}

function cacheKey(categoryId: HigherLowerCategoryId, item: HigherLowerItem): string {
  return `${categoryId}:${item.id}`
}

function staticItemImage(
  categoryId: HigherLowerCategoryId,
  item: HigherLowerItem,
): string | null {
  if (categoryId === 'cs2') return CS2_IMAGE_URLS[item.id] ?? null
  if (categoryId === 'population') {
    const code = COUNTRY_CODES[item.id]
    return code ? `https://flagcdn.com/w1280/${code}.png` : null
  }
  return DIRECT_IMAGE_URLS[item.id] ?? null
}

function loadPersistedCache(): ImageCache {
  if (persistedCache) return persistedCache
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown
    persistedCache =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.fromEntries(
            Object.entries(parsed).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === 'string' && entry[1].startsWith('https://'),
            ),
          )
        : {}
  } catch {
    persistedCache = {}
  }
  return persistedCache
}

function remember(key: string, source: string | null): string | null {
  memoryCache.set(key, source)
  if (!source) return null
  const cache = loadPersistedCache()
  cache[key] = source
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Storage is optional; browser and module caches still help.
  }
  return source
}

async function resolveWikipediaImage(item: HigherLowerItem): Promise<string | null> {
  const title = WIKIPEDIA_TITLES[item.id] ?? item.name.replace(/\s+/g, '_')
  const response = await fetch(`${WIKIPEDIA_SUMMARY_API}/${encodeURIComponent(title)}`)
  if (!response.ok) return null
  const data = await response.json() as {
    originalimage?: { source?: string }
    thumbnail?: { source?: string }
  }
  return data.originalimage?.source ?? data.thumbnail?.source ?? null
}

export function cachedItemImage(
  categoryId: HigherLowerCategoryId,
  item: HigherLowerItem,
): string | null | undefined {
  const key = cacheKey(categoryId, item)
  if (memoryCache.has(key)) return memoryCache.get(key)
  const staticSource = staticItemImage(categoryId, item)
  if (staticSource) {
    memoryCache.set(key, staticSource)
    return staticSource
  }
  const persisted = loadPersistedCache()[key]
  if (persisted) {
    memoryCache.set(key, persisted)
    return persisted
  }
  return undefined
}

export function resolveItemImage(
  categoryId: HigherLowerCategoryId,
  item: HigherLowerItem,
): Promise<string | null> {
  const key = cacheKey(categoryId, item)
  const cached = cachedItemImage(categoryId, item)
  if (cached !== undefined) return Promise.resolve(cached)
  const existing = pending.get(key)
  if (existing) return existing

  const request = resolveWikipediaImage(item)
    .then((source) => remember(key, source))
    .catch(() => remember(key, null))
    .finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}
