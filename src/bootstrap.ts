// src/bootstrap.ts
import { supabase } from '@/lib/supabase'

export async function ensureBootstrap(): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')

  const cached = localStorage.getItem('match_id')
  if (cached) return cached

  const { data: sess } = await supabase.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) throw new Error('Not signed in')

  // 1) Find existing membership
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', uid)
    .limit(1)

  let wsId = existing?.[0]?.workspace_id as string | undefined

  // 2) If none, create workspace WITHOUT select(), using a client UUID
  if (!wsId) {
    wsId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString()

    // Insert workspace (no select)
    let { error: e1 } = await supabase
      .from('workspaces')
      .insert({ id: wsId, name: 'Family Team' })
    if (e1) throw e1

    // Add self as FIRST member (owner) — relies on the "self bootstrap first member" policy
    const { error: e2 } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: wsId, user_id: uid, role: 'owner' })
    if (e2) throw e2
  }

  // From here, you ARE a member → SELECT/INSERT policies for members apply

  // 3) Ensure two players
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

  // 4) Create a match and return its id
  const { data: match, error: e4 } = await supabase
    .from('matches')
    .insert({
      workspace_id: wsId!,
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
