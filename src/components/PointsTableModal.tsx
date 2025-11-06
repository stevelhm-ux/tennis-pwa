import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Point } from '@/lib/types'

export default function PointsTableModal({ matchId, open, onClose }:{
  matchId: string, open: boolean, onClose: ()=>void
}) {
  const [rows, setRows] = useState<Point[]>([])

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const { data, error } = await supabase!
        .from('points')
        .select('*')
        .eq('match_id', matchId)
        .is('deleted_at', null)
        .order('seq', { ascending: false }) // latest on top
      if (error) { console.error(error); setRows([]) } else setRows(data as Point[])
    })()
  }, [open, matchId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold">Points (latest first)</div>
          <button className="text-sm px-3 py-1 rounded border" onClick={onClose}>Close</button>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="[&>th]:px-2 [&>th]:py-2 text-left">
                <th>#</th><th>Srv/Ret</th><th>Won/Lost</th><th>1st In</th><th>2nd In</th>
                <th>Finish Shot</th><th>Finish Type</th><th>Tags</th><th>Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const isServe = p.server === 'A'
                const won = p.outcome === 'A'
                return (
                  <tr key={`${p.match_id}-${p.seq}`}
                      className={
                        (isServe ? 'bg-white' : 'bg-slate-50') + ' ' +
                        (won ? '' : '')
                      }>
                    <td className="px-2 py-1">{p.seq}</td>
                    <td className="px-2 py-1">{isServe ? 'Serve' : 'Return'}</td>
                    <td className={`px-2 py-1 font-medium ${won?'text-emerald-700':'text-rose-700'}`}>{won?'Won':'Lost'}</td>
                    <td className="px-2 py-1">{p.first_serve_in === true ? 'Y' : p.first_serve_in === false ? 'N' : ''}</td>
                    <td className="px-2 py-1">{p.second_serve_in === true ? 'Y' : p.second_serve_in === false ? 'N' : ''}</td>
                    <td className="px-2 py-1">{p.finishing_shot || ''}</td>
                    <td className="px-2 py-1">{p.finish_type || ''}</td>
                    <td className="px-2 py-1">{Array.isArray(p.tags) ? p.tags.join(' | ') : ''}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{p.created_at ? new Date(p.created_at).toLocaleTimeString() : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
