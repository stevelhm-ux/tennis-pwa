import React, { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/Header'
import { listMatches, createMatch, updateMatchOpponent } from '@/lib/matches'
import { getPlayersByIds, ensureMyPlayer, getOrCreateOpponent } from '@/lib/players'
import type { Match, Tournament } from '@/lib/types'
import { getMyPlayer } from '@/lib/prefs'
import { exportTournamentCsv } from '@/lib/exportCsv'
import { supabase } from '@/lib/supabase'

type TStats = {
  matches: number
  points: number
  firstInPct: number
  dfUs: number
  winPct: number
}

export default function MatchesPage({
  wsId, tournament, onBack, onOpenMatch
}:{ wsId:string; tournament: Tournament; onBack:()=>void; onOpenMatch:(matchId:string)=>void }){
  const [matches, setMatches] = useState<Match[]>([])
  const [nameMap, setNameMap] = useState<Record<string,string>>({})
  const [opp, setOpp] = useState('')
  const [myPlayerCached, setMyPlayerCached] = useState<string>('')
  const [tStats, setTStats] = useState<TStats | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editOpponent, setEditOpponent] = useState<string>('')

  async function refresh() {
    const ms = await listMatches(tournament.id)
    setMatches(ms)
    const ids = Array.from(new Set(ms.flatMap(m => [m.player_a_id, m.player_b_id])))
    const players = await getPlayersByIds(ids)
    const map: Record<string,string> = {}
    for (const id in players) map[id] = players[id].name
    setNameMap(map)
  }

  useEffect(()=>{ refresh().catch(console.error) }, [tournament.id])

  useEffect(() => {
    (async () => {
      const pref = await getMyPlayer(wsId)
      if (pref) setMyPlayerCached(pref.name)
      else {
        const legacy = (localStorage.getItem('my_player_name') || '').trim()
        if (legacy) setMyPlayerCached(legacy)
      }
    })().catch(console.error)
  }, [wsId])

  // Tournament-level summary (matches + points + serve stats)
  useEffect(() => {
    (async () => {
      // points joined to matches in this tournament
      const { data, error } = await supabase!.from('points')
        .select(`
          id, match_id, seq, server, outcome, first_serve_in, second_serve_in, finish_type,
          matches!inner(id, tournament_id)
        `)
        .eq('matches.tournament_id', tournament.id)
        .order('match_id')
      if (error) { console.error(error); setTStats({matches: matches.length, points: 0, firstInPct: 0, dfUs: 0, winPct: 0}); return }

      const pts = data || []
      const servePts = pts.filter((r:any) => r.server === 'A')
      const firstIn = servePts.filter((r:any) => r.first_serve_in === true).length
      const firstAttempts = servePts.length
      const dfUs = servePts.filter((r:any) => r.finish_type === 'DF').length
      const won = pts.filter((r:any)=> r.outcome === 'A').length
      const winPct = pts.length ? won/pts.length : 0

      setTStats({
        matches: matches.length,
        points: pts.length,
        firstInPct: firstAttempts ? firstIn/firstAttempts : 0,
        dfUs,
        winPct
      })
    })().catch(console.error)
  }, [tournament.id, matches.length])

  async function addMatch(e: React.FormEvent) {
    e.preventDefault()
    const myName = myPlayerCached
    if (!myName) { alert('Please set your player name on the Tournaments page first.'); return }
    if (!opp.trim()) { alert('Enter opponent name'); return }
    const me = await ensureMyPlayer(wsId, myName)
    const opponent = await getOrCreateOpponent(wsId, opp.trim())
    const m = await createMatch({ wsId, tournamentId: tournament.id, playerAId: me.id, playerBId: opponent.id })
    setOpp('')
    await refresh()
    onOpenMatch(m.id)
  }

  async function openEdit(m: Match){
    setEditingId(m.id)
    setEditOpponent(nameMap[m.player_b_id] || '')
  }
  async function saveEdit(){
    if (!editingId) return
    const name = editOpponent.trim()
    if (!name) { alert('Opponent name required'); return }
    await updateMatchOpponent(editingId, name) // small helper you likely have; otherwise insert + update
    setEditingId(null)
    refresh()
  }

  // quick per-match stats
  const [perMatchStats, setPerMatchStats] = useState<Record<string, {points:number, winPct:number, firstInPct:number, dfUs:number}>>({})
  useEffect(() => {
    (async () => {
      if (!matches.length) { setPerMatchStats({}); return }
      const ids = matches.map(m => m.id)
      const { data, error } = await supabase!.from('points')
        .select('match_id, server, outcome, first_serve_in, second_serve_in, finish_type')
        .in('match_id', ids)
      if (error) { console.error(error); return }
      const map: Record<string, any[]> = {}
      ;(data||[]).forEach((r:any) => { (map[r.match_id] ||= []).push(r) })
      const agg: Record<string, any> = {}
      for (const id of ids) {
        const arr = map[id] || []
        const servePts = arr.filter(r=>r.server==='A')
        const firstIn = servePts.filter(r=>r.first_serve_in===true).length
        const firstAttempts = servePts.length
        const dfUs = servePts.filter(r=>r.finish_type==='DF').length
        const won = arr.filter(r=>r.outcome==='A').length
        agg[id] = {
          points: arr.length,
          winPct: arr.length ? won/arr.length : 0,
          firstInPct: firstAttempts ? firstIn/firstAttempts : 0,
          dfUs
        }
      }
      setPerMatchStats(agg)
    })().catch(console.error)
  }, [matches])

  return (
    <div className="max-w-md mx-auto p-4">
      <Header title={tournament.name} onBack={onBack} />

      {/* Top actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-slate-500">Tournament: {tournament.name} {tournament.age_group ? `• ${tournament.age_group}`:''}</div>
        <button className="px-3 py-1 rounded-lg border bg-white text-sm hover:bg-slate-50" onClick={()=>exportTournamentCsv(tournament.id)}>
          Export CSV
        </button>
      </div>

      {/* Tournament details summary */}
      <div className="mb-4 bg-white border rounded-2xl p-3">
        <div className="font-medium mb-2">Tournament Details</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Matches played</div><div className="text-right">{tStats?.matches ?? 0}</div>
          <div>Total points</div><div className="text-right">{tStats?.points ?? 0}</div>
          <div>Points won</div><div className="text-right">{Math.round((tStats?.winPct ?? 0)*100)}%</div>
          <div>1st-serve in</div><div className="text-right">{Math.round((tStats?.firstInPct ?? 0)*100)}%</div>
          <div>Double faults</div><div className="text-right">{tStats?.dfUs ?? 0}</div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {tournament.venue || 'Venue TBC'} • {tournament.date ? new Date(tournament.date).toLocaleDateString() : 'Date TBC'} • {typeof tournament.grade==='number' ? `G${tournament.grade}` : 'Grade TBC'} {tournament.age_group ? `• ${tournament.age_group}` : ''}
        </div>
      </div>

      {/* New Match */}
      <div className="mb-4 bg-white border rounded-2xl p-3">
        <div className="font-medium mb-2">New Match</div>
        <form onSubmit={addMatch} className="flex gap-2">
          <input className="border rounded px-3 py-2 flex-1" placeholder="Opponent name" value={opp} onChange={e=>setOpp(e.target.value)} />
          <button className="px-3 py-2 rounded bg-slate-900 text-white">Create</button>
        </form>
        {myPlayerCached ? (
          <div className="mt-1 text-xs text-slate-500">My Player: {myPlayerCached}</div>
        ) : (
          <div className="mt-1 text-xs text-rose-500">My Player not set yet</div>
        )}
      </div>

      {/* Matches list (with edit + quick stats) */}
      <div className="space-y-2">
        {matches.map(m => {
          const stats = perMatchStats[m.id] || {points:0, winPct:0, firstInPct:0, dfUs:0}
          return (
            <div key={m.id} className="bg-white border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <button className="text-left font-medium hover:opacity-80" onClick={()=>onOpenMatch(m.id)}>
                  {nameMap[m.player_a_id] || 'Player A'} vs {nameMap[m.player_b_id] || 'Opponent'}
                </button>
                <button className="text-xs px-2 py-1 rounded border" onClick={()=>openEdit(m)}>Edit</button>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-2 text-xs text-slate-600">
                <div>Pts: <span className="font-medium">{stats.points}</span></div>
                <div>Won: <span className="font-medium">{Math.round(stats.winPct*100)}%</span></div>
                <div>1st In: <span className="font-medium">{Math.round(stats.firstInPct*100)}%</span></div>
                <div>DF: <span className="font-medium">{stats.dfUs}</span></div>
              </div>

              {/* Inline edit row */}
              {editingId === m.id && (
                <div className="mt-3 flex gap-2">
                  <input className="border rounded px-2 py-1 flex-1" placeholder="Opponent name" value={editOpponent} onChange={e=>setEditOpponent(e.target.value)} />
                  <button className="px-3 py-1 rounded bg-slate-900 text-white text-xs" onClick={saveEdit}>Save</button>
                  <button className="px-3 py-1 rounded border text-xs" onClick={()=>setEditingId(null)}>Cancel</button>
                </div>
              )}
            </div>
          )
        })}
        {matches.length===0 && <div className="text-sm text-slate-500">No matches yet.</div>}
      </div>
    </div>
  )
}
