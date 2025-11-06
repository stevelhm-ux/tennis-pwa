// src/lib/matches.ts
import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/types'

export async function createMatch(params: {
  wsId: string
  tournamentId: string
  playerAId: string
  playerBId: string
}): Promise<{ id: string }> {
  const { wsId, tournamentId, playerAId, playerBId } = params
  const { data, error } = await supabase
    .from('matches')
    .insert({
      workspace_id: wsId,
      tournament_id: tournamentId,
      player_a_id: playerAId,
      player_b_id: playerBId,
    })
    .select('id')
    .single()
  if (error) throw error
  return data as { id: string }
}

export async function listMatches(wsId: string, opts?: { tournamentId?: string }): Promise<Match[]> {
  let q = supabase.from('matches').select('*').eq('workspace_id', wsId)
  if (opts?.tournamentId) q = q.eq('tournament_id', opts.tournamentId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Match[]
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const { data, error } = await supabase.from('matches').select('*').eq('id', matchId).single()
  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }
  return data as Match
}

export async function updateMatch(matchId: string, patch: Partial<Match>): Promise<Match> {
  const { data, error } = await supabase.from('matches').update(patch).eq('id', matchId).select('*').single()
  if (error) throw error
  return data as Match
}

export async function deleteMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from('matches').delete().eq('id', matchId)
  if (error) throw error
}
