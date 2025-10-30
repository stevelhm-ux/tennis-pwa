import type { Point } from './types'

export interface LiveScore {
  gamesA: number; gamesB: number; setsA: number; setsB: number;
  pointText: string; server: 'A'|'B'
}
const pointToTennis = (pts: number) => (pts===0?'0':pts===1?'15':pts===2?'30':'40')

export function computeLiveScore(points: Point[], bestOf: 3|5 = 3): LiveScore {
  let gA=0,gB=0,sA=0,sB=0,pA=0,pB=0
  let server: 'A'|'B' = points[0]?.server ?? 'A'
  for (const p of points) {
    server = p.server
    if (p.outcome==='A') pA++; else pB++;
    if (pA>=4 || pB>=4) {
      if (pA===pB) {} else if (Math.abs(pA-pB)>=2) { if (pA>pB) gA++; else gB++; pA=0;pB=0 }
    } else if ((pA>=4 && pA-pB>=2) || (pB>=4 && pB-pA>=2)) {
      if (pA>pB) gA++; else gB++; pA=0; pB=0
    }
    if ((gA>=6 || gB>=6) && Math.abs(gA-gB)>=2) { if (gA>gB) sA++; else sB++; gA=0; gB=0 }
  }
  let pointText=''
  if (pA>=3 && pB>=3) pointText = (pA===pB)?'Deuce':(pA>pB?'Ad-In':'Ad-Out')
  else pointText = `${pointToTennis(pA)}-${pointToTennis(pB)}`
  return { gamesA:gA,gamesB:gB,setsA:sA,setsB:sB,pointText,server }
}

export function basicStats(points: Point[]) {
  const total = points.length
  const wonA = points.filter(p => p.outcome==='A').length
  const serves = points.filter(p => p.finish_type==='Ace' || p.first_serve_in!==null || p.second_serve_in!==null)
  const firstIn = points.filter(p => p.first_serve_in===true).length
  const doubleFaults = points.filter(p => p.finish_type==='DF').length
  const rallyAvg = total? (points.reduce((a,p)=>a+(p.rally_len||0),0)/total):0
  return { totalPoints: total, pctWonA: total? wonA/total:0, firstServeInPct: serves.length? firstIn/serves.length:0, doubleFaults, rallyAvg:Number(rallyAvg.toFixed(1)) }
}
