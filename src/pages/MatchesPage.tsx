import React, { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { listMatches, createMatch, updateMatch, updateMatchOpponent } from '@/lib/matches'
import { getPlayersByIds, ensureMyPlayer, getOrCreateOpponent } from '@/lib/players'
import type { Match, Tournament } from '@/lib/types'

export default function MatchesPage({
  wsId,
  tournament,
  onBack,
  onOpenMatch
}:{ wsId:string; tournament: Tournament; onBack:()=>void; onOpenMatch:(matchId:string)=>void }){
  const [matches, setMatches] = useState<Match[]>([])
  const [nameMap, setNameMap] = useState<Record<string,string>>({})
  const [opp, setOpp] = useState('')

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editOpp, setEditOpp] = useState('')
  const [editEvent, setEditEvent] = useState('Tournament')
  const [editSurface, setEditSurface] = useState<'Hard'|'Clay'|'Grass'|'Carpet'|'BOGUS'>('Hard' as any)
  const [editFormat, setEditFormat] = useState<'BO3'|'BO5'>('BO3')

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

  async function addMatch(e: React.FormEvent) {
    e.preventDefault()
    const myName = (localStorage.getItem('my_player_name') || '').trim()
    if (!myName) { alert('Please set your player name on the Tournaments page first.'); return }
    if (!opp.trim()) { alert('Enter opponent name'); return }
    const me = await ensureMyPlayer(wsId, myName)
    const opponent = await getOrCreateOpponent(wsId, opp.trim())
    const m = await createMatch({ wsId, tournamentId: tournament.id, playerAId: me.id, playerBId: opponent.id })
    setOpp('')
    await refresh()
    onOpenMatch(m.id)
  }

  async function saveEdit(match: Match, e: React.FormEvent) {
    e.preventDefault()
    // update opponent if changed
    if (editOpp && editOpp.trim()) {
      await updateMatchOpponent(wsId, match.id, editOpp.trim())
    }
    // update other fields
    await updateMatch(match.id, { event: editEvent, surface: editSurface as any, format: editFormat })
    setEditingId(null)
    await refresh()
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <Header title={tournament.name} onBack={onBack} />

      <div className="mb-4 bg-white border rounded-2xl p-3">
        <div className="font-medium mb-2">New Match</div>
        <form onSubmit={addMatch} className="flex gap-2">
          <input className="border rounded px-3 py-2 flex-1" placeholder="Opponent name" value={opp} onChange={e=>setOpp(e.target.value)} />
          <button className="px-3 py-2 rounded bg-slate-900 text-white">Create</button>
        </form>
      </div>

      <div className="space-y-2">
        {matches.map(m => {
          const isEditing = editingId === m.id
          return (
            <div key={m.id} className="bg-white border rounded-xl p-3">
              {!isEditing ? (
                <div className="flex items-start justify-between gap-3">
                  <button className="text-left flex-1 hover:opacity-80 active:scale-[0.99]" onClick={()=>onOpenMatch(m.id)}>
                    <div className="font-medium">
                      {nameMap[m.player_a_id] || 'Player A'} vs {nameMap[m.player_b_id] || 'Opponent'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {m.surface || 'Hard'} • {m.format || 'BO3'} • {m.event || 'Tournament'}
                    </div>
                  </button>
                  {/* 4) Edit button */}
                  <button
                    className="px-3 py-1 text-sm rounded-lg border bg-slate-50 hover:bg-slate-100"
                    onClick={() => {
                      setEditingId(m.id)
                      setEditOpp(nameMap[m.player_b_id] || '')
                      setEditEvent(m.event || 'Tournament')
                      setEditSurface((m.surface as any) || 'Hard')
                      setEditFormat((m.format as any) || 'BO3')
                    }}
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <form onSubmit={(e)=>saveEdit(m, e)} className="grid gap-2">
                  <input className="border rounded px-3 py-2" placeholder="Opponent name" value={editOpp} onChange={e=>setEditOpp(e.target.value)} />
                  <div className="grid grid-cols-3 gap-2">
                    <select className="border rounded px-2 py-2" value={editSurface} onChange={e=>setEditSurface(e.target.value as any)}>
                      {['Hard','Clay','Grass','Carpet'].map(s => <option value={s} key={s}>{s}</option>)}
                    </select>
                    <select className="border rounded px-2 py-2" value={editFormat} onChange={e=>setEditFormat(e.target.value as any)}>
                      {['BO3','BO5'].map(f => <option value={f} key={f}>{f}</option>)}
                    </select>
                    <input className="border rounded px-2 py-2" placeholder="Event" value={editEvent} onChange={e=>setEditEvent(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-2 rounded bg-slate-900 text-white">Save</button>
                    <button type="button" className="px-3 py-2 rounded border" onClick={()=>setEditingId(null)}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          )
        })}
        {matches.length===0 && <div className="text-sm text-slate-500">No matches yet.</div>}
      </div>
    </div>
  )
}
