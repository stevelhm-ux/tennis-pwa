import { supabase } from './supabase'
import { ensureMyPlayer } from './players'
import type { Player } from './types'

export async function getMyPlayer(wsId: string): Promise<Player | null> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) throw new Error('Not signed in')

  // read pref
  const { data: pref, error } = await supabase
    .from('user_prefs')
    .select('my_player_id')
    .eq('user_id', uid)
    .eq('workspace_id', wsId)
    .maybeSingle()
  if (error) throw error

  const myId = pref?.my_player_id
  if (!myId) return null

  const { data: p, error: e2 } = await supabase
    .from('players')
    .select('*')
    .eq('id', myId)
    .single()
  if (e2) throw e2
  return p as Player
}

/** sets my player by NAME (ensures a players row) and stores it in user_prefs */
export async function setMyPlayerByName(wsId: string, name: string): Promise<Player> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) throw new Error('Not signed in')

  const player = await ensureMyPlayer(wsId, name.trim())

  // upsert pref
  const { error } = await supabase
    .from('user_prefs')
    .upsert({ user_id: uid, workspace_id: wsId, my_player_id: player.id, updated_at: new Date().toISOString() })
  if (error) throw error

  // keep old localStorage for backward compat
  localStorage.setItem('my_player_name', player.name)
  return player
}
