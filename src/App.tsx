
import React, { useEffect, useState } from 'react'
import TournamentsPage from '@/pages/TournamentsPage'
import MatchesPage from '@/pages/MatchesPage'
import ScoringPage from '@/pages/ScoringPage'
import { runSync } from '@/lib/sync'
import { SyncStatus } from '@/components/SyncStatus'
import type { Tournament } from '@/lib/types'
import './index.css'

type View =
  | { name: 'tournaments' }
  | { name: 'matches', tournament: Tournament, wsId: string }
  | { name: 'scoring', matchId: string, tournament: Tournament, wsId: string }

export default function App() {
  const [view, setView] = useState<View>({ name: 'tournaments' })

  useEffect(() => {
    const id = setInterval(() => { runSync('demo-workspace') }, 5000)
    return () => clearInterval(id)
  }, [])

  if (view.name === 'tournaments') {
    return (
      <>
        <TournamentsPage onEnterTournament={(t, wsId) => setView({ name:'matches', tournament: t, wsId })} />
        <SyncStatus />
      </>
    )
  }

  if (view.name === 'matches') {
    return (
      <>
        <MatchesPage
          wsId={view.wsId}
          tournament={view.tournament}
          onBack={() => setView({ name:'tournaments' })}
          onOpenMatch={(matchId) => setView({ name:'scoring', matchId, tournament: view.tournament, wsId: view.wsId })}
        />
        <SyncStatus />
      </>
    )
  }

  return (
    <>
      <ScoringPage matchId={view.matchId} onBack={() => setView({ name:'matches', tournament: view.tournament, wsId: view.wsId })} />
      <SyncStatus />
    </>
  )
}

<div className="mt-6 text-xs text-slate-400">
  Build: {import.meta.env.VITE_BUILD_ID ?? 'dev'}
</div>
