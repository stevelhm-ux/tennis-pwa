
import { create } from 'zustand'
import { db } from '@/lib/db'
import type { Point, AB } from '@/lib/types'
import { nanoid } from '@/util/nanoid'

interface State { matchId: string | null; seq: number; points: Point[]; server: AB }
interface Actions {
  initMatch: (matchId: string, server: AB) => Promise<void>
  addPoint: (p: Omit<Point, 'id'|'seq'|'match_id'>) => Promise<void>
  undo: () => Promise<void>
  loadPoints: (matchId: string) => Promise<void>
}

export const useMatchStore = create<State & Actions>((set, get) => ({
  matchId: null, seq: 0, points: [], server: 'A',

  initMatch: async (matchId, server) => {
    set({ matchId, server, seq: 0, points: [] })
    await db.points.where('match_id').equals(matchId).delete()
  },

  loadPoints: async (matchId) => {
    const pts = await db.points.where('match_id').equals(matchId).sortBy('seq')
    const seq = pts.length ? pts[pts.length-1].seq + 1 : 0
    set({ matchId, points: pts, seq })
  },

  addPoint: async (p) => {
    const { matchId, seq, points } = get()
    if (!matchId) return
    const point: Point = { ...p, id: nanoid(), match_id: matchId, seq }
    await db.points.add(point)
    await db.outbox.add({ type: 'point.insert', payload: point, created_at: new Date().toISOString() })
    set({ points: [...points, point], seq: seq + 1 })
  },

  undo: async () => {
    const { matchId, seq, points } = get()
    if (!matchId || seq===0) return
    const last = points[points.length-1]
    if (!last) return
    await db.points.delete(last.id)
    await db.outbox.add({ type: 'point.delete', payload: { match_id: last.match_id, seq: last.seq }, created_at: new Date().toISOString() })
    set({ points: points.slice(0,-1), seq: seq - 1 })
  },
}))
