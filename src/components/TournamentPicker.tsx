import React, { useEffect, useState } from 'react'
import { listTournaments, createTournament } from '@/lib/tournaments'
import type { Tournament } from '@/lib/types'

export default function TournamentPicker({
  workspaceId,
  onSelected,
}: {
  workspaceId: string
  onSelected: (tournamentId: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Tournament[]>([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', venue: '', date: '', grade: 4 as 1|2|3|4|5 })

  async function refresh() {
    setLoading(true)
    try { setItems(await listTournaments(workspaceId)) }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [workspaceId])

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const t = await createTournament(workspaceId, {
        name: form.name.trim(),
        venue: form.venue || undefined,
        date: form.date || undefined,
        grade: form.grade,
      })
      setItems([t, ...items])
      onSelected(t.id)
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <div className="p-4">Loading tournaments…</div>

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-lg font-semibold mb-3">Select Tournament</h2>

      {items.length > 0 && (
        <div className="space-y-2 mb-4">
          {items.map(t => (
            <button
              key={t.id}
              className="w-full text-left bg-white border rounded-xl p-3 hover:bg-slate-50 active:scale-[0.99]"
              onClick={() => onSelected(t.id)}
            >
              <div className="font-medium">{t.name} {t.grade ? <span className="text-xs text-slate-500">• G{t.grade}</span> : null}</div>
              <div className="text-xs text-slate-500">
                {t.venue || '—'} {t.date ? `• ${t.date}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border rounded-2xl p-3">
        <div className="font-medium mb-2">Create New</div>
        <form onSubmit={submitCreate} className="grid gap-2">
          <input className="border rounded px-3 py-2" placeholder="Name*" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
          <input className="border rounded px-3 py-2" placeholder="Venue" value={form.venue} onChange={e=>setForm({...form, venue:e.target.value})}/>
          <input className="border rounded px-3 py-2" type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/>
          <select className="border rounded px-3 py-2" value={form.grade} onChange={e=>setForm({...form, grade: Number(e.target.value) as 1|2|3|4|5})}>
            {[1,2,3,4,5].map(g=><option key={g} value={g}>Grade {g}</option>)}
          </select>
          <button disabled={creating} className="bg-black text-white rounded px-3 py-2">{creating?'Creating…':'Create & Use'}</button>
        </form>
      </div>
    </div>
  )
}
