import React from 'react'
import type { AB, FinishType } from '@/lib/types'
import { useMatchStore } from '@/store/useMatchStore'

export function PointPad() {
  const server = useMatchStore(s => s.server)
  const addPoint = useMatchStore(s => s.addPoint)
  const undo = useMatchStore(s => s.undo)

  function quickAdd(outcome: AB, finish: FinishType) {
    const isDF = finish === 'DF'
    addPoint({
      server,
      first_serve_in: isDF ? false : true,
      second_serve_in: isDF ? false : null,
      rally_len: isDF ? 0 : 1,
      finishing_shot: 'Serve',
      outcome,
      finish_type: finish,
      tags: []
    })
  }

  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      <button className="p-4 rounded-2xl text-white bg-emerald-500 active:scale-95" onClick={() => quickAdd('A','Ace')}>Ace (A)</button>
      <button className="p-4 rounded-2xl text-white bg-rose-500 active:scale-95" onClick={() => quickAdd('B','DF')}>Double Fault (B)</button>
      <button className="p-4 rounded-2xl bg-white border active:scale-95"
        onClick={() => addPoint({ server, first_serve_in: true, second_serve_in: null, rally_len: 4, finishing_shot: 'FH', outcome: 'A', finish_type: 'Winner', tags: [] })}>
        FH Winner (A)</button>
      <button className="p-4 rounded-2xl bg-white border active:scale-95"
        onClick={() => addPoint({ server, first_serve_in: true, second_serve_in: null, rally_len: 4, finishing_shot: 'BH', outcome: 'B', finish_type: 'UE', tags: [] })}>
        BH UE (B)</button>
      <button className="col-span-2 p-4 rounded-2xl bg-slate-100 active:scale-95" onClick={() => undo()}>Undo</button>
    </div>
  )
}
