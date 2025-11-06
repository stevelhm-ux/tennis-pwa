// src/lib/sync.ts
import { supabase } from '@/lib/supabase'

type AB = 'A' | 'B'
export type OutboxPoint = {
  id: string
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
}

function getOutbox(): OutboxAPI | null {
  const box = (window as any).__outbox
  if (!box?.read || !box?.remove) return null
  return box as OutboxAPI
}

function keyFor(p: Pick<OutboxPoint, 'match_id' | 'seq'>) {
  return `${p.match_id}:${p.seq}`
}

async function upsertChunk(chunk: OutboxPoint[]) {
  // Defensive: sanitize and dedupe this chunk
  const map = new Map<string, OutboxPoint>()
  for (const p of chunk) {
    if (!p?.match_id || typeof p.seq !== 'number') continue
    map.set(keyFor(p), p)
  }
  const batch = Array.from(map.values())
  if (batch.length === 0) return { okKeys: new Set<string>(), err: null as any }

  const { data, error } = await supabase
    .from('points')
    .upsert(batch, { onConflict: 'match_id,seq' })
    .select('match_id, seq') // important: get back exactly what succeeded

  if (error) {
    // On true error, nothing to remove at this stage
    return { okKeys: new Set<string>(), err: error }
  }

  const okKeys = new Set<string>((data || []).map((r: any) => keyFor(r)))
  return { okKeys, err: null }
}

/**
 * Only remove from outbox the rows that:
 *  - either were returned by the upsert (success),
 *  - or would be duplicates (conflict) that the server already has.
 *
 * For real errors (401/403/42501/etc.), keep items so they retry later.
 */
export async function runSync(wsId: string) {
  const box = getOutbox()
  if (!box) return

  const pending = await box.read(wsId, 200)
  if (!pending?.length) return

  // Process in small chunks so partial failures are isolated
  const chunkSize = 50
  const toRemoveIds: string[] = []

  for (let i = 0; i < pending.length; i += chunkSize) {
    const slice = pending.slice(i, i + chunkSize)
    const { okKeys, err } = await upsertChunk(slice)

    if (err) {
      // If it's a duplicate-key error (shouldn't happen with upsert, but just in case),
      // treat those keys as successful.
      if ((err as any)?.code === '23505') {
        // keep nothing (unknown which rows succeeded); safer to keep items for retry
        console.warn('runSync duplicate-key error; will retry later', err)
        continue
      }

      // Auth (401/403) or RLS (42501) — keep items for later retry
      console.warn('runSync chunk error; keeping items for retry', err)
      continue
    }

    // SUCCESS PATH: remove only the items that actually succeeded
    const okSet = okKeys
    for (const p of slice) {
      if (okSet.has(keyFor(p))) {
        toRemoveIds.push(p.id)
      }
    }
  }

  if (toRemoveIds.length) {
    await box.remove(wsId, toRemoveIds)
  }
}

/** Single global loop guard */
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
  w.__stopSync = () => {
    if (w.__syncTimer) {
      clearInterval(w.__syncTimer as number)
      w.__syncTimer = null
      w.__syncWsId = null
    }
  }
}
export function stopSync() {
  const w = window as any
  if (w.__syncTimer) {
    clearInterval(w.__syncTimer as number)
    w.__syncTimer = null
    w.__syncWsId = null
  }
}
