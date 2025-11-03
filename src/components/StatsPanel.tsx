import React from 'react'
import { basicStats } from '@/lib/matchEngine'
import { useMatchStore } from '@/store/useMatchStore'

function pct(n: number){ return isFinite(n) ? Math.round(n*100) : 0 }

export function StatsPanel(){
  const points = useMatchStore(s=>s.points)
  const s = basicStats(points)

  return (
    <div className="mt-6 bg-white rounded-2xl p-4 shadow">
      <div className="font-semibold mb-2">Stats (so far)</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Total points</div><div className="text-right">{s.totalPoints}</div>
        <div>Points won</div><div className="text-right">{pct(s.pctWonA)}%</div>
        <div>1st serve in</div><div className="text-right">{pct(s.firstServeInPct)}%</div>
        <div>Double faults</div><div className="text-right">{s.doubleFaultsUs}</div>
        <div>1st serve pts won</div><div className="text-right">{pct(s.firstServePtsWonPct)}%</div>
        <div>2nd serve pts won</div><div className="text-right">{pct(s.secondServePtsWonPct)}%</div>
      </div>
    </div>
  )
}
