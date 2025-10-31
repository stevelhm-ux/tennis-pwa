
import React, { useEffect, useMemo } from 'react'
import { Header } from '@/components/Header'
import { useMatchStore } from '@/store/useMatchStore'
import { fetchMatchPoints } from '@/lib/api'
import { subscribeToMatchPoints } from '@/lib/realtime'
import { computeLiveScore } from '@/lib/matchEngine'
import { ScoreBar } from '@/components/ScoreBar'
import { PointPad } from '@/components/PointPad'
import { StatsPanel } from '@/components/StatsPanel'

export default function ScoringPage({ matchId, onBack }:{ matchId:string; onBack:()=>void }){
  const { points, initMatch, loadPoints } = useMatchStore()

  useEffect(()=>{
    initMatch(matchId, 'A').then(async ()=>{
      await loadPoints(matchId)
      await fetchMatchPoints(matchId)
    })
    const off = subscribeToMatchPoints(matchId)
    return () => off()
  }, [matchId])

  const score = useMemo(() => computeLiveScore(points), [points])

  return (
    <div className="max-w-md mx-auto p-4">
      <Header title="Score Pad" onBack={onBack} />
      <ScoreBar setsA={score.setsA} setsB={score.setsB} gamesA={score.gamesA} gamesB={score.gamesB} pointText={score.pointText} server={score.server} />
      <PointPad />
      <StatsPanel />
    </div>
  )
}
