import React, { useEffect, useState } from 'react'
import TournamentPicker from '@/components/TournamentPicker'
import { Header } from '@/components/Header'
import { ensureWorkspace } from '@/bootstrap'
import type { Tournament } from '@/lib/types'

export default function TournamentsPage({ onEnterTournament }:{ onEnterTournament:(t: Tournament, wsId: string)=>void }){
  const [wsId, setWsId] = useState<string | null>(null)
  const [myName, setMyName] = useState<string>(localStorage.getItem('my_player_name') || '')

  useEffect(()=>{ (async()=>{ setWsId(await ensureWorkspace()) })().catch(console.error) },[])

  function saveMyName() {
    localStorage.setItem('my_player_name', myName.trim())
    alert('Saved your player name.')
  }

  return (
    <div className="max-w-md mx-auto p-4">
      {/* 1) Title changed to Tennis Tracker */}
      <Header title="Tennis Tracker" />
      {/* 2) Card width aligned with Tournament list by using the same card styles */}
      <div className="mb-4 bg-white border rounded-2xl p-3">
        <div className="font-medium mb-1">My Player</div>
        <div className="text-xs text-slate-500 mb-2">This will be Player A for matches you create.</div>
        <div className="flex gap-2">
          <input className="border rounded px-3 py-2 flex-1" placeholder="Your player's name" value={myName} onChange={e=>setMyName(e.target.value)} />
          <button onClick={saveMyName} className="px-3 py-2 rounded bg-slate-900 text-white">Save</button>
        </div>
      </div>

      {wsId ? (
        /* TournamentPicker already renders as matching cards for list + create */
        <TournamentPicker
          workspaceId={wsId}
          onSelected={(t)=> onEnterTournament(t, wsId)}
        />
      ) : <div>Preparing workspace…</div>}
    </div>
  )
}
