import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
    return () => { sub?.subscription?.unsubscribe() }
  }, [])

  if (!ready) return <div className="p-4">Loading…</div>

  if (!session) {
    const login = async () => {

    const redirectTo = `${location.origin}/`  // 👈 return to root
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }                  // no manual exchange needed
    })
    if (error) alert(error.message)

    }
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white border rounded-2xl p-5 space-y-4 text-center">
          <h1 className="text-xl font-semibold">Tennis Tracker</h1>
          <p className="text-sm text-slate-600">Sign in to continue</p>
          <button onClick={login} className="w-full px-4 py-2 rounded-lg bg-black text-white active:scale-95">
            Continue with Google
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
