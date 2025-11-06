// src/lib/matches.ts
import { supabase } from '@/lib/supabase'

export async function createMatch(params: {
  wsId: string
  tournamentId: string
  playerAId: string
  playerBId: string
}) {
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
  return data as { id: string } // ← real UUID from server
}
