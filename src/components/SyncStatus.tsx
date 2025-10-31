
import React, { useEffect, useState } from 'react'
import { db } from '@/lib/db'
export function SyncStatus(){
  const [pending, setPending] = useState(0)
  useEffect(()=>{ refresh(); const i=setInterval(refresh, 2000); return ()=>clearInterval(i)},[])
  async function refresh(){ setPending(await db.outbox.count()) }
  return (<div className="fixed bottom-3 right-3 bg-white shadow rounded-full px-3 py-1 text-sm">{pending>0?`Pending sync: ${pending}`:'Synced ✓'}</div>)
}
