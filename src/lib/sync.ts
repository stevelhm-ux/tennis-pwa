// src/lib/sync.ts
import { db } from './db'
import { supabase } from './supabase'

export async function runSync(workspaceId: string) {
  if (!supabase) return
  const items = await db.outbox.orderBy('id').toArray()

  for (const it of items) {
    try {
      if (it.type === 'point.insert') {
        // ⬇️ Drop local nanoid; let DB generate UUID 'id'
        const { id: _drop, ...rest } = it.payload
        const { error } = await supabase.from('points').insert(rest).select().single()
        if (error) throw error

      } else if (it.type === 'point.delete') {
        // ⬇️ Soft-delete by composite key
        const { match_id, seq } = it.payload
        const { error } = await supabase
          .from('points')
          .update({ deleted_at: new Date().toISOString() })
          .match({ match_id, seq })
        if (error) throw error
      }

      await db.outbox.delete(it.id) // success → remove from queue
    } catch (e) {
      console.error('sync error', e)
      break // stop; retry next tick
    }
  }
}
