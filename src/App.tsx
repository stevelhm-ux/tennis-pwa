// src/App.tsx
import React, { useEffect, useState } from 'react'
import TournamentsPage from '@/pages/TournamentsPage'
import MatchesPage from '@/pages/MatchesPage'
import ScoringPage from '@/pages/ScoringPage'
import { SyncStatus } from '@/components/SyncStatus'
import { runSync } from '@/lib/sync'
import type { Tournament } from '@/lib/types'
import './index.css'

type View =
  | { name: 'tournaments' }
  | { name: 'matches'; tournament: Tournament; wsId: string }
  | { name: 'scoring'; matchId: string; tournament: Tournament; wsId: string }

export default function App() {
  const [view, setView] = useState<View>({ name: 'tournaments' })

  // Background sync loop (keeps pushing outbox -> Supabase)
  useEffect(() => {
    const id = setInterval(() => {
      // You can replace 'demo-workspace' with a real workspaceId if you store it
      runSync('demo-workspace').catch(console.error)
    }, 5000)
    return () => clearInterval(id)
  }, [])

  // Render by view
  if (view.name === 'tournaments') {
    return (
      <>
        <TournamentsPage
          onEnterTournament={(t, wsId) => setView({ name: 'matches', tournament: t, wsId })}
        />
        <FooterBuild />
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
          onBack={() => setView({ name: 'tournaments' })}
          onOpenMatch={(matchId) =>
            setView({ name: 'scoring', matchId, tournament: view.tournament, wsId: view.wsId })
          }
        />
        <FooterBuild />
        <SyncStatus />
      </>
    )
  }

  // scoring
  return (
    <>
      <ScoringPage
        matchId={view.matchId}
        tournament={view.tournament}
        onBack={() => setView({ name: 'matches', tournament: view.tournament, wsId: view.wsId })}
      />
      <FooterBuild />
      <SyncStatus />
    </>
  )
}

/** Small footer that shows which build/version is running */
function FooterBuild() {
  return (
    <div className="max-w-md mx-
