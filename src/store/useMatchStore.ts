// src/store/useMatchStore.ts
import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'
import { fetchServerMaxSeq } from '@/lib/points'
import type { Point, AB } from '@/lib/types'

/** Strict UUID v4/5 checker (accepts v1–v5 per [1-5]) */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Structure to add a new point from the UI (PerformancePad) */
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

  /** Set the current match (and preload points + seq) */
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
      if (p.match_id === matchId && Number.isInteger(p.seq)) {
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
    // ✅ Guard: refuse invalid IDs so we never enqueue bad match_ids
    if (!UUID_RE.test(matchId)) {
      throw new Error(`Invalid matchId passed to setMatch: ${matchId}`)
    }
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
    // ✅ Guard: refuse to enqueue unless matchId is a real UUID
    if (!matchId || !UUID_RE.test(matchId)) {
      console.error('Refusing to add point: invalid matchId', matchId)
      alert('Match isn’t ready yet. Please open the match again.')
      return
    }

    // Allocate a seq from current counter
    const seqNow = get().nextSeq[matchId] ?? 1

    const nowIso = new Date().toISOString()
    const localPoint: Point = {
      id: crypto?.randomUUID?.() || nanoid(), // local-only id; server has its own
      match_id: matchId,
      seq: seqNow,
      server: p.server,
      first_serve_in: p.first_serve_in,
      second_serve_in: p.second_serve_in,
      rally_len: p.rally_len,
      finishing_shot: p.finishing_shot,
      outcome: p.outcome,
      finish_type: p.finish_type,
      tags: p.tags,
      created_at: nowIso,
      deleted_at: null,
    } as any

    // Update UI immediately
    set(s => ({
      points: [...s.points, localPoint],
      nextSeq: { ...s.nextSeq, [matchId]: seqNow + 1 },
    }))

    // Enqueue to outbox for background sync (idempotent upsert on match_id,seq)
    try {
      const wsId = getWsId()
      const outboxRow: OutboxPoint = {
        id: nanoid(),
        match_id: matchId,
        seq: seqNow,
        server: p.server,
        first_serve_in: p.first_serve_in,
        second_serve_in: p.second_serve_in,
        rally_len: p.rally_len,
        finishing_shot: p.finishing_shot,
        outcome: p.outcome,
        finish_type: p.finish_type,
        tags: p.tags,
        created_at: nowIso,
        deleted_at: null,
      }
      await (window as any).__outbox?.append?.(wsId, outboxRow)
      // Optional: quick debug
      // const sz = await (window as any).__outbox?.size?.(wsId); console.log('outbox size →', sz)
    } catch (e) {
      console.error('append to outbox failed', e)
      // (Optional) You could roll back local state here if you want strictness.
    }
  },

  undo: () => {
    const matchId = get().matchId
    if (!matchId) return

    set(s => {
      // find last point for this match
      for (let i = s.points.length - 1; i >= 0; i--) {
        if (s.points[i].match_id === matchId) {
          const removed = s.points[i]
          const nextSeqVal = s.nextSeq[matchId] ?? 1
          // If we’re undoing the most recent seq, roll back the counter by 1 (but not below 1)
          const shouldDecrement = removed.seq === nextSeqVal - 1
          const newNext = Math.max(1, shouldDecrement ? nextSeqVal - 1 : nextSeqVal)
          return {
            points: [...s.points.slice(0, i), ...s.points.slice(i + 1)],
            nextSeq: { ...s.nextSeq, [matchId]: newNext },
          }
        }
      }
      return s
    })

    // Note: we do NOT attempt to remove a pending outbox row here (requires your outbox API to support it).
    // The server upsert (onConflict match_id,seq) makes retries idempotent anyway.
  },

  reset: () => set({ matchId: null, points: [], nextSeq: {} }),
}))
