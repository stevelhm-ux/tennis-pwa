import { supabase } from '@/lib/supabase'
import type { Tournament } from '@/lib/types'

export async function listTournaments(workspaceId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tournaments')
    .select('id,name,venue,date,grade')
    .eq('workspace_id', workspaceId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data || []) as Tournament[]
}

export async function createTournament(workspaceId: string, t: {
  name: string
  venue?: string
  date?: string  // YYYY-MM-DD
  grade?: 1|2|3|4|5
}) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ workspace_id: workspaceId, ...t })
    .select()
    .single()
  if (error) throw error
  return data as Tournament
}

export async function getTournamentById(id: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tournaments')
    .select('id,name,venue,date,grade')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Tournament
}
