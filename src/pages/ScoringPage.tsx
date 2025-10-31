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
import type { Tournament } from '@/lib/types'
import { getMatchById } from '@/lib/matches'
import { getPlayersByIds } from '@/lib/players'
import { getTournamentById } from '@/lib/tournaments'

export default function ScoringPage({
  matchId,
  tournament,       // may be undefined; we’ll resolve name if so
  onBack
}:{
  matchId:string
  tournament?: Tournament | null
  onBack:()=>void
}) {
  const { points, initMatch, loadPoints } = useMatchStore()

  // Labels for players
  const [playerLabels, setPlayerLabels] = useState<{A:string,B:string}>({ A: 'Player A', B: 'Player B' })
  const myPlayerName = (localStorage.getItem('my_player_name') || '').trim()

  // Title handling (tournament name or fallback)
  const [title, setTitle] = useState<string>(tournament?.name || 'Score Pad')

  // Load local & remote points, subscribe to realtime
  useEffect(() => {
    (async () => {
      await initMatch(matchId, 'A')
      await loadPoints(matchId)
      await fetchMatchPoints(matchId)
    })().catch(console.error)
    const off = subscribeToMatchPoints(matchId)
    return () => off()
  }, [matchId])

  // Resolve player names and tournament title if needed
  useEffect(() => {
    (async () => {
      // Player labels
      const m = await getMatchById(matchId)
      const ids = [m.player_a_id, m.player_b_id].filter(Boolean) as string[]
      const map = await getPlayersByIds(ids)
      const a = map[m.player_a_id]?.name || (myPlayerName || 'Player A')
      const b = map[m.player_b_id]?.name || 'Opponent'
      setPlayerLabels({ A: a, B: b })

      // Tournament title
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

  // Export CSV (unchanged)
  function exportCSV() {
    const header = ['seq','server','first_serve_in','second_serve_in','rally_len','finishing_shot','outcome','finish_type','tags','created_at']
    const rows = points.map(p => [
      p.seq, p.server, p.first_serve_in ?? '', p.second_serve_in ?? '', p.rally_len ?? '',
      p.finishing_shot ?? '', p.outcome, p.finish_type ?? '', (p.tags || []).join('|'), p.created_at ?? ''
    ])
    const lines = [
      `# Tournament: ${title || ''}`,
      `# Match ID: ${matchId}`,
      `# My Player: ${playerLabels.A}`,
      `# Opponent: ${playerLabels.B}`,
      header.join(','),
      ...rows.map(r => r.map(v => {
        const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s
      }).join(','))
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = (title || 'tournament').replace(/[^a-z0-9-_]+/gi, '_')
    a.download = `${safeName}_${matchId.slice(0,8)}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-md mx-auto p-4">
      {/* ✅ shows tournament name when available */}
      <Header title={title} onBack={onBack} />

      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-slate-500">Match: {matchId.slice(0,8)}…</div>
        <button onClick={exportCSV} className="px-3 py-1 rounded-lg border bg-white text-sm hover:bg-slate-50">
          Export CSV
        </button>
      </div>

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
