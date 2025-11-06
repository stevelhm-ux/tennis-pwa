// src/lib/outbox.ts
import type { OutboxPoint } from '@/lib/sync'

const KEY = (wsId: string) => `tt-outbox:${wsId}`

function load(wsId: string): OutboxPoint[] {
  try {
    const raw = localStorage.getItem(KEY(wsId))
    return raw ? (JSON.parse(raw) as OutboxPoint[]) : []
  } catch {
    return []
  }
}
function save(wsId: string, rows: OutboxPoint[]) {
  localStorage.setItem(KEY(wsId), JSON.stringify(rows))
}

export const outbox = {
  async read(wsId: string, limit = 200): Promise<OutboxPoint[]> {
    return load(wsId).slice(0, limit)
  },
  async append(wsId: string, row: OutboxPoint): Promise<void> {
    const arr = load(wsId)
    arr.push(row)
    save(wsId, arr)
  },
  async remove(wsId: string, ids: string[]): Promise<void> {
    const set = new Set(ids)
    const arr = load(wsId).filter(r => !set.has(r.id))
    save(wsId, arr)
  },
  async size(wsId: string): Promise<number> {
    return load(wsId).length
  },
  async clear(wsId: string): Promise<void> {
    localStorage.removeItem(KEY(wsId))
  },
}
