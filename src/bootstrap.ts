import { supabase } from '@/lib/supabase'

export async function ensureBootstrap(): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')

  const cached = localStorage.getItem('match_id')
  if (cached) return cached

  const { data: sess } = await supabase.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) throw new Error('Not signed in')

  // Find one workspace you belong to (created earlier in your flow)
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', uid)
    .limit(1)

  let wsId = existing?.[0]?.workspace_id as string | undefined
  if (!wsId) {
    // First-time bootstrap: create workspace without select, then add self as owner
    wsId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString()
    let { error: e1 } = await supabase.from('workspaces').insert({ id: wsId, name: 'Family Team' })
    if (e1) throw e1
    const { error: e2 } = await supabase.from('workspace_members').insert({ workspace_id: wsId, user_id: uid, role: 'owner' })
    if (e2) throw e2
  }

  // Ensure two players
  const { data: players } = await supabase
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
    const { data: created, error: pe } = await supabase.from('players').insert(toCreate).select()
    if (pe) throw pe
    const all = [...(players ?? []), ...(created ?? [])]
    aId = aId || all[0]?.id
    bId = bId || all[1]?.id
  }

  // Ensure a tournament in this workspace (reuse the most recent, else create one)
  const { data: ts } = await supabase
    .from('tournaments')
    .select('id')
    .eq('workspace_id', wsId)
    .order('date', { ascending: false })
    .limit(1)

  let tId = ts?.[0]?.id as string | undefined
  if (!tId) {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const { data: t, error: te } = await supabase
      .from('tournaments')
      .insert({
        workspace_id: wsId,
        name: 'Practice',
        date: today,
        grade: 4,
        created_by: uid
      })
      .select()
      .single()
    if (te) throw te
    tId = t.id
  }

  // Create a match linked to the tournament
  const { data: match, error: me } = await supabase
    .from('matches')
    .insert({
      workspace_id: wsId,
      player_a_id: aId!,
      player_b_id: bId!,
      tournament_id: tId!,
      event: 'Practice',
      surface: 'Hard',
      format: 'BO3'
    })
    .select()
    .single()
  if (me) throw me

  localStorage.setItem('match_id', match.id)
  return match.id
}
