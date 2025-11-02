// src/lib/exportCsv.ts
import { supabase } from './supabase'
import type { Tournament, Match, Player, Point } from './types'

const safe = (s: string) => (s || '').replace(/[^a-z0-9-_]+/gi, '_')

function toCSV(rows: string[][]): Blob {
  const lines = rows.map(r =>
    r.map(v => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')
  )
  return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
}

function downloadCsv(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function mapPlayers(ids: string[]): Promise<Record<string, Player>> {
  if (!supabase || ids.length === 0) return {}
  const { data, error } = await supabase.from('players').select('*').in('id', ids)
  if (error) throw error
  const m: Record<string, Player> = {}
  ;(data || []).forEach(p => { m[p.id] = p as Player })
  return m
}

const header = [
  'tournament_name','tournament_date','tournament_grade',
  'match_id','player_a','player_b','surface','format','event','match_created_at',
  'seq','server','first_serve_in','second_serve_in','rally_len','finishing_shot','outcome','finish_type','tags','point_created_at'
]

/** EXPORT: whole workspace (all points across matches in this workspace) */
export async function exportWorkspaceCsv(wsId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('points')
    .select(`
      id, match_id, seq, server, first_serve_in, second_serve_in, rally_len, finishing_shot, outcome, finish_type, tags, created_at, deleted_at,
      matches!inner(
        id, tournament_id, workspace_id, player_a_id, player_b_id, surface, format, event, created_at,
        tournaments(
          id, name, date, grade
        )
      )
    `)
    .eq('matches.workspace_id', wsId)
    .is('deleted_at', null)
    .order('match_id', { ascending: true })
    .order('seq', { ascending: true })

  if (error) throw error

  const rows: string[][] = [header]

  const pIds = Array.from(new Set(
    (data || []).flatMap((r: any) => [r.matches?.player_a_id, r.matches?.player_b_id]).filter(Boolean)
  )) as string[]
  const pMap = await mapPlayers(pIds)

  for (const r of (data || []) as any[]) {
    const m: Match | undefined = r.matches
    const t: (Pick<Tournament,'id'|'name'|'date'|'grade'> | null) = m?.tournaments ?? null
    rows.push([
      t?.name || '', t?.date || '', t?.grade?.toString() || '',
      m?.id || '',
      (m && pMap[m.player_a_id]?.name) || 'Player A',
      (m && pMap[m.player_b_id]?.name) || 'Opponent',
      m?.surface || '', m?.format || '', m?.event || '', m?.created_at || '',
      String(r.seq),
      r.server,
      r.first_serve_in == null ? '' : String(r.first_serve_in),
      r.second_serve_in == null ? '' : String(r.second_serve_in),
      String(r.rally_len ?? ''),
      r.finishing_shot || '',
      r.outcome,
      r.finish_type || '',
      Array.isArray(r.tags) ? r.tags.join('|') : '',
      r.created_at || ''
    ])
  }

  downloadCsv(toCSV(rows), `workspace_${safe(wsId)}.csv`)
}

/** EXPORT: one tournament (all points in matches with this tournament_id) */
export async function exportTournamentCsv(tournamentId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  // get tournament for filename & meta
  const { data: t, error: e1 } = await supabase
    .from('tournaments')
    .select('id,name,date,grade,workspace_id')
    .eq('id', tournamentId)
    .single()
  if (e1) throw e1

  const { data, error } = await supabase
    .from('points')
    .select(`
      id, match_id, seq, server, first_serve_in, second_serve_in, rally_len, finishing_shot, outcome, finish_type, tags, created_at, deleted_at,
      matches!inner(
        id, tournament_id, workspace_id, player_a_id, player_b_id, surface, format, event, created_at,
        tournaments(
          id, name, date, grade
        )
      )
    `)
    .eq('matches.tournament_id', tournamentId)
    .is('deleted_at', null)
    .order('match_id', { ascending: true })
    .order('seq', { ascending: true })

  if (error) throw error

  const rows: string[][] = [header]
  const pIds = Array.from(new Set(
    (data || []).flatMap((r: any) => [r.matches?.player_a_id, r.matches?.player_b_id]).filter(Boolean)
  )) as string[]
  const pMap = await mapPlayers(pIds)

  for (const r of (data || []) as any[]) {
    const m: Match | undefined = r.matches
    const tt: any = m?.tournaments ?? t // nested tournaments or the one we fetched
    rows.push([
      tt?.name || '', tt?.date || '', tt?.grade?.toString() || '',
      m?.id || '',
      (m && pMap[m.player_a_id]?.name) || 'Player A',
      (m && pMap[m.player_b_id]?.name) || 'Opponent',
      m?.surface || '', m?.format || '', m?.event || '', m?.created_at || '',
      String(r.seq),
      r.server,
      r.first_serve_in == null ? '' : String(r.first_serve_in),
      r.second_serve_in == null ? '' : String(r.second_serve_in),
      String(r.rally_len ?? ''),
      r.finishing_shot || '',
      r.outcome,
      r.finish_type || '',
      Array.isArray(r.tags) ? r.tags.join('|') : '',
      r.created_at || ''
    ])
  }

  downloadCsv(toCSV(rows), `tournament_${safe(t.name)}.csv`)
}

/** EXPORT: one match by id (always fetch fresh) */
export async function exportMatchCsv(matchId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('points')
    .select(`
      id, match_id, seq, server, first_serve_in, second_serve_in, rally_len, finishing_shot, outcome, finish_type, tags, created_at, deleted_at,
      matches!inner(
        id, tournament_id, workspace_id, player_a_id, player_b_id, surface, format, event, created_at,
        tournaments(
          id, name, date, grade
        )
      )
    `)
    .eq('match_id', matchId)
    .is('deleted_at', null)
    .order('seq', { ascending: true })

  if (error) throw error

  const rows: string[][] = [header]

  const pIds = Array.from(new Set(
    (data || []).flatMap((r: any) => [r.matches?.player_a_id, r.matches?.player_b_id]).filter(Boolean)
  )) as string[]
  const pMap = await mapPlayers(pIds)

  // for filename
  const first = (data || [])[0] as any
  const m: Match | undefined = first?.matches
  const t: any = m?.tournaments ?? null

  for (const r of (data || []) as any[]) {
    const mm: Match | undefined = r.matches
    const tt: any = mm?.tournaments ?? t
    rows.push([
      tt?.name || '', tt?.date || '', tt?.grade?.toString() || '',
      mm?.id || '',
      (mm && pMap[mm.player_a_id]?.name) || 'Player A',
      (mm && pMap[mm.player_b_id]?.name) || 'Opponent',
      mm?.surface || '', mm?.format || '', mm?.event || '', mm?.created_at || '',
      String(r.seq),
      r.server,
      r.first_serve_in == null ? '' : String(r.first_serve_in),
      r.second_serve_in == null ? '' : String(r.second_serve_in),
      String(r.rally_len ?? ''),
      r.finishing_shot || '',
      r.outcome,
      r.finish_type || '',
      Array.isArray(r.tags) ? r.tags.join('|') : '',
      r.created_at || ''
    ])
  }

  const base = t?.name ? `match_${safe(t.name)}_${(m?.id || matchId).slice(0,8)}` : `match_${(m?.id || matchId).slice(0,8)}`
  downloadCsv(toCSV(rows), `${base}.csv`)
}
