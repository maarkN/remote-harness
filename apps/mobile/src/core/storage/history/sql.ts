export type SqlValue = string | number | null

/**
 * The part of expo-sqlite's `SQLiteDatabase` the history cache uses. The app passes the real one;
 * tests pass `node:sqlite` behind the same shape, so queries run against a real SQLite.
 */
export type SqlDatabase = {
  execAsync(source: string): Promise<void>
  runAsync(source: string, params: SqlValue[]): Promise<unknown>
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>
  withTransactionAsync(task: () => Promise<void>): Promise<void>
  closeAsync(): Promise<void>
}
