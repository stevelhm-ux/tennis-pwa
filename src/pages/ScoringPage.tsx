// src/pages/ScoringPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/Header'
import PerformancePad from '@/components/PerformancePad'
import { StatsPanel } from '@/components/StatsPanel'
import PointsTableModal from '@/components/PointsTableModal'
import { exportMatchCsv } from '@/lib/exportCsv'
import type { Tournament } from '@/lib/types'
import { useMatchStore } from '@/store/useMatchStore'

export default function ScoringPage({
  matchId,
  tournament,
  onBack,
}: {
  matchId: string
  tournament: Tournament
  onBack: () => void
}) {
  // Pull actions from store
  const setMatch = useMatchStore((s) => s.setMatch)

  // Initialize store for this match
  useEffect(() => {
    if (!matchId || typeof setMatch !== 'function') return
    setMatch(matchId).catch(console.error)
  }, [matchId, setMatch])

  const [tableOpen, setTableOpen] = useState(false)
  const title = useMemo(() => tournament?.name ?? 'Match', [tournament])

  function handleExport() {
    exportMatchCsv(matchId).catch(console.error)
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <Header title={title} onBack={onBack} />

      {/* Actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-slate-600">
          Tournament: <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTableOpen(true)}
            className="px-3 py-1 rounded-lg border bg-white text-sm hover:bg-slate-50"
            title="View points table"
          >
            📊 Points
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1 rounded-lg border bg-white text-sm hover:bg-slate-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Performance tracking pad + stats */}
      <PerformancePad />
      <StatsPanel />

      {/* Points table modal (latest first) */}
      <PointsTableModal matchId={matchId} open={tableOpen} onClose={() => setTableOpen(false)} />
    </div>
  )
}
