
import { db } from './db'
import { supabase } from './supabase'

export async function runSync(workspaceId: string) {
  if (!supabase) return
  const items = await db.outbox.orderBy('id').toArray()
  for (const it of items) {
    try {
      if (it.type === 'point.insert') {
        const { id: _drop, ...rest } = it.payload
        const { error } = await supabase.from('points').insert(rest).select().single()
        if (error) throw error
      } else if (it.type === 'point.delete') {
        const { match_id, seq } = it.payload
        const { error } = await supabase
          .from('points')
          .update({ deleted_at: new Date().toISOString() })
          .match({ match_id, seq })
        if (error) throw error
      }
      await db.outbox.delete(it.id)
    } catch (e) {
      console.error('sync error', e); break
    }
  }
}
