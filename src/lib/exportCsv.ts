// src/lib/exportCsv.ts
import { supabase } from './supabase'
import type { Tournament, Match, Player, Point } from './types'

const safe = (s: string) => (s || '').replace(/[^a-z0-9-_]+/gi, '_')

function toCSV(rows: string[][]): Blob {
  const lines = rows.map(r => r.map(v => {
    const s = v ?? ''
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s
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

async function mapPlayers(ids: string[]): Promise<Record<string, Player>> {
  if (!supabase || ids.length === 0) return {}
  const { data, error } = await supabase.from('players').select('*').in('id', ids)
  if (error) throw error
  const m: Record<string, Player> = {}
  ;(data || []).forEach(p => { m[p.id] = p as Player })
  return m
}

function headerRow() {
  return [
    'tournament_name','tournament_date','tournament_grade',
    'match_id','player_a','player_b','surface','format','event','match_created_at',
    'seq','server','first_serve_in','second_serve_in','rally_len','finishing_shot','outcome','finish_type','tags','point_created_at'
  ]
}

/** EXPORT: whole workspace (all points across all matches in ws) */
export async function exportWorkspaceCsv(wsId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('points')
    .select(`
      id, match_id, seq, server, first_serve_in, second_serve_in, rally_len, finishing_shot, outcome, finish_type, tags, created_at, deleted_at,
      matches!inner(id, tournament_id, workspace_id, player_a_id, player_b_id, surface, format, event, created_at)
    `)
    .eq('matches.workspace_id', wsId)
    .is('deleted_at', null)
    .order('match_id', { ascending: true })
    .order('seq', { ascending: true })

  if (error) throw error
  const pts = (data || []) as (Point & { matches: Match })[]
  if (pts.length === 0) { downloadCsv(toCSV([headerRow()]), `workspace_${safe(wsId)}.csv`); return }

  const tIds = Array.from(new Set(pts.map(r => r.matches.tournament_id).filter(Boolean) as string[]))
  let tMap: Record<string, Pick<Tournament,'id'|'name'|'date'|'grade'>> = {}
  if (tIds.length) {
    const { data: ts, error: tErr } = await supabase
      .from('tournaments').select('id,name,date,grade').in('id', tIds)
    if (tErr) throw tErr
    tMap = Object.fromEntries((ts || []).map((t:any) => [t.id, t]))
  }

  const pIds = Array.from(new Set(pts.flatMap(r => [r.matches.player_a_id, r.matches.player_b_id])))
  const pMap = await mapPlayers(pIds)

  const rows: string[][] = [headerRow()]
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
  downloadCsv(toCSV(rows), `workspace_${safe(wsId)}.csv`)
}

/** EXPORT: one tournament (all points in matches with this tournament_id) */
export async function exportTournamentCsv(tournamentId: string) {
  if (!supabase) throw new Error('Supabase not configured')

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
      matches!inner(id, tournament_id, workspace_id, player_a_id, player_b_id, surface, format, event, created_at)
    `)
    .eq('matches.tournament_id', tournamentId)
    .is('deleted_at', null)
    .order('match_id', { ascending: true })
    .order('seq', { ascending: true })

  if (error) throw error
  const pts = (data || []) as (Point & { matches: Match })[]
  if (pts.length === 0) { downloadCsv(toCSV([headerRow()]), `tournament_${safe(t.name)}.csv`); return }

  const pIds = Array.from(new Set(pts.flatMap(r => [r.matches.player_a_id, r.matches.player_b_id])))
  const pMap = await mapPlayers(pIds)

  const rows: string[][] = [headerRow()]
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
  downloadCsv(toCSV(rows), `tournament_${safe(t.name)}.csv`)
}

/** EXPORT: one match by id (do not rely on local store; always fetch fresh) */
export async function exportMatchCsv(matchId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  // Pull match meta (for names + tournament title, if any)
  const { data: m, error: mErr } = await supabase
    .from('matches')
    .select('id,tournament_id,workspace_id,player_a_id,player_b_id,surface,format,event,created_at')
    .eq('id', matchId)
    .single()
  if (mErr) throw mErr

  // Points for this match
  const { data, error } = await supabase
    .from('points')
    .select('*')
    .eq('match_id', matchId)
    .is('deleted_at', null)
    .order('seq', { ascending: true })
  if (error) throw error
  const pts = (data || []) as Point[]

  // Tournament (optional)
  let t: Pick<Tournament,'id'|'name'|'date'|'grade'> | undefined
  if (m.tournament_id) {
    const { data: tt, error: tErr } = await supabase
      .from('tournaments')
      .select('id,name,date,grade')
      .eq('id', m.tournament_id)
      .single()
    if (tErr) throw tErr
    t = tt as any
  }

  // Players
  const pMap = await mapPlayers([m.player_a_id, m.player_b_id])

  const rows: string[][] = [headerRow()]
  for (const r of pts) {
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

  // If truly no points, still download headers (explicit)
  const blob = toCSV(rows)
  const title = t?.name ? `match_${safe(t.name)}_${matchId.slice(0,8)}` : `match_${matchId.slice(0,8)}`
  downloadCsv(blob, `${title}.csv`)
}
