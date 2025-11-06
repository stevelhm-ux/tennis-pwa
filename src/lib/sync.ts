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
  const map = new Map<string, OutboxPoint>()
  for (const p of chunk) {
    if (!validRow(p)) continue
    map.set(keyFor(p), p)
  }
  const batch = Array.from(map.values())
  if (!batch.length) return { okKeys: new Set<string>(), err: null as any }

  const { data, error } = await supabase
    .from('points')
    .upsert(batch, { onConflict: 'match_id,seq' })
    .select('match_id, seq')

  if (error) return { okKeys: new Set<string>(), err: error }

  const okKeys = new Set<string>((data || []).map((r: any) => keyFor(r)))
  return { okKeys, err: null }
}

export async function runSync(wsId: string) {
  const box = getOutbox()
  if (!box) return

  const pending = await box.read(wsId, 200)
  if (!pending?.length) return

  // Auto-purge invalid rows so 22P02 can’t loop
  const invalidIds = pending.filter(p => !validRow(p)).map(p => p.id)
  if (invalidIds.length) await box.remove(wsId, invalidIds)

  const clean = pending.filter(p => validRow(p))
  if (!clean.length) return

  const chunkSize = 50
  const toRemoveIds: string[] = []

  for (let i = 0; i < clean.length; i += chunkSize) {
    const slice = clean.slice(i, i + chunkSize)
    const { okKeys, err } = await upsertChunk(slice)

    if (err) {
      console.warn('runSync chunk error; keeping items for retry', err)
      continue
    }

    for (const p of slice) {
      if (okKeys.has(keyFor(p))) toRemoveIds.push(p.id)
    }
  }

  if (toRemoveIds.length) {
    await box.remove(wsId, toRemoveIds)
  }
}

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
  w.runSyncNow = () => runSync(wsId)
}

export function stopSync() {
  const w = window as any
  if (w.__syncTimer) {
    clearInterval(w.__syncTimer as number)
    w.__syncTimer = null
    w.__syncWsId = null
  }
}
