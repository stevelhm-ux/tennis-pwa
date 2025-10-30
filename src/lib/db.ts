import Dexie, { Table } from 'dexie'
import type { Match, Player, Point, Workspace } from './types'

export class AppDB extends Dexie {
  workspaces!: Table<Workspace, string>
  players!: Table<Player, string>
  matches!: Table<Match, string>
  points!: Table<Point, string>
  outbox!: Table<any, number>
  constructor() {
    super('tennis-tracker')
    this.version(1).stores({
      workspaces: 'id',
      players: 'id, workspace_id',
      matches: 'id, workspace_id, start_time',
      points: 'id, match_id, seq',
      outbox: '++id, type, payload, created_at'
    })
  }
}
export const db = new AppDB()
