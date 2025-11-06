// src/lib/sync.ts
import { supabase } from '@/lib/supabase'

export type OutboxPoint = {
  id: string            // client uid
  match_id: string
  seq: number
  server: 'A'|'B'
  first_serve_in: boolean|null
  second_serve_in: boolean|null
  rally_len: number|null
  finishing_shot: 'FH'|'BH'|'Volley'|'Overhead'|null
  outcome: 'A'|'B'
  finish_type: 'Winner'|'UE'|'Forced'|'Ace'|'DF'|null
  tags: string[]|null
  created_at?: string
}

// implement these for your storage (Dexie/localStorage, etc.)
async function readOutbox(wsId: string): Promise<OutboxPoint[]> { return (window as any).__outbox?.read(wsId) ?? [] }
async function removeFromOutbox(wsId: string, ids: string[]) { return (window as any).__outbox?.remove(wsId, ids) }
async function markAsSynced(wsId: string, ids: string[]) { return removeFromOutbox(wsId, ids) }

export async function runSync(wsId: string) {
  const batch = await readOutbox(wsId)
  if (!batch || batch.length === 0) return

  // Defensive: collapse exact duplicates in the batch (same match_id+seq); keep last
  const map = new Map<string, OutboxPoint>()
  for (const p of batch) map.set(`${p.match_id}:${p.seq}`, p)
  const deduped = Array.from(map.values())

  // UPSERT → idempotent on (match_id,seq)
  const { error } = await supabase!
    .from('points')
    .upsert(deduped, { onConflict: 'match_id,seq' })
    .select('match_id, seq')

  if (!error) {
    await markAsSynced(wsId, deduped.map(p => p.id))
    return
  }

  // If we still got 23505 here, something else is off — log it
  console.error('sync upsert error', error)

  // Optional: treat 23505 duplicate as success (server already has it)
  if ((error as any)?.code === '23505') {
    await markAsSynced(wsId, deduped.map(p => p.id))
  }
}
