import { supabase } from '@/lib/supabase'

export async function fetchServerMaxSeq(matchId: string): Promise<number> {
  const { data, error } = await supabase!
    .from('points')
    .select('seq')
    .eq('match_id', matchId)
    .order('seq', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0]?.seq ?? 0
}
