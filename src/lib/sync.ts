import { db } from './db'
import { supabase } from './supabase'

export async function runSync(workspaceId: string) {
  if (!supabase) return
  const items = await db.outbox.orderBy('id').toArray()
  for (const it of items) {
    try {
      if (it.type === 'point.insert') {
        await supabase.from('points').insert(it.payload)
      } else if (it.type === 'point.delete') {
        await supabase.from('points').update({ deleted_at: new Date().toISOString() }).eq('id', it.payload.id)
      }
      await db.outbox.delete(it.id)
    } catch (e) { console.error('sync error', e); break }
  }
}
