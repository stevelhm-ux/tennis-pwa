// src/lib/sync.ts
// Idempotent background sync for points outbox -> Supabase
// - Uses UPSERT on (match_id, seq) so retries are safe
// - Deduplicates a batch by (match_id,seq)
// - Handles common errors (401/403 auth, 42501 RLS, 23505 duplicates)
// - Exposes startSync/stopSync and a single global timer guard

import { supabase } from '@/lib/supabase'

type AB = 'A' | 'B'

export type OutboxPoint = {
  id: string // client uid for outbox row
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

// Minimal outbox API expected on window.__outbox
type OutboxAPI = {
  read: (wsId: string, limit?: number) => Promise<OutboxPoint[]>
  remove: (wsId: string, ids: string[]) => Promise<void>
  size?: (wsId: string) => Promise<number>
}

function getOutbox(): OutboxAPI | null {
  const box = (window as any).__outbox
  if (!box || typeof box.read !== 'function' || typeof box.remove !== 'function') return null
  return box as OutboxAPI
}

/**
 * Flush a batch from the outbox to Supabase.
 * Idempotent via upsert(onConflict: 'match_id,seq').
 */
export async function runSync(wsId: string) {
  const box = getOutbox()
  if (!box) return

  // Read a modest batch to avoid very large payloads
  const pending = await box.read(wsId, 200)
  if (!pending || pending.length === 0) return

  // Collapse duplicates within the same batch by (match_id, seq)
  const map = new Map<string, OutboxPoint>()
  for (const p of pending) {
    // sanitize: ensure seq is an integer and match_id looks non-empty
    if (!p || !p.match_id || typeof p.seq !== 'number') continue
    map.set(`${p.match_id}:${p.seq}`, p)
  }
  const batch = Array.from(map.values())
  if (batch.length === 0) return

  // Push with upsert for idempotency
  const { error } = await supabase
    .from('points')
    .upsert(batch, { onConflict: 'match_id,seq' })
    .select('match_id,seq')

  if (!error) {
    // Success → remove flushed ids from outbox
    await box.remove(wsId, batch.map((p) => p.id))
    return
  }

  // Handle common errors gracefully
  const code = (error as any)?.code
  // 23505: duplicate key (server already has it) -> treat as success and drop from outbox
  if (code === '23505') {
    await box.remove(wsId, batch.map((p) => p.id))
    return
  }

  // 401/403: auth problems – nothing to do here (user must re-auth)
  // 42501: RLS – user not permitted; leave items so they can sync later after membership fix
  // For other errors, log once (debounced by timer frequency)
  console.error('runSync error:', error)
}

/**
 * Starts a single global sync timer. Safe to call multiple times;
 * it won’t create duplicate intervals for the same wsId.
 *
 * Also exposes window.__stopSync() to clear it.
 */
export function startSync(wsId: string, intervalMs = 5000) {
  const w = window as any
  if (w.__syncTimer && w.__syncWsId === wsId) return

  // Clear any previous timer for a different workspace
  if (w.__syncTimer) {
    clearInterval(w.__syncTimer as number)
    w.__syncTimer = null
  }

  w.__syncWsId = wsId
  w.__syncTimer = setInterval(() => {
    runSync(wsId).catch((e) => console.error('sync loop error', e))
  }, Math.max(2000, intervalMs))

  w.__stopSync = () => {
    if (w.__syncTimer) {
      clearInterval(w.__syncTimer as number)
      w.__syncTimer = null
      w.__syncWsId = null
    }
  }
}

/** Stop the current sync loop, if any. */
export function stopSync() {
  const w = window as any
  if (w.__syncTimer) {
    clearInterval(w.__syncTimer as number)
    w.__syncTimer = null
    w.__syncWsId = null
  }
}
