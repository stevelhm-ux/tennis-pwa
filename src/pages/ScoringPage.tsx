// src/pages/ScoringPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/Header'
import { useMatchStore } from '@/store/useMatchStore'
import { fetchMatchPoints } from '@/lib/api'
import { subscribeToMatchPoints } from '@/lib/realtime'
import { computeLiveScore } from '@/lib/matchEngine'
import { StatsPanel } from '@/components/StatsPanel'
import type { Tournament } from '@/lib/types'
import { getMatchById } from '@/lib/matches'
import { getPlayersByIds } from '@/lib/players'
import { getTournamentById } from '@/lib/tournaments'
import { exportMatchCsv } from '@/lib/exportCsv'
import PerformancePad from '@/components/PerformancePad'

export default function ScoringPage({
  matchId,
  tournament,     // may be undefined; we’ll resolve if needed
  onBack
}:{
  matchId: string
  tournament?: Tournament | null
  onBack: () => void
}) {
  const { points, initMatch, loadPoints } = useMatchStore()

  // Player labels
  const [playerLabels, setPlayerLabels] = useState<{ A: string; B: string }>({
    A: 'Player A',
    B: 'Player B',
  })
  const myPlayerName = (localStorage.getItem('my_player_name') || '').trim()

  // Tournament title to display
  const [title, setTitle] = useState<string>(tournament?.name || 'Score Pad')

  // Load local & remote points, then subscribe
  useEffect(() => {
    (async () => {
      await initMatch(matchId, 'A')
      await loadPoints(matchId)
      await fetchMatchPoints(matchId)
    })().catch(console.error)
    const off = subscribeToMatchPoints(matchId)
    return () => off()
  }, [matchId])

  // Resolve player names and tournament title
  useEffect(() => {
    (async () => {
      const m = await getMatchById(matchId)
      const ids = [m.player_a_id, m.player_b_id].filter(Boolean) as string[]
      const map = await getPlayersByIds(ids)
      const a = map[m.player_a_id]?.name || (myPlayerName || 'Player A')
      const b = map[m.player_b_id]?.name || 'Opponent'
      setPlayerLabels({ A: a, B: b })

      if (tournament?.name) {
        setTitle(tournament.name)
      } else if (m.tournament_id) {
        try {
          const t = await getTournamentById(m.tournament_id)
          setTitle(t?.name || 'Score Pad')
        } catch {
          setTitle('Score Pad')
        }
      } else {
        setTitle('Score Pad')
      }
    })().catch(console.error)
  }, [matchId, tournament?.name, myPlayerName])

  const score = useMemo(() => computeLiveScore(points), [points])

  // --- Export to CSV (points of this match) ---
 function exportCSV() {
  exportMatchCsv(matchId).catch(console.error)
}

  return (
    <div className="max-w-md mx-auto p-4">
      {/* Header shows tournament name */}
      <Header title={title} onBack={onBack} />

      {/* Actions bar: tournament name on left, Export on right (no match ID) */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-slate-600">
          Tournament: <span className="font-medium">{title}</span>
        </div>
        <button
          onClick={exportCSV}
          className="px-3 py-1 rounded-lg border bg-white text-sm hover:bg-slate-50"
        >
          Export CSV
        </button>
      </div>

      <ScoreBar
        setsA={score.setsA}
        setsB={score.setsB}
        gamesA={score.gamesA}
        gamesB={score.gamesB}
        pointText={score.pointText}
        server={score.server}
        playerALabel={playerLabels.A}
        playerBLabel={playerLabels.B}
      />

      <PointPad />
      <StatsPanel />
    </div>
  )
}

