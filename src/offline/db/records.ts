import { getDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';

export type RecordType = 'BEPARI' | 'ARAT' | 'FEED';

export type SyncStatus = 'pending' | 'synced' | 'error';

export interface CalcRecord {
  id: string;
  record_type: RecordType;
  created_at: number;
  updated_at: number;
  language: string;
  title?: string;
  inputs_json: string;
  outputs_json: string;
  notes?: string;
  tags_json?: string;
  archived: number;
  sync_status: SyncStatus;
  server_id?: string;
  last_synced_at?: number;
}

export interface CalcRecordVersion {
  id: string;
  record_id: string;
  version: number;
  saved_at: number;
  inputs_json: string;
  outputs_json: string;
  notes?: string;
}

export async function saveCalcRecord(
  recordType: RecordType,
  inputs: any,
  outputs: any,
  options: {
    id?: string;
    title?: string;
    notes?: string;
    tags?: string[];
    language?: string;
  } = {}
): Promise<string> {
  const database = await getDatabase();
  if (!database) return options.id || uuidv4();
  
  const now = Date.now();
  const id = options.id || uuidv4();
  
  const existing = await database.getFirstAsync<CalcRecord>(
    'SELECT * FROM calc_records WHERE id = ?',
    [id]
  );

  if (existing) {
    const versionCount = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM calc_record_versions WHERE record_id = ?',
      [id]
    );
    const nextVersion = (versionCount?.count || 0) + 1;

    await database.runAsync(
      `INSERT INTO calc_record_versions (id, record_id, version, saved_at, inputs_json, outputs_json, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), id, nextVersion, now, existing.inputs_json, existing.outputs_json, existing.notes || null]
    );

    await database.runAsync(
      `UPDATE calc_records SET 
        updated_at = ?,
        title = ?,
        inputs_json = ?,
        outputs_json = ?,
        notes = ?,
        tags_json = ?,
        sync_status = 'pending'
       WHERE id = ?`,
      [
        now,
        options.title || existing.title || null,
        JSON.stringify(inputs),
        JSON.stringify(outputs),
        options.notes || null,
        options.tags ? JSON.stringify(options.tags) : null,
        id
      ]
    );
  } else {
    await database.runAsync(
      `INSERT INTO calc_records (id, record_type, created_at, updated_at, language, title, inputs_json, outputs_json, notes, tags_json, archived, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')`,
      [
        id,
        recordType,
        now,
        now,
        options.language || 'bn',
        options.title || null,
        JSON.stringify(inputs),
        JSON.stringify(outputs),
        options.notes || null,
        options.tags ? JSON.stringify(options.tags) : null
      ]
    );
  }

  return id;
}

export async function getCalcRecords(
  filters: {
    recordType?: RecordType;
    archived?: boolean;
    search?: string;
    fromDate?: number;
    toDate?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<CalcRecord[]> {
  const database = await getDatabase();
  if (!database) return [];
  
  let query = 'SELECT * FROM calc_records WHERE 1=1';
  const params: any[] = [];

  if (filters.recordType) {
    query += ' AND record_type = ?';
    params.push(filters.recordType);
  }

  if (filters.archived !== undefined) {
    query += ' AND archived = ?';
    params.push(filters.archived ? 1 : 0);
  } else {
    query += ' AND archived = 0';
  }

  if (filters.search) {
    query += ' AND (title LIKE ? OR notes LIKE ? OR inputs_json LIKE ?)';
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (filters.fromDate) {
    query += ' AND created_at >= ?';
    params.push(filters.fromDate);
  }

  if (filters.toDate) {
    query += ' AND created_at <= ?';
    params.push(filters.toDate);
  }

  query += ' ORDER BY created_at DESC';

  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }
  }

  return database.getAllAsync<CalcRecord>(query, params);
}

export async function getCalcRecord(id: string): Promise<CalcRecord | null> {
  const database = await getDatabase();
  if (!database) return null;
  return database.getFirstAsync<CalcRecord>(
    'SELECT * FROM calc_records WHERE id = ?',
    [id]
  );
}

export async function getRecordVersions(recordId: string): Promise<CalcRecordVersion[]> {
  const database = await getDatabase();
  if (!database) return [];
  return database.getAllAsync<CalcRecordVersion>(
    'SELECT * FROM calc_record_versions WHERE record_id = ? ORDER BY version DESC',
    [recordId]
  );
}

export async function archiveRecord(id: string): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  await database.runAsync(
    "UPDATE calc_records SET archived = 1, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [Date.now(), id]
  );
}

export async function restoreRecord(id: string): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  await database.runAsync(
    "UPDATE calc_records SET archived = 0, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [Date.now(), id]
  );
}

export async function restoreVersion(recordId: string, versionId: string): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  const version = await database.getFirstAsync<CalcRecordVersion>(
    'SELECT * FROM calc_record_versions WHERE id = ?',
    [versionId]
  );
  
  if (version) {
    await database.runAsync(
      `UPDATE calc_records SET 
        inputs_json = ?,
        outputs_json = ?,
        notes = ?,
        updated_at = ?
       WHERE id = ?`,
      [version.inputs_json, version.outputs_json, version.notes || null, Date.now(), recordId]
    );
  }
}
