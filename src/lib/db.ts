
import Dexie, { Table } from 'dexie'
import type { Match, Player, Point, Tournament, Workspace } from './types'

export class AppDB extends Dexie {
  workspaces!: Table<Workspace, string>
  tournaments!: Table<Tournament, string>
  players!: Table<Player, string>
  matches!: Table<Match, string>
  points!: Table<Point, string>
  outbox!: Table<any, number>
  constructor() {
    super('tennis-tracker')
    this.version(2).stores({
      workspaces: 'id',
      tournaments: 'id, workspace_id',
      players: 'id, workspace_id',
      matches: 'id, workspace_id, tournament_id, start_time',
      points: 'id, match_id, seq',
      outbox: '++id, type, payload, created_at'
    })
  }
}
export const db = new AppDB()
