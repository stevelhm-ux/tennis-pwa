import { supabase } from './supabase'
import type { Tournament, Match, Player, Point } from './types'

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

function safe(str: string) { return (str || '').replace(/[^a-z0-9-_]+/gi, '_') }

async function mapPlayers(ids: string[]): Promise<Record<string, Player>> {
  if (!supabase || ids.length === 0) return {}
  const { data, error } = await supabase.from('players').select('*').in('id', ids)
  if (error) throw error
  const m: Record<string, Player> = {}
  ;(data || []).forEach(p => m[p.id] = p as Player)
  return m
}

export async function exportWorkspaceCsv(wsId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  // 1) tournaments in workspace
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select('id,name,date,grade')
    .eq('workspace_id', wsId)
  if (tErr) throw tErr
  const tList = (tournaments || []) as Pick<Tournament,'id'|'name'|'date'|'grade'>[]
  const tIds = tList.map(t => t.id)
  if (tIds.length === 0) {
    downloadCsv(toCSV([['No data']]), 'export_empty.csv')
    return
  }

  // 2) matches in those tournaments
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id,tournament_id,player_a_id,player_b_id,surface,format,event,created_at')
    .in('tournament_id', tIds)
  if (mErr) throw mErr
  const ms = (matches || []) as Match[]
  const matchIds = ms.map(m => m.id)
  const playerIds = Array.from(new Set(ms.flatMap(m => [m.player_a_id, m.player_b_id])))

  // 3) points for those matches
  const { data: points, error: pErr } = await supabase
    .from('points')
    .select('*')
    .in('match_id', matchIds)
    .is('deleted_at', null)
    .order('match_id', { ascending: true })
    .order('seq', { ascending: true })
  if (pErr) throw pErr
  const pts = (points || []) as Point[]

  // 4) player map
  const pMap = await mapPlayers(playerIds)

  // 5) rows
  const tMap = Object.fromEntries(tList.map(t => [t.id, t]))
  const header = [
    'tournament_name','tournament_date','tournament_grade',
    'match_id','player_a','player_b','surface','format','event','match_created_at',
    'seq','server','first_serve_in','second_serve_in','rally_len','finishing_shot','outcome','finish_type','tags','point_created_at'
  ]
  const rows: string[][] = [header]
  for (const p of pts) {
    const m = ms.find(x => x.id === p.match_id)!
    const t = tMap[m.tournament_id!]
    rows.push([
      t?.name || '', t?.date || '', t?.grade?.toString() || '',
      m.id,
      pMap[m.player_a_id]?.name || 'Player A',
      pMap[m.player_b_id]?.name || 'Opponent',
      m.surface || '', m.format || '', m.event || '', m.created_at || '',
      String(p.seq),
      p.server,
      p.first_serve_in==null?'':String(p.first_serve_in),
      p.second_serve_in==null?'':String(p.second_serve_in),
      String(p.rally_len ?? ''),
      p.finishing_shot || '',
      p.outcome,
      p.finish_type || '',
      (p.tags||[]).join('|'),
      p.created_at || ''
    ])
  }

  const blob = toCSV(rows)
  downloadCsv(blob, `workspace_${safe(wsId)}.csv`)
}

export async function exportTournamentCsv(tournamentId: string) {
  if (!supabase) throw new Error('Supabase not configured')

  // tournament
  const { data: t, error: e1 } = await supabase
    .from('tournaments')
    .select('id,name,date,grade,workspace_id')
    .eq('id', tournamentId).single()
  if (e1) throw e1

  // matches
  const { data: matches, error: e2 } = await supabase
    .from('matches')
    .select('id,tournament_id,player_a_id,player_b_id,surface,format,event,created_at')
    .eq('tournament_id', tournamentId)
  if (e2) throw e2
  const ms = (matches || []) as Match[]
  const matchIds = ms.map(m => m.id)
  if (matchIds.length === 0) {
    downloadCsv(toCSV([['No data']]), `tournament_${safe(t.name)}.csv`)
    return
  }

  // points
  const { data: points, error: e3 } = await supabase
    .from('points')
    .select('*')
    .in('match_id', matchIds)
    .is('deleted_at', null)
    .order('match_id', { ascending: true })
    .order('seq', { ascending: true })
  if (e3) throw e3
  const pts = (points || []) as Point[]

  const playerIds = Array.from(new Set(ms.flatMap(m => [m.player_a_id, m.player_b_id])))
  const pMap = await mapPlayers(playerIds)

  const header = [
    'tournament_name','tournament_date','tournament_grade',
    'match_id','player_a','player_b','surface','format','event','match_created_at',
    'seq','server','first_serve_in','second_serve_in','rally_len','finishing_shot','outcome','finish_type','tags','point_created_at'
  ]
  const rows: string[][] = [header]
  for (const p of pts) {
    const m = ms.find(x => x.id === p.match_id)!
    rows.push([
      t.name || '', t.date || '', t.grade?.toString() || '',
      m.id,
      pMap[m.player_a_id]?.name || 'Player A',
      pMap[m.player_b_id]?.name || 'Opponent',
      m.surface || '', m.format || '', m.event || '', m.created_at || '',
      String(p.seq),
      p.server,
      p.first_serve_in==null?'':String(p.first_serve_in),
      p.second_serve_in==null?'':String(p.second_serve_in),
      String(p.rally_len ?? ''),
      p.finishing_shot || '',
      p.outcome,
      p.finish_type || '',
      (p.tags||[]).join('|'),
      p.created_at || ''
    ])
  }
  const blob = toCSV(rows)
  downloadCsv(blob, `tournament_${safe(t.name)}.csv`)
}
