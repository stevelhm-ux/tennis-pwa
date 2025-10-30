import { supabase } from './supabase'
import { db } from './db'
import type { Point } from './types'

export async function fetchMatchPoints(matchId: string) {
  if (!supabase) return
  const { data, error } = await supabase.from('points').select('*').eq('match_id', matchId).is('deleted_at', null).order('seq', { ascending: true })
  if (error) throw error
  await db.points.bulkPut((data || []) as Point[])
}
