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

export async function createMatch(args: {
  wsId: string, tournamentId: string,
  playerAId: string, playerBId: string
}): Promise<Match> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('matches')
    .insert({
      workspace_id: args.wsId,
      tournament_id: args.tournamentId,
      player_a_id: args.playerAId,
      player_b_id: args.playerBId,
      event: 'Tournament', surface: 'Hard', format: 'BO3'
    })
    .select()
    .single()
  if (error) throw error
  return data as Match
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
export async function updateMatchOpponent(wsId: string, matchId: string, opponentName: string) {
  const opp = await getOrCreateOpponent(wsId, opponentName.trim())
  return updateMatchPlayerB(matchId, opp.id)
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
