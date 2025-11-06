// src/lib/sync.ts
// Idempotent background sync for points outbox -> Supabase
// - UPSERT on (match_id, seq) so retries are safe
// - Dedupes a batch by (match_id,seq)
// - Removes ONLY rows that actually succeeded server-side
// - Auto-purges invalid outbox rows (non-UUID match_id, bad seq)
// - Single global timer guard

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

type OutboxAPI = {
  read: (wsId: string, limit?: number) => Promise<OutboxPoint[]>
  remove: (wsId: string, ids: string[]) => Promise<void>
  size?: (wsId: string) => Promise<number>
  clear?: (wsId: string) => Promise<void>
}

function getOutbox(): OutboxAPI | null {
  const box = (window as any).__outbox
  if (!box?.read || !box?.remove) return null
  return box as OutboxAPI
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validRow(p: { match_id: string; seq: number }) {
  return UUID_RE.test(p.match_id) && Number.isInteger(p.seq) && p.seq > 0
}

function keyFor(p: { match_id: string; seq: number }) {
  return `${p.match_id}:${p.seq}`
}

async function upsertChunk(chunk: OutboxPoint[]) {
  // Defensive: sanitize and dedupe this chunk
  const map = new Map<string, OutboxPoint>()
  for (const p of chunk) {
    if (!validRow(p)) continue
    map.set(keyFor(p), p)
  }
  const batch = Array.from(map.values())
  if (batch.length === 0) return { okKeys: new Set<string>(), err: null as any }

  const { data, error } = await supabase
    .from('points')
    .upsert(batch, { onConflict: 'match_id,seq' })
    .select('match_id, seq') // ← return only successful rows

  if (error) {
    return { okKeys: new Set<string>(), err: error }
  }

  const okKeys = new Set<string>((data || []).map((r: any) => keyFor(r)))
  return { okKeys, err: null }
}

/**
 * Only remove from outbox the rows that actually succeeded (present in upsert SELECT).
 * Purges invalid rows before attempting upsert (prevents 22P02 loops).
 */
export async function runSync(wsId: string) {
  const box = getOutbox()
  if (!box) return

  const pending = await box.read(wsId, 200)
  if (!pending?.length) return

  // Auto-purge invalid items (non-UUID match_id, bad seq)
  const invalidIds = pending.filter(p => !validRow(p)).map(p => p.id)
  if (invalidIds.length) {
    await box.remove(wsId, invalidIds)
  }

  const clean = pending.filter(p => validRow(p))
  if (!clean.length) return

  // Process in small chunks so partial failures are isolated
  const chunkSize = 50
  const toRemoveIds: string[] = []

  for (let i = 0; i < clean.length; i += chunkSize) {
    const slice = clean.slice(i, i + chunkSize)
    const { okKeys, err } = await upsertChunk(slice)

    if (err) {
      // Auth (401/403) or RLS (42501) — keep items for later retry
      // 23505 shouldn't appear with upsert; if it does, keep items and retry later
      console.warn('runSync chunk error; keeping items for retry', err)
      continue
    }

    // SUCCESS PATH: remove only the items that actually succeeded
    for (const p of slice) {
      if (okKeys.has(keyFor(p))) {
        toRemoveIds.push(p.id)
      }
    }
  }

  if (toRemoveIds.length) {
    await box.remove(wsId, toRemoveIds)
  }
}

/** Starts a single global sync timer (guarded). */
export function startSync(wsId: string, intervalMs = 5000) {
  const w = window as any
  if (w.__syncTimer && w.__syncWsId === wsId) return

  if (w.__syncTimer) {
    clearInterval(w.__syncTimer as number)
    w.__syncTimer = null
  }

  w.__syncWsId = wsId
  w.__syncTimer = setInterval(() => {
    runSync(wsId).catch((e) => console.error('sync loop error', e))
  }, Math.max(2000, intervalMs))

  // optional debug helper
  w.runSyncNow = () => runSync(wsId)
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
