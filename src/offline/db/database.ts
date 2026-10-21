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
    const sqlite = await loadSQLite();
    if (sqlite) {
      const nativeDb = (await sqlite.openDatabaseAsync('calculate.db')) as unknown as CalcDatabase;
      await runMigrations(nativeDb);
      db = nativeDb;
    }
  }
  return db;
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
