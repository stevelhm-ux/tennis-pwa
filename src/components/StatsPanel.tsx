import React from 'react'
import { basicStats } from '@/lib/matchEngine'
import { useMatchStore } from '@/store/useMatchStore'
export function StatsPanel(){
  const points = useMatchStore(s=>s.points)
  const stats = basicStats(points)
  return (
    <div className="mt-6 bg-white rounded-2xl p-4 shadow">
      <div className="font-semibold mb-2">Quick Stats</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Total points</div><div className="text-right">{stats.totalPoints}</div>
        <div>Points won (A)</div><div className="text-right">{Math.round(stats.pctWonA*100)}%</div>
        <div>1st serve in</div><div className="text-right">{Math.round(stats.firstServeInPct*100)}%</div>
        <div>Double faults</div><div className="text-right">{stats.doubleFaults}</div>
        <div>Avg rally</div><div className="text-right">{stats.rallyAvg}</div>
      </div>
    </div>
  )
}
