// src/pages/ScoringPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/Header'
import { useMatchStore } from '@/store/useMatchStore'
import { fetchMatchPoints } from '@/lib/api'
import { subscribeToMatchPoints } from '@/lib/realtime'
import { computeLiveScore } from '@/lib/matchEngine'
import { ScoreBar } from '@/components/ScoreBar'
import { PointPad } from '@/components/PointPad'
import { StatsPanel } from '@/components/StatsPanel'
import type { Tournament, Player } from '@/lib/types'
import { getMatchById } from '@/lib/matches'
import { getPlayersByIds } from '@/lib/players'

export default function ScoringPage({
  matchId,
  tournament,
  onBack
}:{ matchId:string; tournament: Tournament; onBack:()=>void }){

  const { points, initMatch, loadPoints } = useMatchStore()
  const [playerLabels, setPlayerLabels] = useState<{A:string,B:string}>({ A: 'Player A', B: 'Player B' })
  const myPlayerName = (localStorage.getItem('my_player_name') || '').trim()

  // Load local & remote points, subscribe to realtime
  useEffect(()=> {
    (async () => {
      await initMatch(matchId, 'A')
      await loadPoints(matchId)
      await fetchMatchPoints(matchId)
    })().catch(console.error)
    const off = subscribeToMatchPoints(matchId)
    return () => off()
  }, [matchId])

  // Fetch match & player names → set labels
  useEffect(() => {
    (async () => {
      const match = await getMatchById(matchId)
      const ids = [match.player_a_id, match.player_b_id].filter(Boolean) as string[]
      const map = await getPlayersByIds(ids)
      const a = map[match.player_a_id]?.name || (myPlayerName || 'Player A')
      const b = map[match.player_b_id]?.name || 'Opponent'
      setPlayerLabels({ A: a, B: b })
    })().catch(console.error)
  }, [matchId, myPlayerName])

  const score = useMemo(() => computeLiveScore(points), [points])

  // --- Export to CSV ---
  function exportCSV() {
    // Build CSV header + rows
    const header = [
      'seq','server','first_serve_in','second_serve_in','rally_len',
      'finishing_shot','outcome','finish_type','tags','created_at'
    ]
    const rows = points.map(p => [
      p.seq,
      p.server,
      p.first_serve_in ?? '',
      p.second_serve_in ?? '',
      p.rally_len ?? '',
      p.finishing_shot ?? '',
      p.outcome,
      p.finish_type ?? '',
      (p.tags || []).join('|'),
      p.created_at ?? ''
    ])

    const lines = [
      // optional metadata lines
      `# Tournament: ${tournament?.name || ''}`,
      `# Match ID: ${matchId}`,
      `# My Player: ${playerLabels.A}`,
      `# Opponent: ${playerLabels.B}`,
      header.join(','),
      ...rows.map(r => r.map(v => {
        const s = String(v)
        return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s
      }).join(','))
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = (tournament?.name || 'tournament').replace(/[^a-z0-9-_]+/gi, '_')
    a.download = `${safeName}_${matchId.slice(0,8)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-md mx-auto p-4">
      {/* 1) Tournament name in the header */}
      <Header title={`${tournament?.name || 'Score Pad'}`} onBack={onBack} />

      {/* Small bar with actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-slate-500">Match: {matchId.slice(0,8)}…</div>
        <button onClick={exportCSV} className="px-3 py-1 rounded-lg border bg-white text-sm hover:bg-slate-50">
          Export CSV
        </button>
      </div>

      {/* 2) ScoreBar with My Player name */}
      <ScoreBar
        setsA={score.setsA} setsB={score.setsB}
        gamesA={score.gamesA} gamesB={score.gamesB}
        pointText={score.pointText} server={score.server}
        playerALabel={playerLabels.A}
        playerBLabel={playerLabels.B}
      />

      <PointPad />
      <StatsPanel />
    </div>
  )
}
