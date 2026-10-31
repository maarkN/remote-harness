import { Directory, Paths } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'
import * as SQLite from 'expo-sqlite'
import QuickCrypto from 'react-native-quick-crypto'
import { HistoryDb } from './history-db'
import { migrate } from './schema'

const KEY_ITEM = 'remote-harness.history-key'
const DB_NAME = 'history.db'
/** This device only: the key never reaches a backup, so a restored database file stays unreadable. */
const keyOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }

/** The cache directory (out of backups; the OS may reclaim it, which a cache tolerates), as a path. */
function databaseDirectory(): string {
  const directory = new Directory(Paths.cache, 'history')
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true })
  return decodeURI(directory.uri.replace(/^file:\/\//, ''))
}

/** The database key: 32 random bytes as hex, created on first use. */
async function databaseKey(): Promise<string> {
  const saved = await SecureStore.getItemAsync(KEY_ITEM, keyOptions)
  if (saved && /^[0-9a-f]{64}$/.test(saved)) return saved
  const bytes = QuickCrypto.getRandomValues(new Uint8Array(32)) as Uint8Array
  const fresh = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  await SecureStore.setItemAsync(KEY_ITEM, fresh, keyOptions)
  return fresh
}

async function openWith(directory: string, key: string): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME, undefined, directory)
  try {
    // A raw key (no passphrase KDF on every start); the first read fails when it does not match.
    await db.execAsync(`PRAGMA key = "x'${key}'"`)
    await migrate(db)
    return db
  } catch (error) {
    await db.closeAsync().catch(() => undefined)
    throw error
  }
}

/**
 * Opens the SQLCipher-encrypted history cache (ADR 0004). A file that does not open with the key (a
 * restored copy, a lost key) is deleted and started again: it is only a cache.
 */
export async function openHistoryDb(): Promise<HistoryDb> {
  const directory = databaseDirectory()
  const key = await databaseKey()
  try {
    return new HistoryDb(await openWith(directory, key))
  } catch {
    await SQLite.deleteDatabaseAsync(DB_NAME, directory).catch(() => undefined)
    return new HistoryDb(await openWith(directory, key))
  }
}
