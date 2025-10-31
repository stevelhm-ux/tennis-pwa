export type Role = 'owner' | 'coach' | 'scorer' | 'viewer'

export interface Workspace { id: string; name: string }
export interface User { id: string; email: string; name?: string | null }

export interface Player {
  id: string
  workspace_id: string
  name: string
  handedness?: 'R' | 'L'
  notes?: string
}

export interface Match {
  id: string
  workspace_id: string
  player_a_id: string
  player_b_id: string
  tournament_id?: string | null   // ← new
  event?: string
  surface?: 'Hard' | 'Clay' | 'Grass' | 'Carpet'
  format?: 'BO3' | 'BO5'
  start_time?: string
}

export type Shot = 'FH'|'BH'|'Serve'|'Return'|'Volley'|'Overhead'|null
export type FinishType = 'Winner'|'UE'|'Forced'|'Ace'|'DF'
export type AB = 'A'|'B'

export interface Point {
  id: string
  match_id: string
  seq: number
  server: AB
  first_serve_in: boolean | null
  second_serve_in: boolean | null
  rally_len: number
  finishing_shot: Shot
  outcome: AB
  finish_type: FinishType
  tags: string[]
  created_by?: string
  created_at?: string
  deleted_at?: string | null
}

// Add this new interface
export interface Tournament {
  id: string
  workspace_id: string
  name: string
  venue?: string | null
  date?: string | null   // ISO "YYYY-MM-DD"
  grade?: 1 | 2 | 3 | 4 | 5
  created_by?: string
  created_at?: string
}
