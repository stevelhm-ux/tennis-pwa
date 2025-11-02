import { supabase } from './supabase'
import type { Tournament, Match, Player, Point } from './types'

function toCSV(rows: string[][]): Blob {
  const lines = rows.map(r => r.map(v => {
    const s = v ?? ''
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(','))
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

const safe = (s: string) => (s || '').replace(/[^a-z0-9-_]+/gi, '_')

async function mapPlayers(ids: string[]): Promise<Record<string, Player>> {
  if (!supabase || ids.length === 0) return {}
  const { data, error } = await supabase.from('players').select('*').in('id', ids)
  if (error) throw error
  const m: Record<string, Player> = {}
  ;(data || []).forEach(p => { m[p.id] = p as Player })
  return m
}

/**
 * WORKSPACE export: join points -> matches (inner), filter by matches.workspace_id
 * This captures matches with or without tournament_id.
 */
export async function exportWorkspaceCsv(wsId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  // Join points to matches, filter by workspace, exclude soft-deleted points
  const { data, error } = await supabase
    .from('points')
    .select(`
      id, match_id, seq, server, first_serve_in, second_serve_in, rally_len, finishing_shot, outcome, finish_type, tags, created_at, deleted_at,
      matches!inner(
        id, tournament_id, workspace_id, player_a_id, player_b_id, surface, format, event, created_at
      )
    `)
    .eq('matches.workspace_id', wsId)
    .is('deleted_at', null)
    .order('match_id', { ascending: true })
    .order('seq', { ascending: true })

  if (error) throw error
  const pts = (data || []) as (Point & { matches: Match })[]

  // Fetch tournaments for names (only those actually referenced)
  const tIds = Array.from(new Set(pts.map(r => r.matches.tournament_id).filter(Boolean) as string[]))
  let tMap: Record<string, Pick<Tournament,'id'|'name'|'date'|'grade'>> = {}
  if (tIds.length) {
    const { data: ts, error: tErr } = await supabase
      .from('tournaments')
      .select('id,name,date,grade')
      .in('id', tIds)
    if (tErr) throw tErr
    tMap = Object.fromEntries((ts || []).map((t: any) => [t.id, t]))
  }

  // Player names
  const pIds = Array.from(new Set(pts.flatMap(r => [r.matches.player_a_id, r.matches.player_b_id])))
  const pMap = await mapPlayers(pIds)

  const header = [
    'tournament_name','tournament_date','tournament_grade',
    'match_id','player_a','player_b','surface','format','event','match_created_at',
    'seq','server','first_serve_in','second_serve_in','rally_len','finishing_shot','outcome','finish_type','tags','point_created_at'
  ]
  const rows: string[][] = [header]

  for (const r of pts) {
    const m = r.matches
    const t = m.tournament_id ? tMap[m.tournament_id] : undefined
    rows.push([
      t?.name || '', t?.date || '', t?.grade?.toString() || '',
      m.id,
      pMap[m.player_a_id]?.name || 'Player A',
      pMap[m.player_b_id]?.name || 'Opponent',
      m.surface || '', m.format || '', m.event || '', m.created_at || '',
      String(r.seq),
      r.server,
      r.first_serve_in == null ? '' : String(r.first_serve_in),
      r.second_serve_in == null ? '' : String(r.second_serve_in),
      String(r.rally_len ?? ''),
      r.finishing_shot || '',
      r.outcome,
      r.finish_type || '',
      (r.tags || []).join('|'),
      r.created_at || ''
    ])
  }

  const blob = toCSV(rows)
  downloadCsv(blob, `workspace_${safe(wsId)}.csv`)
}

/**
 * TOURNAMENT export: join points -> matches (inner), filter by matches.tournament_id
 */
export async function exportTournamentCsv(tournamentId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  // Tournament meta (for filename)
  const { data: t, error: e1 } = await supabase
    .from('tournaments')
    .select('id,name,date,grade,workspace_id')
    .eq('id', tournamentId)
    .single()
  if (e1) throw e1

  // Join points to matches in this tournament
  const { data, error } = await supabase
    .from('points')
    .select(`
      id, match_id, seq, server, first_serve_in, second_serve_in, rally_len, finishing_shot, outcome, finish_type, tags, created_at, deleted_at,
      matches!inner(
        id, tournament_id, workspace_id, player_a_id, player_b_id, surface, format, event, created_at
      )
    `)
    .eq('matches.tournament_id', tournamentId)
    .is('deleted_at', null)
    .order('match_id', { ascending: true })
    .order('seq', { ascending: true })

  if (error) throw error
  const pts = (data || []) as (Point & { matches: Match })[]

  const pIds = Array.from(new Set(pts.flatMap(r => [r.matches.player_a_id, r.matches.player_b_id])))
  const pMap = await mapPlayers(pIds)

  const header = [
    'tournament_name','tournament_date','tournament_grade',
    'match_id','player_a','player_b','surface','format','event','match_created_at',
    'seq','server','first_serve_in','second_serve_in','rally_len','finishing_shot','outcome','finish_type','tags','point_created_at'
  ]
  const rows: string[][] = [header]

  for (const r of pts) {
    const m = r.matches
    rows.push([
      t.name || '', t.date || '', t.grade?.toString() || '',
      m.id,
      pMap[m.player_a_id]?.name || 'Player A',
      pMap[m.player_b_id]?.name || 'Opponent',
      m.surface || '', m.format || '', m.event || '', m.created_at || '',
      String(r.seq),
      r.server,
      r.first_serve_in == null ? '' : String(r.first_serve_in),
      r.second_serve_in == null ? '' : String(r.second_serve_in),
      String(r.rally_len ?? ''),
      r.finishing_shot || '',
      r.outcome,
      r.finish_type || '',
      (r.tags || []).join('|'),
      r.created_at || ''
    ])
  }

  const blob = toCSV(rows)
  downloadCsv(blob, `tournament_${safe(t.name)}.csv`)
}
