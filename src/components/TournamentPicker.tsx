import React, { useEffect, useState } from 'react'
import { listTournaments, createTournament, updateTournament } from '@/lib/tournaments'
import type { Tournament } from '@/lib/types'

export default function TournamentPicker({
  workspaceId,
  onSelected,
}: {
  workspaceId: string
  onSelected: (tournament: Tournament) => void
}) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Tournament[]>([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', venue: '', date: '', grade: 4 as 1|2|3|4|5 })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', venue: '', date: '', grade: 4 as 1|2|3|4|5 })

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
      onSelected(t)
    } finally {
      setCreating(false)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    const t = await updateTournament(editingId, {
      name: editForm.name.trim(),
      venue: editForm.venue || undefined,
      date: editForm.date || undefined,
      grade: editForm.grade,
    })
    setItems(prev => prev.map(x => x.id === t.id ? t : x))
    setEditingId(null)
  }

  if (loading) return <div className="p-4">Loading tournaments…</div>

  return (
    <div className="space-y-4">
      {/* Existing tournaments card */}
      <div className="bg-white border rounded-2xl p-3">
        <h2 className="text-lg font-semibold mb-3">Tournaments</h2>

        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map(t => {
              const isEditing = editingId === t.id
              return (
                <div key={t.id} className="border rounded-xl p-3">
                  {!isEditing ? (
                    <div className="flex items-start justify-between gap-3">
                      <button
                        className="text-left flex-1 hover:opacity-80 active:scale-[0.99]"
                        onClick={() => onSelected(t)}
                      >
                        <div className="font-medium">
                          {t.name} {t.grade ? <span className="text-xs text-slate-500">• G{t.grade}</span> : null}
                        </div>
                        <div className="text-xs text-slate-500">
                          {t.venue || '—'} {t.date ? `• ${t.date}` : ''}
                        </div>
                      </button>
                      {/* 3) Edit button */}
                      <button
                        className="px-3 py-1 text-sm rounded-lg border bg-slate-50 hover:bg-slate-100"
                        onClick={() => { setEditingId(t.id); setEditForm({ name: t.name, venue: t.venue || '', date: t.date || '', grade: (t.grade || 4) as 1|2|3|4|5 }) }}
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={saveEdit} className="grid gap-2">
                      <input className="border rounded px-3 py-2" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} placeholder="Name*" />
                      <input className="border rounded px-3 py-2" value={editForm.venue} onChange={e=>setEditForm({...editForm, venue:e.target.value})} placeholder="Venue" />
                      <input className="border rounded px-3 py-2" type="date" value={editForm.date} onChange={e=>setEditForm({...editForm, date:e.target.value})} />
                      <select className="border rounded px-3 py-2" value={editForm.grade} onChange={e=>setEditForm({...editForm, grade: Number(e.target.value) as 1|2|3|4|5})}>
                        {[1,2,3,4,5].map(g=><option key={g} value={g}>Grade {g}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button className="px-3 py-2 rounded bg-slate-900 text-white">Save</button>
                        <button type="button" className="px-3 py-2 rounded border" onClick={()=>setEditingId(null)}>Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-500">No tournaments yet.</div>
        )}
      </div>

      {/* Create new tournament card (same width styling) */}
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
