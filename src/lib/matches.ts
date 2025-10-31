
import { supabase } from './supabase'
import type { Match } from './types'

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
