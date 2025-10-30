import React from 'react'
export function ScoreBar({ setsA, setsB, gamesA, gamesB, pointText, server }:{setsA:number;setsB:number;gamesA:number;gamesB:number;pointText:string;server:'A'|'B'}){
  return (
    <div className="w-full bg-white shadow flex items-center justify-between p-3 rounded-xl">
      <div className="text-sm"><div className="font-semibold">Player A {server==='A' && '🎾'}</div><div className="text-slate-600">Sets {setsA} • Games {gamesA}</div></div>
      <div className="text-2xl font-bold">{pointText}</div>
      <div className="text-right text-sm"><div className="font-semibold">Player B {server==='B' && '🎾'}</div><div className="text-slate-600">Sets {setsB} • Games {gamesB}</div></div>
    </div>
  )
}
