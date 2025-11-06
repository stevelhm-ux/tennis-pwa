// src/bootstrap.ts
import { supabase } from '@/lib/supabase'
import { outbox } from '@/lib/outbox'
import { startSync } from '@/lib/sync'

/**
 * Ensure the user is authenticated and return their user id.
 */
export async function ensureAuth(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const uid = data.user?.id
  if (!uid) throw new Error('Not authenticated')
  return uid
}

/**
 * Validate that the given workspace id belongs to the current user.
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
 * Find any workspace the current user belongs to (first one).
 */
async function findAnyWorkspaceFor(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
  if (error) return null
  return data?.[0]?.workspace_id ?? null
}

/**
 * Create a new workspace and add the current user as owner.
 * Relies on your "wm bootstrap owner" RLS policy.
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

  // 2) Add first membership as owner
  const { error: memErr } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: wsId, user_id: userId, role: 'owner' })
  if (memErr) throw memErr

  return wsId
}

/**
 * Ensure we have a workspace id:
 * 1) Use localStorage wsId if it exists AND the user is a member
 * 2) Else pick any existing workspace the user belongs to
 * 3) Else create a new workspace and add the user as owner
 *
 * Also wires globals and starts background sync:
 *  - window.__wsId = <uuid>
 *  - window.__outbox = outbox
 *  - startSync(wsId)
 */
export async function ensureWorkspace(): Promise<string> {
  const userId = await ensureAuth()

  // Prefer the locally chosen workspace if still valid
  const stored = localStorage.getItem('wsId')
  if (stored && (await userIsMemberOf(stored, userId))) {
    wireGlobals(stored)
    return stored
  }

  // Otherwise pick any the user belongs to
  const existing = await findAnyWorkspaceFor(userId)
  if (existing) {
    localStorage.setItem('wsId', existing)
    wireGlobals(existing)
    return existing
  }

  // Otherwise create a fresh workspace and membership
  const created = await createWorkspaceFor(userId)
  localStorage.setItem('wsId', created)
  wireGlobals(created)
  return created
}

/**
 * Expose globals and start sync once (guarded).
 */
function wireGlobals(wsId: string) {
  const w = window as any
  w.__wsId = wsId
  // don't overwrite if another outbox implementation already attached
  w.__outbox = w.__outbox || outbox
  startSync(wsId)
}

/**
 * Helpers to access the active workspace id.
 */
export function getWorkspaceId(): string | null {
  return (window as any).__wsId || localStorage.getItem('wsId')
}

export async function requireWorkspace(): Promise<string> {
  const ws = getWorkspaceId()
  if (ws) return ws
  return ensureWorkspace()
}
