import React, { useEffect, useMemo } from 'react'
import { useMatchStore } from '@/store/useMatchStore'
import { computeLiveScore } from '@/lib/matchEngine'
import { ScoreBar } from '@/components/ScoreBar'
import { PointPad } from '@/components/PointPad'
import { StatsPanel } from '@/components/StatsPanel'
import { SyncStatus } from '@/components/SyncStatus'
import { runSync } from '@/lib/sync'
import { fetchMatchPoints } from '@/lib/api'
import { subscribeToMatchPoints } from '@/lib/realtime'
import { ensureBootstrap } from '@/bootstrap'
import './index.css'

export default function App() {
  const { points, initMatch, loadPoints } = useMatchStore()

useEffect(() => {
  let off: (() => void) | undefined
  (async () => {
    // Creates/locates workspace, players, match, then returns a real UUID
    const id = await ensureBootstrap()

    await initMatch(id, 'A')
    await loadPoints(id)
    await fetchMatchPoints(id)

    off = subscribeToMatchPoints(id)
  })().catch(console.error)

  return () => { if (off) off() }
}, [])

  useEffect(() => {
    const id = setInterval(() => { runSync('demo-workspace') }, 5000)
    return () => clearInterval(id)
  }, [])

  const score = useMemo(() => computeLiveScore(points), [points])

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-3">Tennis Tracker</h1>
      <ScoreBar setsA={score.setsA} setsB={score.setsB} gamesA={score.gamesA} gamesB={score.gamesB} pointText={score.pointText} server={score.server} />
      <PointPad />
      <StatsPanel />
      <SyncStatus />
      <div className="mt-6 text-xs text-slate-500">Demo mode: add Supabase keys in .env to sync & subscribe.</div>
    </div>
  )
}
