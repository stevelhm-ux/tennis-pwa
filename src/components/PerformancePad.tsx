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
    // mode/result tags
    if (mode==='Serve') {
      if (serveChoice) tags.push(`Serve:${serveChoice}`)
    } else {
      if (returnChoice) tags.push(`Return:${returnChoice}`)
    }
    if (endWin && outcome==='A') tags.push(`End:${endWin}`)
    if (endLose && outcome==='B') tags.push(`End:${endLose}`)
    // areas
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
    // DF if chosen in serve mode or OppDF in return mode (regardless of outcome button)
    if (mode==='Serve' && serveChoice==='DF') return 'DF'
    if (mode==='Return' && returnChoice==='OppDF') return 'DF'
    // Winners / Errors based on selected end and outcome
    if (outcome==='A') {
      if (endWin==='FH Winner' || endWin==='BH Winner' || endWin==='Net Won' || endWin==='Rally Won') return 'Winner'
      if (endWin==='Opp Error') return 'Forced'
    } else {
      if (endLose==='Opp Winner') return 'Winner'
      if (endLose==='FH error' || endLose==='BH error' || endLose==='Net error') return 'UE'
    }
    return 'Forced'
  }

  function buildServeFlags(outcome: AB){
    // default: unknown
    let first: boolean|null = null
    let second: boolean|null = null
    if (mode==='Serve') {
      if (serveChoice==='FirstIn') { first = true; second = null }
      else if (serveChoice==='SecondIn') { first = false; second = true }
      else if (serveChoice==='DF') { first = false; second = false }
    } else if (mode==='Return') {
      if (returnChoice==='OppDF') { first = false; second = false }
      // otherwise unknown for opponent serves
    }
    return { first_serve_in: first, second_serve_in: second }
  }

  async function commit(outcome: AB){
    const tags = buildTags(outcome)
    const finishing_shot = resolveFinishShot()
    const finish_type = resolveFinishType(outcome)
    const { first_serve_in, second_serve_in } = buildServeFlags(outcome)

    // server: my Serve -> 'A', Return -> opponent serves -> 'B'
    const server: AB = (mode==='Serve') ? 'A' : 'B'

    await addPoint({
      server,
      first_serve_in,
      second_serve_in,
      rally_len: null as any, // not tracked here
      finishing_shot,
      outcome,
      finish_type,
      tags
    })
    resetUI()
  }

  return (
    <div className="grid gap-4 mt-4">
      {/* Area 1: Serve / Return selection and result */}
      <div className="bg-white border rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Point Type</div>
          <div className="flex gap-2">
            <button className={`px-3 py-1 rounded-lg border ${mode==='Serve'?'bg-slate-900 text-white':'bg-white'}`} onClick={()=>{setMode('Serve'); setReturnChoice(null)}}>Serve Game</button>
            <button className={`px-3 py-1 rounded-lg border ${mode==='Return'?'bg-slate-900 text-white':'bg-white'}`} onClick={()=>{setMode('Return'); setServeChoice(null)}}>Return Game</button>
          </div>
        </div>

        {mode==='Serve' ? (
          <div className="grid grid-cols-3 gap-2">
            <Toggle label="First Serve In" active={serveChoice==='FirstIn'} onClick={()=>setServeChoice(serveChoice==='FirstIn'?null:'FirstIn')} />
            <Toggle label="Second Serve In" active={serveChoice==='SecondIn'} onClick={()=>setServeChoice(serveChoice==='SecondIn'?null:'SecondIn')} />
            <Toggle label="Double Fault" active={serveChoice==='DF'} onClick={()=>setServeChoice(serveChoice==='DF'?null:'DF')} />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Toggle label="Return OK" active={returnChoice==='ReturnOK'} onClick={()=>setReturnChoice(returnChoice==='ReturnOK'?null:'ReturnOK')} />
            <Toggle label="Return NOK" active={returnChoice==='ReturnNOK'} onClick={()=>setReturnChoice(returnChoice==='ReturnNOK'?null:'ReturnNOK')} />
            <Toggle label="Opp Double Fault" active={returnChoice==='OppDF'} onClick={()=>setReturnChoice(returnChoice==='OppDF'?null:'OppDF')} />
          </div>
        )}
      </div>

      {/* Area 2: How the point ended */}
      <div className="bg-white border rounded-2xl p-3">
        <div className="font-medium mb-2">How the point ended</div>
        <div className="text-xs text-slate-500 mb-2">Pick one (win or lose). It’s okay to leave blank.</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {(['FH Winner','BH Winner','Net Won','Rally Won','Opp Error'] as EndWin[]).map(l => (
            <Toggle key={l} label={l} active={endWin===l} onClick={()=>{ setEndWin(endWin===l?null:l); setEndLose(null) }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['FH error','BH error','Opp Winner','Net error'] as EndLose[]).map(l => (
            <Toggle key={l} label={l} active={endLose===l} onClick={()=>{ setEndLose(endLose===l?null:l); setEndWin(null) }} />
          ))}
        </div>
      </div>

      {/* Area 3: Areas Done Well */}
      <div className="bg-white border rounded-2xl p-3">
        <div className="font-medium mb-2">Areas Done Well</div>
        <div className="grid grid-cols-3 gap-2">
          {ALL_AREAS.map(a => (
            <Toggle key={a} label={a} active={doneWell.has(a)} onClick={()=>toggleArea('well', a)} />
          ))}
        </div>
      </div>

      {/* Area 4: Areas to Improve */}
      <div className="bg-white border rounded-2xl p-3">
        <div className="font-medium mb-2">Areas to Improve</div>
        <div className="grid grid-cols-3 gap-2">
          {ALL_AREAS.map(a => (
            <Toggle key={a} label={a} active={toImprove.has(a)} onClick={()=>toggleArea('improve', a)} />
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="grid grid-cols-2 gap-3">
        <button className="p-4 rounded-2xl text-white bg-emerald-600 active:scale-95" onClick={()=>commit('A')}>Point Won</button>
        <button className="p-4 rounded-2xl text-white bg-rose-600 active:scale-95" onClick={()=>commit('B')}>Point Lost</button>
        <button className="col-span-2 p-3 rounded-2xl bg-slate-100 active:scale-95" onClick={()=>undo()}>Undo</button>
      </div>
    </div>
  )
}

function Toggle({label, active, onClick}:{label:string; active:boolean; onClick:()=>void}){
  return (
    <button
      className={`px-3 py-2 rounded-xl border text-sm ${active?'bg-slate-900 text-white':'bg-white hover:bg-slate-50'}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
