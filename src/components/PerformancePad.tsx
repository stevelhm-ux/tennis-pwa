// src/components/PerformancePad.tsx
import React from 'react'
import { useMatchStore } from '@/store/useMatchStore'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function PerformancePad() {
  const matchId = useMatchStore(s => s.matchId)
  const addPoint = useMatchStore(s => s.addPoint)

  const disabled = !matchId || !UUID_RE.test(matchId)

  function clickWon() {
    if (disabled) {
      alert('Match isn’t ready yet. Please go back and re-open it.')
      return
    }
    addPoint({
      server: 'A',
      first_serve_in: null,
      second_serve_in: null,
      rally_len: null,
      finishing_shot: null,
      outcome: 'A',
      finish_type: null,
      tags: null,
    })
  }

  function clickLost() {
    if (disabled) {
      alert('Match isn’t ready yet. Please go back and re-open it.')
      return
    }
    addPoint({
      server: 'A',
      first_serve_in: null,
      second_serve_in: null,
      rally_len: null,
      finishing_shot: null,
      outcome: 'B',
      finish_type: null,
      tags: null,
    })
  }

  return (
    <div className="rounded-2xl border p-3 bg-white shadow-sm">
      <div className="text-sm font-medium mb-2">Performance Pad</div>
      <div className="grid grid-cols-2 gap-3">
        <button
          className="px-3 py-4 rounded-xl border text-lg font-semibold hover:bg-slate-50 disabled:opacity-50"
          onClick={clickWon}
          disabled={disabled}
        >
          Point Won
        </button>
        <button
          className="px-3 py-4 rounded-xl border text-lg font-semibold hover:bg-slate-50 disabled:opacity-50"
          onClick={clickLost}
          disabled={disabled}
        >
          Point Lost
        </button>
      </div>
      {disabled && (
        <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          This match isn’t ready. Open it from the Matches list again.
        </div>
      )}
    </div>
  )
}
