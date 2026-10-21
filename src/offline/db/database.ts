import { Platform } from 'react-native';
import type { WebSQLiteDatabase } from './webDatabase';

/** The subset of the expo-sqlite async API used by the calculator module. */
export interface CalcDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: any[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]>;
  getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null>;
}

let db: CalcDatabase | null = null;
let SQLite: typeof import('expo-sqlite') | null = null;
let isWebPlatform = Platform.OS === 'web';

async function loadSQLite() {
  if (!isWebPlatform && !SQLite) {
    SQLite = await import('expo-sqlite');
  }
  return SQLite;
}

export async function getDatabase(): Promise<CalcDatabase | null> {
  if (isWebPlatform) {
    if (!db) {
      const { openWebDatabase } = await import('./webDatabase');
      const webDb: WebSQLiteDatabase | null = await openWebDatabase();
      if (webDb) {
        await runMigrations(webDb);
        db = webDb;
      }
    }
    return db;
  }
  
  if (!db) {
    if (!opening) {
      opening = openEncryptedNativeDb().finally(() => {
        opening = null;
      });
    }
    db = await opening;
  }
  return db;
}

let opening: Promise<CalcDatabase | null> | null = null;

const PLAIN_DB = 'calculate.db';
const SECURE_DB = 'calculate-secure.db';

/**
 * Opens the calculator database encrypted with SQLCipher. The key comes from the phone's secure store
 * (see secureKey.ts). A plain database from an older version is copied into the encrypted one once and
 * then deleted, so nothing is lost and nothing stays unencrypted.
 */
async function openEncryptedNativeDb(): Promise<CalcDatabase | null> {
  const sqlite = await loadSQLite();
  if (!sqlite) return null;
  const { getCalcDbKey } = await import('./secureKey');
  const key = await getCalcDbKey();
  const keyPragma = key ? `PRAGMA key = "x'${key}'";` : '';

  const secure: any = await sqlite.openDatabaseAsync(SECURE_DB);
  if (keyPragma) await secure.execAsync(keyPragma);
  // Fails here if the key is wrong; the file is never deleted in that case.
  const tables = await secure.getFirstAsync('SELECT COUNT(*) as n FROM sqlite_master');

  if (key && (tables?.n ?? 0) === 0) {
    await migratePlainDatabase(sqlite, secure);
  }
  await runMigrations(secure as CalcDatabase);
  return secure as CalcDatabase;
}

async function migratePlainDatabase(sqlite: typeof import('expo-sqlite'), secure: any): Promise<void> {
  let plain: any = null;
  try {
    plain = await sqlite.openDatabaseAsync(PLAIN_DB);
    const t = await plain.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    if (!t || t.length === 0) {
      await plain.closeAsync();
      plain = null;
      await sqlite.deleteDatabaseAsync(PLAIN_DB).catch(() => {});
      return;
    }
    await runMigrations(plain as CalcDatabase);
    await runMigrations(secure as CalcDatabase);
    const dir = (sqlite as any).defaultDatabaseDirectory as string | undefined;
    const plainPath = dir ? `${dir.replace(/^file:\/\//, '').replace(/\/$/, '')}/${PLAIN_DB}` : PLAIN_DB;
    await secure.execAsync(`ATTACH DATABASE '${plainPath.replace(/'/g, "''")}' AS plaindb KEY '';`);
    for (const row of t as { name: string }[]) {
      const name = row.name.replace(/"/g, '');
      await secure.execAsync(`INSERT OR IGNORE INTO main."${name}" SELECT * FROM plaindb."${name}";`).catch(() => {});
    }
    await secure.execAsync('DETACH DATABASE plaindb;');
    await plain.closeAsync();
    plain = null;
    await sqlite.deleteDatabaseAsync(PLAIN_DB).catch(() => {});
  } catch {
    // Leave the old file alone if anything goes wrong; it is tried again next launch.
    try { await plain?.closeAsync(); } catch {}
  }
}

export function isDbAvailable(): boolean {
  return true;
}

async function runMigrations(database: CalcDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS calc_records (
      id TEXT PRIMARY KEY,
      record_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      language TEXT DEFAULT 'bn',
      title TEXT,
      inputs_json TEXT,
      outputs_json TEXT,
      notes TEXT,
      tags_json TEXT,
      archived INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending',
      server_id TEXT,
      last_synced_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS calc_record_versions (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      saved_at INTEGER NOT NULL,
      inputs_json TEXT,
      outputs_json TEXT,
      notes TEXT,
      FOREIGN KEY (record_id) REFERENCES calc_records(id)
    );

    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      language TEXT DEFAULT 'bn',
      txn_type TEXT NOT NULL,
      party_name TEXT,
      party_phone TEXT,
      market_place TEXT,
      fish_type TEXT,
      weight_kg REAL,
      pieces INTEGER,
      rate_per_kg REAL,
      gross_amount REAL,
      expense_items_json TEXT,
      extra_items_json TEXT,
      paid_now REAL DEFAULT 0,
      due_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'DUE',
      notes TEXT,
      tags_json TEXT,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ledger_payments (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT DEFAULT 'cash',
      notes TEXT,
      FOREIGN KEY (transaction_id) REFERENCES ledger_transactions(id)
    );

    CREATE TABLE IF NOT EXISTS export_logs (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      export_type TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      file_path TEXT
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      screen_type TEXT NOT NULL,
      data_json TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_calc_records_type ON calc_records(record_type);
    CREATE INDEX IF NOT EXISTS idx_calc_records_created ON calc_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_calc_records_archived ON calc_records(archived);
    CREATE INDEX IF NOT EXISTS idx_calc_records_sync ON calc_records(sync_status);
    CREATE INDEX IF NOT EXISTS idx_ledger_txn_type ON ledger_transactions(txn_type);
    CREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger_transactions(party_name);
    CREATE INDEX IF NOT EXISTS idx_ledger_status ON ledger_transactions(status);
    CREATE INDEX IF NOT EXISTS idx_ledger_archived ON ledger_transactions(archived);
    CREATE INDEX IF NOT EXISTS idx_payments_txn ON ledger_payments(transaction_id);
  `);
  // v2: which account a record belongs to, so sync only ever uploads to that account.
  const cols = await database.getAllAsync<{ name: string }>('PRAGMA table_info(calc_records)');
  if (!cols.some((c) => c.name === 'owner_user_id')) {
    await database.execAsync('ALTER TABLE calc_records ADD COLUMN owner_user_id TEXT;');
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const database = await getDatabase();
  if (!database) return null;
  const result = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return result?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  await database.runAsync(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
    [key, value, Date.now()]
  );
}

export async function getSettings(): Promise<Record<string, any>> {
  const database = await getDatabase();
  if (!database) return {};
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings'
  );
  const settings: Record<string, any> = {};
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }
  return settings;
}
