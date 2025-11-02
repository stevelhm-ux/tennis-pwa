import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const [msg, setMsg] = useState('Completing sign-in…')

  useEffect(() => {
    (async () => {
      try {
        // Supabase v2 PKCE: exchange code from URL for a session
        const { error } = await supabase!.auth.exchangeCodeForSession(window.location.href)
        if (error) throw error
        setMsg('Signed in. Redirecting…')
      } catch (e: any) {
        console.error(e)
        setMsg(e?.message || 'Sign-in failed')
      } finally {
        setTimeout(() => { location.replace('/') }, 300)
      }
    })()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white border rounded-2xl p-5 text-center">
        <div className="text-sm text-slate-700">{msg}</div>
      </div>
    </div>
  )
}
