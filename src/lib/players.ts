
import { supabase } from './supabase'
import type { Player } from './types'

export async function findPlayerByName(workspaceId: string, name: string): Promise<Player | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('workspace_id', workspaceId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as Player | null
}

export async function ensureMyPlayer(workspaceId: string, name: string): Promise<Player> {
  const existing = await findPlayerByName(workspaceId, name)
  if (existing) return existing
  const { data, error } = await (supabase as any)
    .from('players')
    .insert({ workspace_id: workspaceId, name, handedness: 'R' })
    .select()
    .single()
  if (error) throw error
  return data as Player
}

export async function getOrCreateOpponent(workspaceId: string, name: string): Promise<Player> {
  const existing = await findPlayerByName(workspaceId, name)
  if (existing) return existing
  const { data, error } = await (supabase as any)
    .from('players')
    .insert({ workspace_id: workspaceId, name, handedness: 'R' })
    .select()
    .single()
  if (error) throw error
  return data as Player
}

export async function getPlayersByIds(ids: string[]): Promise<Record<string, Player>> {
  if (!supabase || ids.length === 0) return {}
  const { data, error } = await supabase.from('players').select('*').in('id', ids)
  if (error) throw error
  const map: Record<string, Player> = {}
  for (const p of (data || []) as Player[]) map[p.id] = p
  return map
}
