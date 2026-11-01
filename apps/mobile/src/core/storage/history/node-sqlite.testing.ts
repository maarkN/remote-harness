import { DatabaseSync } from 'node:sqlite'
import type { SqlDatabase, SqlValue } from './sql'

// Tests only: never imported by the app (Metro has no `node:sqlite`).

/** `node:sqlite` behind the expo-sqlite shape the cache uses. */
export function nodeDatabase(): SqlDatabase & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:')
  return {
    raw,
    execAsync: async (source) => {
      raw.exec(source)
    },
    runAsync: async (source, params: SqlValue[]) => raw.prepare(source).run(...params),
    getAllAsync: async <T>(source: string, params: SqlValue[]) => raw.prepare(source).all(...params) as T[],
    getFirstAsync: async <T>(source: string, params: SqlValue[]) =>
      (raw.prepare(source).get(...params) as T | undefined) ?? null,
    withTransactionAsync: async (task) => {
      raw.exec('BEGIN')
      try {
        await task()
        raw.exec('COMMIT')
      } catch (error) {
        raw.exec('ROLLBACK')
        throw error
      }
    },
    closeAsync: async () => raw.close(),
  }
}
