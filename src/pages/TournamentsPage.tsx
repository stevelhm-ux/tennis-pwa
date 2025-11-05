// src/pages/TournamentsPage.tsx
import React, { useEffect, useState } from 'react'
import TournamentPicker from '@/components/TournamentPicker'
import { Header } from '@/components/Header'
import { ensureWorkspace } from '@/bootstrap'
import type { Tournament } from '@/lib/types'
import { getMyPlayer, setMyPlayerByName } from '@/lib/prefs'
import { exportWorkspaceCsv } from '@/lib/exportCsv'

export default function TournamentsPage({
  onEnterTournament,
}: {
  onEnterTournament: (t: Tournament, wsId: string) => void
}) {
  const [wsId, setWsId] = useState<string | null>(null)
  const [myPlayerName, setMyPlayerName] = useState<string>('')
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')

  useEffect(() => {
    (async () => {
      const id = await ensureWorkspace()
      setWsId(id)
      try {
        const p = await getMyPlayer(id)
        if (p) {
          setMyPlayerName(p.name)
          setInputVal(p.name)
        } else {
          const legacy = (localStorage.getItem('my_player_name') || '').trim()
          if (legacy) {
            setMyPlayerName(legacy)
            setInputVal(legacy)
          }
        }
      } catch (e) {
        console.error(e)
      }
    })().catch(console.error)
  }, [])

  async function saveMyName() {
    if (!wsId) return
    if (!inputVal.trim()) {
      alert('Enter a name')
      return
    }
    const p = await setMyPlayerByName(wsId, inputVal.trim())
    setMyPlayerName(p.name)
    setEditing(false)
  }

  // One-click local reset (IndexedDB + caches + SW + localStorage)
  async function resetLocal() {
    // stop any custom sync loop you exposed (optional)
    ;(window as any).__stopSync?.()

    // try to close Dexie DB if you use it
    const w = window as any
    if (w.db?.close) w.db.close()
    if (w.Dexie?.delete) {
      try {
        await w.Dexie.delete('tennis-tracker')
      } catch {
        // ignore
      }
    }

    // delete all IndexedDB databases (best-effort)
    if ('indexedDB' in window) {
      try {
        const anyIDB = indexedDB as any
        if (anyIDB.databases) {
          const dbs: { name?: string }[] = await anyIDB.databases()
          for (const d of dbs) {
            if (!d?.name) continue
            await new Promise<void>((res) => {
              const req = indexedDB.deleteDatabase(d.name as string)
              req.onblocked = req.onerror = req.onsuccess = () => res()
            })
          }
        } else {
          // fallback: delete by common names you’ve used
          ;['tennis-tracker', 'tt-store'].forEach((name) => {
            const req = indexedDB.deleteDatabase(name)
            req.onblocked = req.onerror = req.onsuccess = () => {}
          })
        }
      } catch {
        // ignore
      }
    }

    // clear runtime caches
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // ignore
    }

    // localStorage
    try {
      localStorage.clear()
    } catch {
      // ignore
    }

    // unregister SW so it can’t reopen caches/IDB immediately
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch {
      // ignore
    }

    // hard reload
    location.replace('/')
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <Header title="Tennis Tracker" />

      {/* Top actions */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="text-xs text-slate-500 truncate">Workspace: {wsId?.slice(0, 8)}…</div>
        <div className="flex items-center gap-2">
          {wsId && (
            <button
              onClick={() => exportWorkspaceCsv(wsId)}
              className="px-3 py-1 rounded-lg border bg-white text-sm hover:bg-slate-50"
            >
              Export All CSV
            </button>
          )}
          <button
            onClick={resetLocal}
            className="px-3 py-1 rounded-lg border bg-white text-sm hover:bg-rose-50"
            title="Clear local storage, caches, and service worker"
          >
            Reset local data
          </button>
        </div>
      </div>

      {/* My Player card */}
      <div className="mb-4 bg-white border rounded-2xl p-3">
        <div className="font-medium mb-2">My Player</div>
        {!editing ? (
          <div className="flex items-center justify-between">
            <div className="text-sm">{myPlayerName || '— not set —'}</div>
            <button
              className="px-3 py-1 rounded-lg border bg-slate-50 hover:bg-slate-100 text-sm"
              onClick={() => setEditing(true)}
            >
              Update
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              className="border rounded px-3 py-2 flex-1"
              placeholder="Your player's name"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
            <button onClick={saveMyName} className="px-3 py-2 rounded bg-slate-900 text-white">
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setInputVal(myPlayerName)
              }}
              className="px-3 py-2 rounded border"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {wsId ? (
        <TournamentPicker workspaceId={wsId} onSelected={(t) => onEnterTournament(t, wsId)} />
      ) : (
        <div>Preparing workspace…</div>
      )}
    </div>
  )
}
