// src/pages/ScoringPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/Header'
import PerformancePad from '@/components/PerformancePad'
import { StatsPanel } from '@/components/StatsPanel'
import PointsTableModal from '@/components/PointsTableModal'
import { exportMatchCsv } from '@/lib/exportCsv'
import type { Tournament } from '@/lib/types'
import { useMatchStore } from '@/store/useMatchStore'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function ScoringPage({
  matchId,
  tournament,
  onBack,
}: {
  matchId: string
  tournament: Tournament
  onBack: () => void
}) {
  const setMatch = useMatchStore((s) => s.setMatch)
  const [tableOpen, setTableOpen] = useState(false)
  const title = useMemo(() => tournament?.name ?? 'Match', [tournament])

  useEffect(() => {
    // debug breadcrumb
    // eslint-disable-next-line no-console
    console.log('[ScoringPage] matchId=', matchId, 'validUUID=', UUID_RE.test(matchId))
    if (!UUID_RE.test(matchId)) return
    setMatch(matchId).catch(console.error)
  }, [matchId, setMatch])

  const invalid = !UUID_RE.test(matchId)

  return (
    <div className="max-w-md mx-auto p-4">
      <Header title={title} onBack={onBack} />
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
            onClick={() => exportMatchCsv(matchId)}
            className="px-3 py-1 rounded-lg border bg-white text-sm hover:bg-slate-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {invalid ? (
        <div className="rounded-lg border bg-amber-50 text-amber-800 p-3 text-sm">
          This match isn’t ready yet. Please go back and open the match again.
          <div className="mt-1 text-xs text-amber-600">matchId: {String(matchId)}</div>
        </div>
      ) : (
        <>
          <PerformancePad />
          <StatsPanel />
          <PointsTableModal matchId={matchId} open={tableOpen} onClose={() => setTableOpen(false)} />
        </>
      )}
    </div>
  )
}
