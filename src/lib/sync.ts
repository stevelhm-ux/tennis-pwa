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
  // Dedupe + validate
  const map = new Map<string, OutboxPoint>()
  const invalid: OutboxPoint[] = []
  for (const p of chunk) {
    if (!validRow(p)) invalid.push(p)
    else map.set(keyFor(p), p)
  }

  if (invalid.length) {
    console.warn(
      `sync: skipping ${invalid.length} invalid row(s) (non-UUID or bad seq). Sample:`,
      invalid.slice(0, 3).map(x => ({ id: x.id, match_id: x.match_id, seq: x.seq }))
    )
  }

  const batch = Array.from(map.values())
  if (!batch.length) return { okKeys: new Set<string>(), err: null as any }

  // Log first few rows we are actually sending
  console.info(
    `sync: upserting ${batch.length} point(s). Sample:`,
    batch.slice(0, 3).map(x => ({ match_id: x.match_id, seq: x.seq }))
  )

  const { data, error } = await supabase
    .from('points')
    .upsert(batch, { onConflict: 'match_id,seq' })
    .select('match_id, seq')

  if (error) {
    // On error, also print the attempted payload to pinpoint the bad row server-side
    console.error('sync: upsert error', error, {
      samplePayload: batch.slice(0, 3).map(x => ({ match_id: x.match_id, seq: x.seq })),
    })
    return { okKeys: new Set<string>(), err: error }
  }

  const okKeys = new Set<string>((data || []).map((r: any) => keyFor(r)))
  return { okKeys, err: null }
}

export async function runSync(wsId: string) {
  const box = getOutbox()
  if (!box) return

  const pending = await box.read(wsId, 200)
  if (!pending?.length) return

  // Purge invalid rows upfront (so they never hit the server)
  const invalid = pending.filter(p => !validRow(p))
  if (invalid.length) {
    console.info(`sync: purging ${invalid.length} invalid outbox item(s) before upsert`)
    await box.remove(wsId, invalid.map(p => p.id))
  }

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
    console.info(`sync: removed ${toRemoveIds.length} delivered outbox item(s)`)
  }
}

export function startSync(wsId: string, intervalMs = 5000) {
  const w = window as any
  if (w.__syncTimer && w.__syncWsId === wsId) return
  if (w.__syncTimer) {
    clearInterval(w.__syncTimer as number)
    w.__syncTimer = null
  }
  w.__wsId = wsId
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
