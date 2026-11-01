import type { SqlDatabase } from './sql'

/**
 * Schema versions, applied in order (`PRAGMA user_version` counts them). Every row carries the
 * computer's daemon ID, so one computer is wiped with a `DELETE`. `entries_fts` is an external-content
 * FTS5 index over `entries.text`, kept in step by the triggers.
 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE streams (
    computer TEXT NOT NULL,
    stream TEXT NOT NULL,
    floor INTEGER NOT NULL,
    last_cursor INTEGER NOT NULL,
    complete INTEGER NOT NULL,
    used_at INTEGER NOT NULL,
    bytes INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (computer, stream)
  );
  CREATE TABLE entries (
    computer TEXT NOT NULL,
    stream TEXT NOT NULL,
    key TEXT NOT NULL,
    cursor INTEGER NOT NULL,
    idx INTEGER NOT NULL,
    json TEXT NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (computer, stream, key)
  );
  CREATE INDEX entries_by_cursor ON entries (computer, stream, cursor, idx);
  CREATE TABLE images (
    computer TEXT NOT NULL,
    stream TEXT NOT NULL,
    image_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (computer, stream, image_id)
  );
  CREATE TABLE snapshots (
    computer TEXT PRIMARY KEY,
    sessions TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );
  CREATE VIRTUAL TABLE entries_fts USING fts5(text, content='entries', content_rowid='rowid');
  CREATE TRIGGER entries_ai AFTER INSERT ON entries BEGIN
    INSERT INTO entries_fts (rowid, text) VALUES (new.rowid, new.text);
  END;
  CREATE TRIGGER entries_ad AFTER DELETE ON entries BEGIN
    INSERT INTO entries_fts (entries_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  END;
  CREATE TRIGGER entries_au AFTER UPDATE ON entries BEGIN
    INSERT INTO entries_fts (entries_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
    INSERT INTO entries_fts (rowid, text) VALUES (new.rowid, new.text);
  END;
  `,
]

/** Brings the database to the latest schema; freed pages are zeroed so a wipe leaves nothing behind. */
export async function migrate(db: SqlDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA secure_delete = ON;')
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', [])
  const version = row?.user_version ?? 0
  for (let next = version; next < MIGRATIONS.length; next++) {
    const sql = MIGRATIONS[next]
    if (!sql) continue
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql)
      await db.execAsync(`PRAGMA user_version = ${next + 1}`)
    })
  }
}
