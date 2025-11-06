// src/lib/matches.ts
import { supabase } from '@/lib/supabase'
import type { Match } from '@/lib/types'

/** Find a player by exact name in a workspace; returns the id or null */
async function findPlayerIdByName(wsId: string, name: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('players')
    .select('id')
    .eq('workspace_id', wsId)
    .eq('name', name)
    .limit(1)

  if (error) throw error
  return data?.[0]?.id ?? null
}

/** Ensure a player exists (by name) in a workspace; returns the id */
async function ensurePlayerId(wsId: string, name: string): Promise<string> {
  const existing = await findPlayerIdByName(wsId, name)
  if (existing) return existing

  const { data, error } = await supabase
    .from('players')
    .insert({ workspace_id: wsId, name })
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

/**
 * Create a match and return the server UUID.
 * Use the returned id when navigating to the scoring page.
 */
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

/**
 * List matches (optionally filter by tournament).
 * Always constrained to the provided workspace.
 */
export async function listMatches(
  wsId: string,
  opts?: { tournamentId?: string }
): Promise<Match[]> {
  let q = supabase.from('matches').select('*').eq('workspace_id', wsId)

  if (opts?.tournamentId) q = q.eq('tournament_id', opts.tournamentId)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Match[]
}

/** Fetch a single match by id */
export async function getMatch(matchId: string): Promise<Match | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (error) {
    // PostgREST not-found code varies; if no data returned, treat as null
    if ((error as any).code === 'PGRST116') return null
    throw error
  }
  return data as Match
}

/** Generic update (partial). Returns the updated row. */
export async function updateMatch(
  matchId: string,
  patch: Partial<Match>
): Promise<Match> {
  const { data, error } = await supabase
    .from('matches')
    .update(patch)
    .eq('id', matchId)
    .select('*')
    .single()

  if (error) throw error
  return data as Match
}

/**
 * Update the opponent for a match by **name**:
 * - ensure a Player row exists in the same workspace (create if needed)
 * - set matches.player_b_id to that player's id
 *
 * Returns the updated match.
 */
export async function updateMatchOpponent(
  params: { matchId: string; wsId: string; opponentName: string }
): Promise<Match> {
  const { matchId, wsId, opponentName } = params
  if (!opponentName?.trim()) {
    throw new Error('opponentName is required')
  }

  const playerBId = await ensurePlayerId(wsId, opponentName.trim())

  const { data, error } = await supabase
    .from('matches')
    .update({ player_b_id: playerBId })
    .eq('id', matchId)
    .select('*')
    .single()

  if (error) throw error
  return data as Match
}

/** Delete a match by id */
export async function deleteMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from('matches').delete().eq('id', matchId)
  if (error) throw error
}
