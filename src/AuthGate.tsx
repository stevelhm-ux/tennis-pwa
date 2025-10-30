import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => { sub?.subscription.unsubscribe() }
  }, [])

  if (!supabase) return <div className="p-4">No Supabase keys – running offline demo.</div>
  if (!session) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <h2 className="text-lg font-semibold mb-2">Sign in</h2>
        <form onSubmit={async (e) => {
          e.preventDefault()
          await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
          alert('Magic link sent. Check your email.')
        }}>
          <input className="border rounded px-3 py-2 w-full mb-2" type="email" placeholder="you@email.com"
                 value={email} onChange={(e)=>setEmail(e.target.value)} />
          <button className="bg-black text-white px-3 py-2 rounded w-full">Send magic link</button>
        </form>
      </div>
    )
  }
  return <>{children}</>
}
