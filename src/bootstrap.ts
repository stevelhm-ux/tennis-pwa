// src/bootstrap.ts
import { supabase } from '@/lib/supabase'
import { outbox } from '@/lib/outbox'
import { startSync } from '@/lib/sync'

/**
 * Helper: read current user id (throws if not logged in)
 */
export async function ensureAuth(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const uid = data.user?.id
  if (!uid) throw new Error('Not authenticated')
  return uid
}

/**
 * Helper: validate that the given wsId is one the user belongs to
 */
async function userIsMemberOf(wsId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', wsId)
    .eq('user_id', userId)
    .limit(1)
  if (error) return false
  return !!data && data.length > 0
}

/**
 * Helper: find ANY workspace for the user (returns the first)
 */
async function findAnyWorkspaceFor(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
  if (error) return null
  return data && data[0]?.workspace_id ? data[0].workspace_id : null
}

/**
 * Helper: create a brand-new workspace and add the current user as owner.
 * Requires either:
 *  - your "bootstrap owner" policy on workspace_members, or
 *  - the app’s service role on the server side (not used here).
 */
async function createWorkspaceFor(userId: string): Promise<string> {
  // 1) Create workspace
  const { data: wsIns, error: wsErr } = await supabase
    .from('workspaces')
    .insert({ name: 'Tennis Tracker' })
    .select('id')
    .single()
  if (wsErr) throw wsErr
  const wsId = wsIns.id as string

  // 2) Add first membership as owner (relies on your "wm bootstrap owner" policy)
  const { error: memErr } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: wsId, user_id: userId, role: 'owner' })
  if (memErr) throw memErr

  return wsId
}

/**
 * Ensu*
