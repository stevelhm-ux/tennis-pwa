// src/bootstrap.ts
import { supabase } from '@/lib/supabase'

/** Ensure you have a workspace and are an owner member. */
export async function ensureWorkspace(): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) throw new Error('Not signed in')

  // Find an existing membership
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', uid)
    .limit(1)

  let wsId = existing?.[0]?.workspace_id as string | undefined
  if (!wsId) {
    // Create workspace (no select) then add yourself as owner
    wsId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString()
    let { error: e1 } = await supabase.from('workspaces').insert({ id: wsId, name: 'Family Team' })
    if (e1) throw e1
    const { error: e2 } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: wsId, user_id: uid, role: 'owner' })
    if (e2) throw e2
  }
  return wsId!
}

/** Back-compat: builds on ensureWorkspace and ensures 2 players, returns ids. */
export async function ensureWorkspaceAndPlayers(): Promise<{ wsId: string, aId: string, bId: string }> {
  const wsId = await ensureWorkspace()

  // Ensure two players exist
  const { data: players } = await supabase!
    .from('players')
    .select('id')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: true })

  let aId = players?.[0]?.id
  let bId = players?.[1]?.id
  if (!aId || !bId) {
    const toCreate: any[] = []
    if (!aId) toCreate.push({ workspace_id: wsId, name: 'Player A', handedness: 'R' })
    if (!bId) toCreate.push({ workspace_id: wsId, name: 'Opponent', handedness: 'R' })
    const { data: created, error } = await supabase!
      .from('players')
      .insert(toCreate)
      .select()
    if (error) throw error
    const all = [...(players ?? []), ...(created ?? [])]
    aId = aId || all[0]?.id
    bId = bId || all[1]?.id
  }
  return { wsId, aId: aId!, bId: bId! }
}

/** Back-compat: create a match under a tournament. */
export async function createMatchWithTournament(args: {
  wsId: string, aId: string, bId: string, tournamentId: string
}) {
  const { wsId, aId, bId, tournamentId } = args
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('matches')
    .insert({
      workspace_id: wsId,
      player_a_id: aId,
      player_b_id: bId,
      tournament_id: tournamentId,
      event: 'Tournament',
      surface: 'Hard',
      format: 'BO3'
    })
    .select()
    .single()
  if (error) throw error
  return data.id as string
}
