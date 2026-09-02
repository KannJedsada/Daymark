import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import Database from 'better-sqlite3'

let database: Database.Database | null = null

function resolveDatabasePath(path?: string): string {
  const configured = path ?? process.env.NUXT_DATABASE_PATH ?? './data/daymark.sqlite'
  if (configured === ':memory:') return ':memory:'
  return resolve(process.cwd(), configured)
}

function initSchema(db: Database.Database) {
  const initPath = resolve(process.cwd(), 'database/init.sql')
  db.exec(readFileSync(initPath, 'utf8'))
}

export function createDatabase(path?: string): Database.Database {
  const absolutePath = resolveDatabasePath(path)
  if (absolutePath !== ':memory:') {
    mkdirSync(dirname(absolutePath), { recursive: true })
  }

  const db = new Database(absolutePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initSchema(db)
  return db
}

export function getDatabase(path?: string): Database.Database {
  if (!database) {
    database = createDatabase(path)
  }
  return database
}

export function resetDatabaseForTests() {
  if (database) {
    database.close()
    database = null
  }
}
