// src/components/PerformancePad.tsx
import React, { useState } from 'react'
import type { AB } from '@/lib/types'
import { useMatchStore } from '@/store/useMatchStore'

type Mode = 'Serve' | 'Return'
type ServeChoice = 'FirstIn' | 'SecondIn' | 'DF' | null
type ReturnChoice = 'ReturnOK' | 'ReturnNOK' | 'OppDF' | null
type EndWin = 'FH Winner' | 'BH Winner' | 'Net Won' | 'Rally Won' | 'Opp Error' | null
type EndLose = 'FH error' | 'BH error' | 'Opp Winner' | 'Net error' | null
type Area = 'Attack' | 'Defence' | 'Serve' | 'Footwork' | 'Approach' | 'Creativity' | 'Position'

const ALL_AREAS: Area[] = ['Attack','Defence','Serve','Footwork','Approach','Creativity','Position']

export default function PerformancePad() {
  const addPoint = useMatchStore(s => s.addPoint)
  const undo = useMatchStore(s => s.undo)

  const [mode, setMode] = useState<Mode>('Serve')
  const [serveChoice, setServeChoice] = useState<ServeChoice>(null)
  const [returnChoice, setReturnChoice] = useState<ReturnChoice>(null)
  const [endWin, setEndWin] = useState<EndWin>(null)
  const [endLose, setEndLose] = useState<EndLose>(null)
  const [doneWell, setDoneWell] = useState<Set<Area>>(new Set())
  const [toImprove, setToImprove] = useState<Set<Area>>(new Set())

  function toggleArea(which: 'well'|'improve', a: Area){
    const s = new Set(which==='well' ? doneWell : toImprove)
    if (s.has(a)) s.delete(a); else s.add(a)
    which==='well' ? setDoneWell(s) : setToImprove(s)
  }

  function resetUI(){
    setServeChoice(null)
    setReturnChoice(null)
    setEndWin(null)
    setEndLose(null)
    setDoneWell(new Set())
    setToImprove(new Set())
  }

  function buildTags(outcome: AB): string[] {
    const tags: string[] = []
    if (mode==='Serve' && serveChoice) tags.push(`Serve:${serveChoice}`)
    if (mode==='Return' && returnChoice) tags.push(`Return:${returnChoice}`)
    if (endWin && outcome==='A') tags.push(`End:${endWin}`)
    if (endLose && outcome==='B') tags.push(`End:${endLose}`)
    if (doneWell.size) tags.push(...Array.from(doneWell).map(a=>`Well:${a}`))
    if (toImprove.size) tags.push(...Array.from(toImprove).map(a=>`Improve:${a}`))
    return tags
  }

  function resolveFinishShot(): 'FH'|'BH'|'Volley'|'Overhead'|null {
    if (endWin==='FH Winner' || endLose==='FH error') return 'FH'
    if (endWin==='BH Winner' || endLose==='BH error') return 'BH'
    if (endWin==='Net Won' || endLose==='Net error') return 'Volley'
    return null
  }

  function resolveFinishType(outcome: AB): 'Winner'|'UE'|'Forced'|'Ace'|'DF' {
    if (mode==='Serve' && serveChoice==='DF') return 'DF'
    if (mode==='Return' && returnChoice==='OppDF') return 'DF'
    if (outcome==='A') {
      if (endWin==='FH Winner' || endWin==='BH Winner' || endWin==='Net Won' || endWin==='Rally Won') return 'Winner'
      if (endWin==='Opp Error') return 'Forced'
    } else {
      if (endLose==='Opp Winner') return 'Winner'
      if (endLose==='FH error' || endLose==='BH error' || endLose==='Net error') return 'UE'
    }
    return 'Forced'
  }

  function buildServeFlags(){
    let first: boolean|null = null
    let second: boolean|null = null
    if (mode==='Serve') {
      if (serveChoice==='FirstIn') { first = true;  second = null }
      if (serveChoice==='SecondIn'){ first = false; second = true }
      if (serveChoice==='DF')      { first = false; second = false }
    } else if (mode==='Return') {
      if (returnChoice==='OppDF')  { first = false; second = false }
    }
    return { first_serve_in: first, second_serve_in: second }
  }

  async function commit(outcome: AB){
    const tags = buildTags(outcome)
    const finishing_shot = resolveFinishShot()
    const finish_type = resolveFinishType(outcome)
    const { first_serve_in, second_serve_in } = buildServeFlags()
    const server: AB = (mode==='Serve') ? 'A' : 'B'

    await addPoint({
      server,
      first_serve_in,
      second_serve_in,
      rally_len: null as any,
      finishing_shot,
      outcome,
      finish_type,
      tags
    })
    resetUI()
  }

  return (
    <div className="grid gap-4 mt-4">
      {/* Area 1: Point Type */}
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Point Type</div>
          <div className="flex gap-2">
            <Toggle
              label="Serve Game"
              active={mode==='Serve'}
              onClick={()=>{ setMode('Serve'); setReturnChoice(null) }}
              color="neutral"
            />
            <Toggle
              label="Return Game"
              active={mode==='Return'}
              onClick={()=>{ setMode('Return'); setServeChoice(null) }}
              color="neutral"
            />
          </div>
        </div>

        {/* Sub-options */}
        {mode==='Serve' ? (
          <div className="grid grid-cols-3 gap-2">
            <Toggle label="First Serve In"  active={serveChoice==='FirstIn'}  onClick={()=>setServeChoice(serveChoice==='FirstIn'?null:'FirstIn')}  color="indigo" />
            <Toggle label="Second Serve In" active={serveChoice==='SecondIn'} onClick={()=>setServeChoice(serveChoice==='SecondIn'?null:'SecondIn')} color="sky" />
            <Toggle label="Double Fault"    active={serveChoice==='DF'}       onClick={()=>setServeChoice(serveChoice==='DF'?null:'DF')}          color="rose" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Toggle label="Return OK"       active={returnChoice==='ReturnOK'}  onClick={()=>setReturnChoice(returnChoice==='ReturnOK'?null:'ReturnOK')}  color="emerald" />
            <Toggle label="Return NOK"      active={returnChoice==='ReturnNOK'} onClick={()=>setReturnChoice(returnChoice==='ReturnNOK'?null:'ReturnNOK')} color="amber" />
            <Toggle label="Opp Double Fault"active={returnChoice==='OppDF'}     onClick={()=>setReturnChoice(returnChoice==='OppDF'?null:'OppDF')}        color="rose" />
          </div>
        )}
      </Card>

      {/* Area 2: How the point ended */}
      <Card className="p-3">
        <div className="font-medium mb-2">How the point ended</div>
        <div className="text-xs text-slate-500 mb-2">Pick one (win or lose). It’s okay to leave blank.</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {(['FH Winner','BH Winner','Net Won','Rally Won','Opp Error'] as EndWin[]).map(l => (
            <Toggle
              key={l}
              label={l}
              active={endWin===l}
              onClick={()=>{ setEndWin(endWin===l?null:l); setEndLose(null) }}
              color="emerald"
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['FH error','BH error','Opp Winner','Net error'] as EndLose[]).map(l => (
            <Toggle
              key={l}
              label={l}
              active={endLose===l}
              onClick={()=>{ setEndLose(endLose===l?null:l); setEndWin(null) }}
              color="rose"
            />
          ))}
        </div>
      </Card>

      {/* Area 3: Areas Done Well */}
      <Card className="p-3">
        <div className="font-medium mb-2">Areas Done Well</div>
        <div className="grid grid-cols-3 gap-2">
          {ALL_AREAS.map(a => (
            <Toggle key={a} label={a} active={doneWell.has(a)} onClick={()=>toggleArea('well', a)} color="slate" />
          ))}
        </div>
      </Card>

      {/* Area 4: Areas to Improve */}
      <Card className="p-3">
        <div className="font-medium mb-2">Areas to Improve</div>
        <div className="grid grid-cols-3 gap-2">
          {ALL_AREAS.map(a => (
            <Toggle key={a} label={a} active={toImprove.has(a)} onClick={()=>toggleArea('improve', a)} color="orange" />
          ))}
        </div>
      </Card>

      {/* Bottom controls */}
      <div className="grid grid-cols-2 gap-3">
        <button
          className="p-4 rounded-2xl text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          onClick={()=>commit('A')}
        >
          Point Won
        </button>
        <button
          className="p-4 rounded-2xl text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
          onClick={()=>commit('B')}
        >
          Point Lost
        </button>
        <button
          className="col-span-2 p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
          onClick={()=>undo()}
        >
          Undo
        </button>
      </div>
    </div>
  )
}

/* ----------------------------- UI helpers ----------------------------- */

function Card({children, className='' }:{children:React.ReactNode; className?:string}) {
  return <div className={`bg-white border rounded-2xl shadow-sm ${className}`} children={children} />
}

type ToggleColor =
  | 'neutral'   // for Serve/Return selector
  | 'emerald'   // wins
  | 'rose'      // errors / DF / losses
  | 'slate'     // areas done well
  | 'orange'    // areas to improve
  | 'indigo'    // 1st serve in
  | 'sky'       // 2nd serve in
  | 'amber'     // return NOK

function Toggle({ label, active, onClick, color }:{
  label:string; active:boolean; onClick:()=>void; color: ToggleColor
}) {
  const palette: Record<ToggleColor, {base:string; active:string; ring:string; textActive?:string}> = {
    neutral:{ base:'border bg-white', active:'bg-slate-900 text-white', ring:'ring-slate-400/60' },
    emerald:{ base:'border bg-white', active:'bg-emerald-600 text-white', ring:'ring-emerald-500/60' },
    rose   :{ base:'border bg-white', active:'bg-rose-600 text-white',    ring:'ring-rose-500/60' },
    slate  :{ base:'border bg-white', active:'bg-slate-700 text-white',   ring:'ring-slate-500/60' },
    orange :{ base:'border bg-white', active:'bg-orange-500 text-white',  ring:'ring-orange-500/60' },
    indigo :{ base:'border bg-white', active:'bg-indigo-600 text-white',  ring:'ring-indigo-500/60' },
    sky    :{ base:'border bg-white', active:'bg-sky-600 text-white',     ring:'ring-sky-500/60' },
    amber  :{ base:'border bg-white', active:'bg-amber-500 text-white',   ring:'ring-amber-500/60' },
  }
  const p = palette[color]
  return (
    <button
      type="button"
      aria-pressed={active}
      className={[
        'px-3 py-2 rounded-xl text-sm transition select-none',
        'focus:outline-none focus-visible:ring-2',
        active ? p.active : `${p.base} hover:bg-slate-50`,
        p.ring
      ].join(' ')}
      onClick={onClick}
      title={label}
    >
      {label}
    </button>
  )
}
