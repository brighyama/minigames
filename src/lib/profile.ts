import { supabase } from './supabase'

export type Profile = {
  user_id: string
  username: string | null
  theme_id: string | null
  unlocks: string[]
  points: number
  lifetime_points: number
  last_daily_claim: string | null
  best_reaction_avg: number | null
  aim_high_score: number
  pattern_best_level: number
  color_match_best_score: number
  g2048_high_score: number
  tetris_sprint_ms: number | null
  wordle_last_day: number | null
  wordle_streak: number
  wordle_best_streak: number
  wordle_wins: number
  wordle_played: number
  mines_easy_ms: number | null
  mines_medium_ms: number | null
  mines_hard_ms: number | null
  casino_net: number
  casino_biggest_win: number
  updated_at: string
}

export type ProfilePatch = Partial<
  Pick<Profile, 'theme_id' | 'unlocks' | 'username'>
>

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, theme_id, unlocks, points, lifetime_points, last_daily_claim, best_reaction_avg, aim_high_score, pattern_best_level, color_match_best_score, g2048_high_score, tetris_sprint_ms, wordle_last_day, wordle_streak, wordle_best_streak, wordle_wins, wordle_played, mines_easy_ms, mines_medium_ms, mines_hard_ms, casino_net, casino_biggest_win, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('[profile] fetch failed', error)
    return null
  }
  return (data as Profile | null) ?? null
}

export async function saveProfile(
  userId: string,
  patch: ProfilePatch,
): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Auth is not configured.' }

  // NOTE: use UPDATE, not UPSERT. hardening.sql grants column-level UPDATE on
  // only the cosmetic columns (username, theme_id, unlocks, updated_at) — NOT
  // user_id. An upsert compiles to `INSERT ... ON CONFLICT DO UPDATE SET ...`
  // which includes user_id in the SET clause, so Postgres rejects it with
  // "permission denied for table profiles". A plain update never touches
  // user_id. (The row already exists for every user — the handle_new_user
  // trigger creates it on signup.)
  const stamp = new Date().toISOString()
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: stamp })
    .eq('user_id', userId)
    .select('user_id')
  if (error) {
    console.warn('[profile] save failed', error)
    return { error: error.message }
  }

  // Fallback: no row matched (e.g. a legacy account predating the trigger).
  // The insert grant *does* include user_id, so creating the row is allowed.
  if (!data || data.length === 0) {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ user_id: userId, ...patch, updated_at: stamp })
    if (insertError) {
      console.warn('[profile] insert failed', insertError)
      return { error: insertError.message }
    }
  }
  return {}
}
