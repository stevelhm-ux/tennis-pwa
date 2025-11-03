import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = (url && anon)
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // 👈 auto-exchange ?code on load
        flowType: 'pkce',         // 👈 ensure PKCE flow
      },
    })
  : null

if (typeof window !== 'undefined' && supabase) { (window as any)._supabase = supabase }
