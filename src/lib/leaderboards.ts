import { supabase } from './supabase'

export type LeaderboardRow = {
  rank: number
  username: string
  score: number
}

export type LeaderboardResult = {
  rows: LeaderboardRow[]
  error?: string
}

type ScoreRow = { rank: number; username: string; score: number }
type LifetimeRow = { rank: number; username: string; lifetime_points: number }

export async function fetchTotalPointsLeaderboard(
  limit = 100,
): Promise<LeaderboardResult> {
  if (!supabase) return { rows: [], error: 'Auth is not configured.' }
  const { data, error } = await supabase.rpc('get_leaderboard_total', {
    lim: limit,
  })
  if (error) {
    return { rows: [], error: error.message }
  }
  const rows = (data ?? []).map((r: LifetimeRow) => ({
    rank: r.rank,
    username: r.username,
    score: r.lifetime_points,
  }))
  return { rows }
}

export async function fetchReactionLeaderboard(
  limit = 100,
): Promise<LeaderboardResult> {
  if (!supabase) return { rows: [], error: 'Auth is not configured.' }
  const { data, error } = await supabase.rpc('get_leaderboard_reaction', {
    lim: limit,
  })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []).map((r: ScoreRow) => ({
    rank: r.rank,
    username: r.username,
    score: r.score,
  }))
  return { rows }
}

export async function fetchAimLeaderboard(
  limit = 100,
): Promise<LeaderboardResult> {
  if (!supabase) return { rows: [], error: 'Auth is not configured.' }
  const { data, error } = await supabase.rpc('get_leaderboard_aim', {
    lim: limit,
  })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []).map((r: ScoreRow) => ({
    rank: r.rank,
    username: r.username,
    score: r.score,
  }))
  return { rows }
}

export async function fetchPatternLeaderboard(
  limit = 100,
): Promise<LeaderboardResult> {
  if (!supabase) return { rows: [], error: 'Auth is not configured.' }
  const { data, error } = await supabase.rpc('get_leaderboard_pattern', {
    lim: limit,
  })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []).map((r: ScoreRow) => ({
    rank: r.rank,
    username: r.username,
    score: r.score,
  }))
  return { rows }
}

export async function fetchColorMatchLeaderboard(
  limit = 100,
): Promise<LeaderboardResult> {
  if (!supabase) return { rows: [], error: 'Auth is not configured.' }
  const { data, error } = await supabase.rpc('get_leaderboard_color_match', {
    lim: limit,
  })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []).map((r: ScoreRow) => ({
    rank: r.rank,
    username: r.username,
    score: r.score,
  }))
  return { rows }
}

export async function fetch2048Leaderboard(
  limit = 100,
): Promise<LeaderboardResult> {
  if (!supabase) return { rows: [], error: 'Auth is not configured.' }
  const { data, error } = await supabase.rpc('get_leaderboard_2048', {
    lim: limit,
  })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []).map((r: ScoreRow) => ({
    rank: r.rank,
    username: r.username,
    score: r.score,
  }))
  return { rows }
}

export async function fetchTetrisLeaderboard(
  limit = 100,
): Promise<LeaderboardResult> {
  if (!supabase) return { rows: [], error: 'Auth is not configured.' }
  const { data, error } = await supabase.rpc('get_leaderboard_tetris', {
    lim: limit,
  })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []).map((r: ScoreRow) => ({
    rank: r.rank,
    username: r.username,
    score: r.score,
  }))
  return { rows }
}

export async function fetchWordleLeaderboard(
  limit = 100,
): Promise<LeaderboardResult> {
  if (!supabase) return { rows: [], error: 'Auth is not configured.' }
  const { data, error } = await supabase.rpc('get_leaderboard_wordle', {
    lim: limit,
  })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []).map((r: ScoreRow) => ({
    rank: r.rank,
    username: r.username,
    score: r.score,
  }))
  return { rows }
}

export async function fetchMinesweeperLeaderboard(
  difficulty: 'easy' | 'medium' | 'hard',
  limit = 100,
): Promise<LeaderboardResult> {
  if (!supabase) return { rows: [], error: 'Auth is not configured.' }
  const { data, error } = await supabase.rpc('get_leaderboard_minesweeper', {
    diff: difficulty,
    lim: limit,
  })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []).map((r: ScoreRow) => ({
    rank: r.rank,
    username: r.username,
    score: r.score,
  }))
  return { rows }
}

export async function fetchCasinoWinLeaderboard(
  limit = 100,
): Promise<LeaderboardResult> {
  if (!supabase) return { rows: [], error: 'Auth is not configured.' }
  const { data, error } = await supabase.rpc('get_leaderboard_casino_win', {
    lim: limit,
  })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []).map((r: ScoreRow) => ({
    rank: r.rank,
    username: r.username,
    score: r.score,
  }))
  return { rows }
}

export async function fetchCasinoNetLeaderboard(
  limit = 100,
): Promise<LeaderboardResult> {
  if (!supabase) return { rows: [], error: 'Auth is not configured.' }
  const { data, error } = await supabase.rpc('get_leaderboard_casino_net', {
    lim: limit,
  })
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []).map((r: ScoreRow) => ({
    rank: r.rank,
    username: r.username,
    score: r.score,
  }))
  return { rows }
}
