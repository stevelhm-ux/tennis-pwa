// src/bootstrap.ts
import { supabase } from '@/lib/supabase'

export async function ensureBootstrap(): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')

  // Reuse cached match id if we already bootstrapped
  const cached = localStorage.getItem('match_id')
  if (cached) return cached

  // 0) Need a signed-in user
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) throw new Error('Not signed in')

  // 1) Find or create a workspace
  let wsId: string | null = null
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', uid)
    .limit(1)
  wsId = existing?.[0]?.workspace_id ?? null

  if (!wsId) {
    // Create workspace
    const { data: ws, error: e1 } = await supabase
      .from('workspaces')
      .insert({ name: 'Family Team' })
      .select()
      .single()
    if (e1) throw e1
    wsId = ws.id

    // Add self as owner
    const { error: e2 } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: wsId, user_id: uid, role: 'owner' })
    if (e2) throw e2
  }

  // 2) Ensure two players
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: true })

  let aId = players?.[0]?.id
  let bId = players?.[1]?.id
  if (!aId || !bId) {
    const toCreate = []
    if (!aId) toCreate.push({ workspace_id: wsId, name: 'Player A', handedness: 'R' })
    if (!bId) toCreate.push({ workspace_id: wsId, name: 'Opponent', handedness: 'R' })
    const { data: created, error: e3 } = await supabase.from('players').insert(toCreate).select()
    if (e3) throw e3
    const all = [...(players ?? []), ...(created ?? [])]
    aId = aId || all[0]?.id
    bId = bId || all[1]?.id
  }

  // 3) Create a match
  const { data: match, error: e4 } = await supabase
    .from('matches')
    .insert({
      workspace_id: wsId,
      player_a_id: aId!,
      player_b_id: bId!,
      event: 'Practice',
      surface: 'Hard',
      format: 'BO3'
    })
    .select()
    .single()
  if (e4) throw e4

  localStorage.setItem('match_id', match.id)
  return match.id
}
