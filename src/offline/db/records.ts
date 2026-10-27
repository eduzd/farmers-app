import { getDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore } from '@/lib/authStore';
import { syncRecordsToServer } from './syncService';

/**
 * archived = 2 marks a calculation the user deleted on this device whose server copy is not
 * removed yet. It is hidden everywhere, never uploaded, and stops the server copy being
 * downloaded again; the next sync deletes the server copy and then the row itself.
 */
export const ARCHIVED_DELETED = 2;

export type RecordType = 'BEPARI' | 'ARAT' | 'FEED' | 'FERTILIZER' | 'PROFIT' | 'FEED_TOOL' | 'LOAN' | 'INSURANCE';

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

/** The signed-in account, or null when signed out (the record then stays on this phone until someone signs in). */
function currentUserId(): string | null {
  try {
    const st = useAuthStore.getState();
    return st.isAuthenticated && st.user?.id ? String(st.user.id) : null;
  } catch {
    return null;
  }
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
  if (!database) throw new Error('Calculator storage is not available on this device');
  
  const now = Date.now();
  
  let id = options.id || uuidv4();
  let existing = await database.getFirstAsync<CalcRecord>(
    'SELECT * FROM calc_records WHERE id = ?',
    [id]
  );
  // The calculation was deleted meanwhile: saving makes a new one instead of editing the deleted one.
  if (existing && Number(existing.archived) === ARCHIVED_DELETED) {
    id = uuidv4();
    existing = null;
  }

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
        // Editing keeps what the caller did not send (title, notes, tags); an empty title clears it.
        options.title !== undefined ? (options.title || null) : (existing.title || null),
        JSON.stringify(inputs),
        JSON.stringify(outputs),
        options.notes !== undefined ? (options.notes || null) : (existing.notes || null),
        options.tags ? JSON.stringify(options.tags) : (existing.tags_json || null),
        id
      ]
    );
  } else {
    await database.runAsync(
      `INSERT INTO calc_records (id, record_type, created_at, updated_at, language, title, inputs_json, outputs_json, notes, tags_json, archived, sync_status, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?)`,
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
        options.tags ? JSON.stringify(options.tags) : null,
        currentUserId(),
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
  
  // Show only the signed-in account's records (plus ones saved here while signed out),
  // so another account on the same phone never sees them.
  const owner = currentUserId();
  let query = owner
    ? 'SELECT * FROM calc_records WHERE (owner_user_id IS NULL OR owner_user_id = ?)'
    : 'SELECT * FROM calc_records WHERE owner_user_id IS NULL';
  const params: any[] = owner ? [owner] : [];

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
    'SELECT * FROM calc_records WHERE id = ? AND (archived IS NULL OR archived != ?)',
    [id, ARCHIVED_DELETED]
  );
}

/**
 * Deletes a saved calculation for good: it disappears from every list at once, and its copy on
 * the server is deleted too so it never comes back. Offline, the server copy is deleted on the
 * next sync. A calculation that never reached the server is simply removed from this device.
 */
export async function deleteCalcRecord(id: string): Promise<void> {
  const database = await getDatabase();
  if (!database) throw new Error('Calculator storage is not available on this device');
  const rec = await database.getFirstAsync<CalcRecord>('SELECT * FROM calc_records WHERE id = ?', [id]);
  if (!rec) return;

  await database.runAsync('DELETE FROM calc_record_versions WHERE record_id = ?', [id]);

  const signedIn = !!currentUserId();
  const everSynced = !!rec.server_id || !!rec.last_synced_at;
  if (!signedIn && !everSynced && !(rec as any).owner_user_id) {
    // Saved while signed out and never uploaded: nothing on the server to delete.
    await database.runAsync('DELETE FROM calc_records WHERE id = ?', [id]);
    return;
  }

  // Keep only what the server delete needs; the numbers themselves are wiped now.
  await database.runAsync(
    "UPDATE calc_records SET archived = ?, updated_at = ?, title = NULL, inputs_json = '{}', outputs_json = '{}', notes = NULL, tags_json = NULL WHERE id = ?",
    [ARCHIVED_DELETED, Date.now(), id]
  );
  // Delete the server copy now when online (a sync deletes first, then uploads).
  syncRecordsToServer().catch(() => {});
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
