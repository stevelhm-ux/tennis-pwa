import { supabase } from './supabase'
import type { Match } from './types'
import { getOrCreateOpponent } from './players'

export async function listMatches(tournamentId: string): Promise<Match[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Match[]
}

export async function createMatch({
  wsId, tournamentId, playerAId, playerBId
}: { wsId:string; tournamentId:string; playerAId:string; playerBId:string }) {
  const { data, error } = await supabase
    .from('matches')
    .insert({
      workspace_id: wsId,
      tournament_id: tournamentId,
      player_a_id: playerAId,
      player_b_id: playerBId
    })
    .select('id')              // 👈 get real UUID from server
    .single()

  if (error) throw error
  return data as { id: string }
}

/* NEW: update generic match fields */
export async function updateMatch(matchId: string, patch: Partial<Pick<Match,'event'|'surface'|'format'>>) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('matches')
    .update(patch)
    .eq('id', matchId)
    .select()
    .single()
  if (error) throw error
  return data as Match
}

/* NEW: change opponent by name (creates player if needed) */
export async function updateMatchOpponent(matchId: string, opponentName: string) {
  // fetch the match to get wsId
  const { data: m, error: e1 } = await supabase!.from('matches').select('workspace_id').eq('id', matchId).single()
  if (e1) throw e1
  const wsId = (m as any).workspace_id as string
  const opp = await getOrCreateOpponent(wsId, opponentName.trim())
  const { error } = await supabase!.from('matches').update({ player_b_id: opp.id }).eq('id', matchId)
  if (error) throw error
  return opp
}


async function updateMatchPlayerB(matchId: string, playerBId: string) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('matches')
    .update({ player_b_id: playerBId })
    .eq('id', matchId)
    .select()
    .single()
  if (error) throw error
  return data as Match
}

// src/lib/matches.ts (append)
export async function getMatchById(matchId: string): Promise<Match> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()
  if (error) throw error
  return data as Match
}

