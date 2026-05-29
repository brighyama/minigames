import { supabase } from './supabase'

export type Profile = {
  user_id: string
  username: string | null
  theme_id: string | null
  unlocks: string[]
  points: number
  lifetime_points: number
  updated_at: string
}

export type ProfilePatch = Partial<
  Pick<Profile, 'theme_id' | 'unlocks' | 'username'>
>

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, theme_id, unlocks, points, lifetime_points, updated_at')
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
  const { error } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    console.warn('[profile] save failed', error)
    return { error: error.message }
  }
  return {}
}
