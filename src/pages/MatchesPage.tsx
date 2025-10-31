
import React, { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { listMatches, createMatch } from '@/lib/matches'
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
        {matches.map(m => (
          <button key={m.id} className="w-full text-left bg-white border rounded-xl p-3 hover:bg-slate-50 active:scale-[0.99]" onClick={()=>onOpenMatch(m.id)}>
            <div className="font-medium">
              {nameMap[m.player_a_id] || 'Player A'} vs {nameMap[m.player_b_id] || 'Opponent'}
            </div>
            <div className="text-xs text-slate-500">Match ID: {m.id.slice(0,8)}…</div>
          </button>
        ))}
        {matches.length===0 && <div className="text-sm text-slate-500">No matches yet.</div>}
      </div>
    </div>
  )
}
