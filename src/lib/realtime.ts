
import { supabase } from './supabase'
import { db } from './db'
import type { Point } from './types'

export function subscribeToMatchPoints(matchId: string) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`points-${matchId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'points', filter: `match_id=eq.${matchId}` }, async (payload) => {
      const row = (payload.new || payload.old) as Point | undefined
      if (!row) return
      if ((row as any).deleted_at) await db.points.delete(row.id)
      else await db.points.put(row)
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
