import { supabase } from '@/lib/supabase'

export async function getMyRole(wsId: string): Promise<'owner'|'admin'|'member'|null> {
  const { data: sess } = await supabase!.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) return null
  const { data, error } = await supabase!
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', wsId)
    .eq('user_id', uid)
    .maybeSingle()
  if (error) { console.error(error); return null }
  return (data?.role as any) ?? null
}
