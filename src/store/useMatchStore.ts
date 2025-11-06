// src/store/useMatchStore.ts
import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'
import { fetchServerMaxSeq } from '@/lib/points'
import type { Point, AB } from '@/lib/types'

/** Structure you use to add a new point from the UI (PerformancePad) */
export type PointInput = {
  server: AB
  first_serve_in: boolean | null
  second_serve_in: boolean | null
  rally_len: number | null
  finishing_shot: 'FH' | 'BH' | 'Volley' | 'Overhead' | null
  outcome: AB
  finish_type: 'Winner' | 'UE' | 'Forced' | 'Ace' | 'DF' | null
  tags: string[] | null
}

/** What your outbox stores for later upsert */
export type OutboxPoint = {
  id: string // client uid
  match_id: string
  seq: number
  server: AB
  first_serve_in: boolean | null
  second_serve_in: boolean | null
  rally_len: number | null
  finishing_shot: 'FH' | 'BH' | 'Volley' | 'Overhead' | null
  outcome: AB
  finish_type: 'Winner' | 'UE' | 'Forced' | 'Ace' | 'DF' | null
  tags: string[] | null
  created_at: string
  deleted_at?: string | null
}

type State = {
  /** Currently open match */
  matchId: string | null
  /** Points for the current match (kept in memory; refresh with loadFromServer) */
  points: Point[]
  /** Next seq to use per match (initialized via initMatchSeq) */
  nextSeq: Record<string, number>

  /** Set the current match (and optionally preload points) */
  setMatch: (matchId: string) => Promise<void>

  /** Pull points from server (for current match) and put into store (ascending by seq) */
  loadFromServer: () => Promise<void>

  /** Initialize nextSeq[matchId] from server max, local points, and pending outbox (if available) */
  initMatchSeq: (matchId: string) => Promise<void>

  /** Add a point locally (and enqueue to outbox); sequence assigned automatically */
  addPoint: (p: PointInput) => Promise<void>

  /** Remove the last point for the current match from local state (does NOT touch server) */
  undo: () => void

  /** Clear store (when leaving match, optional) */
  reset: () => void
}

function getWsId(): string {
  // Your app stashes this when ensureWorkspace() is resolved
  return (window as any).__wsId || localStorage.getItem('wsId') || 'default'
}

/** Read max seq in pending outbox for this match (best effort; returns 0 if none) */
async function readPendingOutboxMaxSeq(matchId: string): Promise<number> {
  try {
    const wsId = getWsId()
    const box = (window as any).__outbox
    if (!box?.read) return 0
    const pending: OutboxPoint[] = await box.read(wsId)
    let maxSeq = 0
    for (const p of pending || []) {
      if (p.match_id === matchId && typeof p.seq === 'number') {
        if (p.seq > maxSeq) maxSeq = p.seq
      }
    }
    return maxSeq
  } catch {
    return 0
  }
}

export const useMatchStore = create<State>((set, get) => ({
  matchId: null,
  points: [],
  nextSeq: {},

  setMatch: async (matchId: string) => {
    set({ matchId, points: [] })
    await get().loadFromServer()
    await get().initMatchSeq(matchId)
  },

  loadFromServer: async () => {
    const matchId = get().matchId
    if (!matchId) return
    const { data, error } = await supabase!
      .from('points')
      .select('*')
      .eq('match_id', matchId)
      .is('deleted_at', null)
      .order('seq', { ascending: true })
    if (error) {
      console.error('loadFromServer points error', error)
      return
    }
    set({ points: (data || []) as Point[] })
  },

  initMatchSeq: async (matchId: string) => {
    // 1) server max
    const serverMax = await fetchServerMaxSeq(matchId)
    // 2) local in-memory max (already added points)
    const localMax = Math.max(
      0,
      ...get()
        .points.filter(p => p.match_id === matchId)
        .map(p => p.seq || 0)
    )
    // 3) pending outbox max (unsynced)
    const pendingMax = await readPendingOutboxMaxSeq(matchId)

    const next = Math.max(serverMax, localMax, pendingMax) + 1
    set(s => ({ nextSeq: { ...s.nextSeq, [matchId]: next } }))
  },

  addPoint: async (p: PointInput) => {
    const matchId = get().matchId
    if (!matchId) throw new Error('No match selected')

    // Allocate a seq from current counter
    const seqNow = get().nextSeq[matchId] ?? 1

    const nowIso =
