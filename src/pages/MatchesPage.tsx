// src/pages/MatchesPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '@/components/Header'
import { getWorkspaceId } from '@/bootstrap'
import { supabase } from '@/lib/supabase'
import {
  listMatches,
  createMatch,
  updateMatchOpponent,
} from '@/lib/matches'
import type { Match, Tournament, Player } from '@/lib/types'

type Props = {
  tournament: Tournament
  myPlayerId: string // your "My Player" id (player_a_id)
  onBack: () => void
  onOpenMatch: (matchId: string, tournament: Tournament) => void
}

export default function MatchesPage({
  tournament,
  myPlayerId,
  onBack,
  onOpenMatch,
}: Props) {
  const wsId = getWorkspaceId()!
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<Match[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const [opponentName, setOpponentName] = useState('')
  const createdOnce = useRef(false)

  // One-time breadcrumb to confirm IDs are correct
  useEffect(() => {
    if (createdOnce.current) return
    createdOnce.current = true
    // eslint-disable-next-line no-console
    console.log('[MatchesPage] wsId:', wsId, 'tournamentId:', tournament?.id)
  }, [wsId, tournament?.id])

  const refresh = useCallback(async () => {
    if (!wsId || !tournament?.id) return
    setLoading(true)
    try {
      // 1) Load matches in this workspace + tournament
      const rows = await listMatches(wsId, { tournamentId: tournament.id })
      setMatches(rows)

      // 2) Gather unique player ids and fetch their names
      const ids = new Set<string>()
      for (const m of rows) {
        if (m.player_a_id) ids.add(m.player_a_id)
        if (m.player_b_id) ids.add(m.player_b_id)
      }
      if (myPlayerId) ids.add(myPlayerId)

      if (ids.size) {
        const { data, error } = await supabase
          .from('players')
          .select('id,name')
          .in('id', Array.from(ids))

        if (error) throw error
        const map: Record<string, string> = {}
        for (const p of (data || []) as Pick<Player, 'id' | 'name'>[]) {
          map[p.id] = p.name
        }
        setNameMap(map)
      } else {
        setNameMap({})
      }
    } catch (e) {
      console.error('MatchesPage refresh error', e)
    } finally {
      setLoading(false)
    }
  }, [wsId, tournament?.id, myPlayerId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const myPlayerLabel = useMemo(
    () => (nameMap[myPlayerId] ? nameMap[myPlayerId] : 'My Player'),
    [nameMap, myPlayerId]
  )

  async function handleCreateMatch() {
    try {
      if (!opponentName.trim()) {
        alert('Please enter an opponent name.')
        return
      }
      if (!wsId || !tournament?.id || !myPlayerId) {
        alert('Tournament or player context not ready.')
        return
      }
      const m = await createMatch({
        wsId,
        tournamentId: tournament.id,
        playerAId: myPlayerId,
        playerBId: myPlayerId, // temporary, will be replaced below if you want
      })
      // If you want to immediately set the real opponent (by name → player_b_id):
      await updateMatchOpponent({
        matchId: m.id,
        wsId,
        opponentName: opponentName.trim(),
      })
      setOpponentName('')
      await refresh()
      onOpenMatch(m.id, tournament) // navigate with the server UUID
    } catch (e) {
      console.error('Create match failed', e)
      alert('Failed to create match. See console for details.')
    }
  }

  async function handleEditOpponent(matchId: string) {
    const name = prompt('Opponent name?')
    if (!name) return
    try {
      await updateMatchOpponent({ matchId, wsId, opponentName: name })
      await refresh()
    } catch (e) {
      console.error('Update opponent failed', e)
      alert('Failed to update opponent. See console for details.')
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <Header title={`Matches — ${tournament?.name ?? ''}`} onBack={onBack} />

      {/* Tournament quick info */}
      <div className="mb-4 rounded-2xl border p-3 bg-white shadow-sm">
        <div className="text-sm text-slate-600">
          <div><span className="font-medium">Tournament:</span> {tournament?.name}</div>
          {tournament?.venue && <div><span className="font-medium">Venue:</span> {tournament.venue}</div>}
          {tournament?.date && <div><span className="font-medium">Date:</span> {new Date(tournament.date).toLocaleDateString()}</div>}
          {tournament?.grade && <div><span className="font-medium">Grade:</span> {tournament.grade}</div>}
          {tournament?.age_group && <div><span className="font-medium">Age Group:</span> {tournament.age_group}</div>}
        </div>
      </div>

      {/* Create new match */}
      <div className="mb-4 rounded-2xl border p-3 bg-white shadow-sm">
        <div className="text-sm mb-2">
          <div className="font-medium mb-1">Create New Match</div>
          <div className="text-slate-600">
            <div className="mb-1">My Player: <span className="font-semibold">{myPlayerLabel}</span></div>
            <label className="block text-xs text-slate-500 mb-1">Opponent name</label>
            <input
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="Opponent name"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleCreateMatch}
            className="px-3 py-2 rounded-lg bg-black text-white text-sm hover:opacity-90"
          >
            Create & Open
          </button>
        </div>
      </div>

      {/* Matches list */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="px-3 py-2 border-b text-sm font-medium">Matches</div>
        {loading ? (
          <div className="p-3 text-sm text-slate-500">Loading…</div>
        ) : matches.length === 0 ? (
          <div className="p-3 text-sm text-slate-500">No matches yet.</div>
        ) : (
          <ul className="divide-y">
            {matches.map((m) => {
              const a = nameMap[m.player_a_id] || 'Player A'
              const b = m.player_b_id ? (nameMap[m.player_b_id] || 'Opponent') : 'Opponent'
              return (
                <li key={m.id} className="p-3 flex items-center gap-3">
                  <button
                    className="flex-1 text-left"
                    onClick={() => onOpenMatch(m.id, tournament)}
                    title="Open scoring"
                  >
                    <div className="font-medium">{a} vs {b}</div>
                    <div className="text-xs text-slate-500">
                      Created {new Date(m.created_at || m.inserted_at || Date.now()).toLocaleString()}
                    </div>
                  </button>
                  <button
                    onClick={() => handleEditOpponent(m.id)}
                    className="px-2 py-1 rounded-lg border text-xs hover:bg-slate-50"
                    title="Edit opponent"
                  >
                    Edit
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
