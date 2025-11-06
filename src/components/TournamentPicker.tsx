import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tournament } from '@/lib/types'

const AGE_OPTIONS = ['U8','U9','U10','U11'] as const

export default function TournamentPicker({
  workspaceId,
  onSelected,
}: {
  workspaceId: string
  onSelected: (t: Tournament) => void
}) {
  const [list, setList] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [venue, setVenue] = useState('')
  const [date, setDate] = useState<string>('') // yyyy-mm-dd
  const [grade, setGrade] = useState<number | ''>('')
  const [age, setAge] = useState<string>('U10')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase!
      .from('tournaments')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { console.error(error); setList([]) } else setList(data as Tournament[])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load().catch(console.error) }, [load])

  useEffect(() => {
    const onShow = () => load()
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('pageshow', onShow)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pageshow', onShow)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  useEffect(() => {
    const ch = supabase!
      .channel(`rt-tournaments-${workspaceId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments', filter: `workspace_id=eq.${workspaceId}` },
        () => load())
      .subscribe()
    return () => { supabase!.removeChannel(ch) }
  }, [workspaceId, load])

  async function createTournament(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { alert('Please enter a tournament name'); return }
    const payload: any = {
      workspace_id: workspaceId,
      name: name.trim(),
      venue: venue.trim() || null,
      date: date || null,
      grade: grade === '' ? null : Number(grade),
      age_group: age || null,
    }
    const { error } = await supabase!.from('tournaments').insert(payload)
    if (error) { alert(error.message); return }
    setName(''); setVenue(''); setDate(''); setGrade(''); setAge('U10')
    load()
  }

  function lineInfo(t: Tournament) {
    const bits = [
      t.date ? new Date(t.date).toLocaleDateString() : 'Date TBC',
      t.venue || 'Venue TBC',
      typeof t.grade === 'number' ? `G${t.grade}` : '',
      t.age_group || ''
    ].filter(Boolean)
    return bits.join(' • ')
  }

  return (
    <div className="space-y-3">
      {/* Existing tournaments */}
      <div className="bg-white border rounded-2xl p-3">
        <div className="font-medium mb-2">Tournament List</div>
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : list.length === 0 ? (
          <div className="text-sm text-slate-500">No tournaments yet.</div>
        ) : (
          <div className="space-y-2">
            {list.map(t => (
              <button
                key={t.id}
                onClick={() => onSelected(t)}
                className="w-full text-left bg-white border rounded-xl p-3 hover:bg-slate-50 active:scale-[0.99]"
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-slate-500">{lineInfo(t)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create New Tournament */}
      <div className="bg-white border rounded-2xl p-3">
        <div className="font-medium mb-2">Create New Tournament</div>
        <form onSubmit={createTournament} className="grid gap-2">
          <input className="border rounded px-3 py-2" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Venue" value={venue} onChange={e=>setVenue(e.target.value)} />
          <div className="flex gap-2">
            <input type="date" className="border rounded px-3 py-2 flex-1" value={date} onChange={e=>setDate(e.target.value)} />
            <input type="number" min={1} max={5} className="border rounded px-3 py-2 w-24" placeholder="Grade" value={grade} onChange={e=>setGrade(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-slate-600">Age group</label>
            <select className="border rounded px-3 py-2 w-full" value={age} onChange={e=>setAge(e.target.value)}>
              {AGE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button className="px-3 py-2 rounded bg-slate-900 text-white">Create</button>
        </form>
      </div>
    </div>
  )
}
