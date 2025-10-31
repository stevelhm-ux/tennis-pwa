import React, { useEffect, useMemo, useState } from 'react'
import { useMatchStore } from '@/store/useMatchStore'
import { computeLiveScore } from '@/lib/matchEngine'
import { ScoreBar } from '@/components/ScoreBar'
import { PointPad } from '@/components/PointPad'
import { StatsPanel } from '@/components/StatsPanel'
import { SyncStatus } from '@/components/SyncStatus'
import { runSync } from '@/lib/sync'
import { fetchMatchPoints } from '@/lib/api'
import { subscribeToMatchPoints } from '@/lib/realtime'
import { ensureWorkspaceAndPlayers, createMatchWithTournament } from '@/bootstrap'
import TournamentPicker from '@/components/TournamentPicker'
import { getTournamentById } from '@/lib/tournaments'
import './index.css'

export default function App() {
  const { points, initMatch, loadPoints } = useMatchStore()
  const [wsInfo, setWsInfo] = useState<{wsId:string,aId:string,bId:string} | null>(null)
  const [tournamentId, setTournamentId] = useState<string | null>(localStorage.getItem('tournament_id'))
  const [matchId, setMatchId] = useState<string | null>(localStorage.getItem('match_id'))
  const [tournament, setTournament] = useState<{ id:string; name:string } | null>(null)

  // Step 1: Ensure workspace + players
  useEffect(() => {
    ;(async () => {
      const info = await ensureWorkspaceAndPlayers()
      setWsInfo(info)
    })().catch(console.error)
  }, [])

  // Step 2: If we have tournament+match, load; otherwise wait for selection
  useEffect(() => {
    if (!wsInfo) return
    ;(async () => {
      if (tournamentId && !matchId) {
        const id = await createMatchWithTournament({ ...wsInfo, tournamentId })
        localStorage.setItem('match_id', id)
        setMatchId(id)
      }
      const idToUse = matchId
      if (!idToUse) return
      await initMatch(idToUse, 'A')
      await loadPoints(idToUse)
      await fetchMatchPoints(idToUse)
      const off = subscribeToMatchPoints(idToUse)
      return () => off()
    })().catch(console.error)
  }, [wsInfo, tournamentId, matchId])

  // Sync loop
  useEffect(() => {
    const id = setInterval(() => { runSync('demo-workspace') }, 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!tournamentId) { setTournament(null); return }
    (async () => {
      const t = await getTournamentById(tournamentId)
      setTournament({ id: t.id, name: t.name })
    })().catch(console.error)
  }, [tournamentId])

  const score = useMemo(() => computeLiveScore(points), [points])

  // If no tournament picked yet, show the picker
  if (wsInfo && !tournamentId) {
    return (
      <TournamentPicker
        workspaceId={wsInfo.wsId}
        onSelected={(tid) => {
          localStorage.setItem('tournament_id', tid)
          setTournamentId(tid)
        }}
      />
    )
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-3">Tennis Tracker</h1>
      <div className="text-xs text-slate-500 mb-1">
        {localStorage.getItem('tournament_id') ? 'Tournament selected' : 'No tournament'}
      </div>
      <button className="text-xs underline" onClick={() => { localStorage.removeItem('tournament_id'); localStorage.removeItem('match_id'); window.location.reload() }}>
        Change tournament
      </button>
      <ScoreBar
        setsA={score.setsA} setsB={score.setsB}
        gamesA={score.gamesA} gamesB={score.gamesB}
        pointText={score.pointText} server={score.server}
      />
      <PointPad />
      <StatsPanel />
      <SyncStatus />
      <div className="mt-6 text-xs text-slate-500">
        {tournamentId ? `Tournament selected ✔` : 'Pick a tournament to begin'}
      </div>
    </div>
  )
}
