/**
 * Web fallback for the offline calculator database.
 *
 * expo-sqlite needs native code, so the original app simply had no storage
 * on web (ledger, history and drafts were lost on refresh). This adapter runs
 * real SQLite in the browser via sql.js (WebAssembly, loaded from
 * /sqljs/ at runtime) and persists the database file to localStorage.
 * It implements the subset of the expo-sqlite async API the app uses.
 */

type SqlValue = string | number | null | Uint8Array;
type Params = SqlValue[] | Record<string, SqlValue>;

interface SqlJsStatement {
  bind(params?: Params): boolean;
  step(): boolean;
  getAsObject(): Record<string, SqlValue>;
  free(): void;
}
interface SqlJsDatabase {
  exec(sql: string): unknown;
  run(sql: string, params?: Params): void;
  prepare(sql: string): SqlJsStatement;
  export(): Uint8Array;
  getRowsModified(): number;
}
interface SqlJsStatic {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
}

const STORAGE_KEY = "farmers.calculate.db";
const BASE = "/sqljs/";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-sqljs]`);
    if (existing) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.sqljs = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function normalize(params: unknown[]): Params | undefined {
  if (params.length === 0) return undefined;
  if (params.length === 1 && (Array.isArray(params[0]) || (params[0] && typeof params[0] === "object"))) {
    const p = params[0] as Params;
    return Array.isArray(p) ? p.map((v) => (v === undefined ? null : v)) : p;
  }
  return params.map((v) => (v === undefined ? null : (v as SqlValue)));
}

export class WebSQLiteDatabase {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(private db: SqlJsDatabase) {}

  private persistSoon() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persistNow(), 150);
  }

  /**
   * Writes the database to the browser storage right away. Every saved row goes through here, so a
   * calculation saved just before the page is reloaded or closed is never lost.
   */
  persistNow() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      localStorage.setItem(STORAGE_KEY, toBase64(this.db.export()));
    } catch (e) {
      console.warn("[webdb] could not persist database", e);
    }
  }

  async execAsync(sql: string): Promise<void> {
    // WAL is not available in the browser; ignore that pragma.
    this.db.exec(sql.replace(/PRAGMA\s+journal_mode\s*=\s*WAL\s*;/gi, ""));
    this.persistSoon();
  }

  async runAsync(sql: string, ...params: unknown[]) {
    this.db.run(sql, normalize(params));
    const changes = this.db.getRowsModified();
    this.persistNow();
    return { changes, lastInsertRowId: 0 };
  }

  async getAllAsync<T = Record<string, SqlValue>>(sql: string, ...params: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      const p = normalize(params);
      if (p) stmt.bind(p);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  async getFirstAsync<T = Record<string, SqlValue>>(sql: string, ...params: unknown[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, ...params);
    return rows[0] ?? null;
  }
}

let opening: Promise<WebSQLiteDatabase | null> | null = null;

export function openWebDatabase(): Promise<WebSQLiteDatabase | null> {
  if (opening) return opening;
  opening = (async () => {
    try {
      await loadScript(`${BASE}sql-wasm.js`);
      const init = (window as unknown as { initSqlJs: (cfg: { locateFile: (f: string) => string }) => Promise<SqlJsStatic> }).initSqlJs;
      const SQL = await init({ locateFile: (f) => `${BASE}${f}` });
      const saved = localStorage.getItem(STORAGE_KEY);
      const db = new SQL.Database(saved ? fromBase64(saved) : undefined);
      const wrapped = new WebSQLiteDatabase(db);
      // Anything still waiting is written when the tab is hidden or closed.
      const flush = () => wrapped.persistNow();
      window.addEventListener("pagehide", flush);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
      return wrapped;
    } catch (e) {
      console.warn("[webdb] SQLite for web unavailable, calculator data will not persist", e);
      return null;
    }
  })();
  return opening;
}
