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
  const rows = (data ?? []).map((r: { rank: number; username: string; lifetime_points: number }) => ({
    rank: r.rank,
    username: r.username,
    score: r.lifetime_points,
  }))
  return { rows }
}
