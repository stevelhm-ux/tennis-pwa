// src/App.tsx
import React, { useEffect, useState } from 'react'
import TournamentsPage from '@/pages/TournamentsPage'
import MatchesPage from '@/pages/MatchesPage'
import ScoringPage from '@/pages/ScoringPage'
import { SyncStatus } from '@/components/SyncStatus'
import type { Tournament } from '@/lib/types'
import { runSync } from '@/lib/sync'
import { ensureWorkspace } from '@/bootstrap'
import './index.css'

type View =
  | { name: 'tournaments' }
  | { name: 'matches'; tournament: Tournament; wsId: string }
  | { name: 'scoring'; matchId: string; tournament: Tournament; wsId: string }

export default function App() {
  const [view, setView] = useState<View>({ name: 'tournaments' })
  const [wsId, setWsId] = useState<string | null>(null)

  // Resolve a real workspace on boot (for sync loop)
  useEffect(() => {
    (async () => {
      try {
        const id = await ensureWorkspace()
        setWsId(id)
      } catch (e) {
        console.error('ensureWorkspace failed', e)
      }
    })()
  }, [])

  // Background sync: only when we have a real workspace id
  useEffect(() => {
    if (!wsId) return
    const id = setInterval(() => {
      runSync(wsId).catch(err => console.error('runSync error', err))
    }, 5000)
    return () => clearInterval(id)
  }, [wsId])

  // --- Views ---
  if (view.name === 'tournaments') {
    return (
      <>
        <TournamentsPage
          onEnterTournament={(t, realWsId) => {
            setWsId(realWsId) // keep app-level wsId in sync
            setView({ name: 'matches', tournament: t, wsId: realWsId })
          }}
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
    <div className="max-w-md mx-auto px-4">
      <div className="mt-6 mb-2 text-xs text-slate-400">
        Build: {import.meta.env.VITE_BUILD_ID ?? 'dev'}
      </div>
    </div>
  )
}
