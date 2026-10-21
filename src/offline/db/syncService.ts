import { getDatabase } from './database';
import { getApiUrl } from '@/lib/query-client';
import { Platform } from 'react-native';
import * as Network from 'expo-network';
import { useAuthStore } from '@/lib/authStore';

export type SyncStatus = 'pending' | 'synced' | 'error';

interface LocalCalcRecord {
  id: string;
  record_type: string;
  created_at: number;
  updated_at: number;
  language: string;
  title: string | null;
  inputs_json: string;
  outputs_json: string;
  notes: string | null;
  tags_json: string | null;
  archived: number;
  sync_status: SyncStatus;
  server_id: string | null;
  last_synced_at: number | null;
  owner_user_id?: string | null;
}

interface ServerCalcRecord {
  id: string;
  localId: string;
  recordType: string;
  createdAt: string;
  updatedAt: string;
  language: string;
  title: string | null;
  inputsJson: string;
  outputsJson: string;
  notes: string | null;
  tagsJson: string | null;
  archived: boolean;
}

let isSyncing = false;
let syncListeners: ((status: 'idle' | 'syncing' | 'success' | 'error') => void)[] = [];

export function addSyncListener(callback: (status: 'idle' | 'syncing' | 'success' | 'error') => void) {
  syncListeners.push(callback);
  return () => {
    syncListeners = syncListeners.filter(l => l !== callback);
  };
}

function notifySyncListeners(status: 'idle' | 'syncing' | 'success' | 'error') {
  syncListeners.forEach(l => l(status));
}

async function isNetworkAvailable(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return typeof navigator !== 'undefined' && navigator.onLine;
    }
    const networkState = await Network.getNetworkStateAsync();
    return !!networkState.isConnected && networkState.isInternetReachable !== false;
  } catch {
    return false;
  }
}

/** The signed-in account and its token, or null when signed out. */
function currentSession(): { userId: string; token: string } | null {
  try {
    const st = useAuthStore.getState();
    if (st.isAuthenticated && st.token && st.user?.id) return { userId: String(st.user.id), token: st.token };
  } catch {}
  return null;
}

export async function getPendingRecordsCount(): Promise<number> {
  const database = await getDatabase();
  if (!database) return 0;
  const session = currentSession();
  if (!session) return 0;
  const result = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM calc_records WHERE sync_status = 'pending' AND (owner_user_id IS NULL OR owner_user_id = ?)",
    [session.userId]
  );
  return result?.count ?? 0;
}

/** Records waiting to go to this account: its own, plus ones saved on this phone while nobody was signed in. */
export async function getUnsyncedRecords(userId: string): Promise<LocalCalcRecord[]> {
  const database = await getDatabase();
  if (!database) return [];
  return database.getAllAsync<LocalCalcRecord>(
    "SELECT * FROM calc_records WHERE sync_status = 'pending' AND (owner_user_id IS NULL OR owner_user_id = ?) ORDER BY created_at ASC",
    [userId]
  );
}

export async function markRecordAsSynced(
  localId: string,
  serverId: string,
  updatedAt?: number,
  ownerUserId?: string
): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  
  // If the record was edited while it was uploading, it stays pending and goes up again next time.
  await database.runAsync(
    "UPDATE calc_records SET sync_status = 'synced', server_id = ?, last_synced_at = ?, owner_user_id = COALESCE(owner_user_id, ?) WHERE id = ? AND (? IS NULL OR updated_at = ?)",
    [serverId, Date.now(), ownerUserId ?? null, localId, updatedAt ?? null, updatedAt ?? null]
  );
}

export async function markRecordAsError(localId: string): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  
  await database.runAsync(
    "UPDATE calc_records SET sync_status = 'error' WHERE id = ?",
    [localId]
  );
}

export async function retryFailedRecords(): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  
  await database.runAsync(
    "UPDATE calc_records SET sync_status = 'pending' WHERE sync_status = 'error'"
  );
}

/**
 * Uploads this account's pending records. Each record is sent with its local id and the server
 * updates the same row if it already has it, so retries after a dropped connection never make duplicates.
 * The account comes from the sign-in token. Nothing about the records is logged.
 */
export async function syncRecordsToServer(_userId?: string): Promise<{ success: boolean; synced: number; errors: number }> {
  if (isSyncing) {
    return { success: false, synced: 0, errors: 0 };
  }
  const session = currentSession();
  if (!session) {
    return { success: false, synced: 0, errors: 0 };
  }
  const isOnline = await isNetworkAvailable();
  if (!isOnline) {
    return { success: false, synced: 0, errors: 0 };
  }

  isSyncing = true;
  notifySyncListeners('syncing');

  let syncedCount = 0;
  let errorCount = 0;

  try {
    const unsyncedRecords = await getUnsyncedRecords(session.userId);
    if (unsyncedRecords.length === 0) {
      notifySyncListeners('success');
      return { success: true, synced: 0, errors: 0 };
    }

    const url = new URL('/api/calc-records/sync', getApiUrl()).toString();
    for (const record of unsyncedRecords) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({
            localId: record.id,
            recordType: record.record_type,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            language: record.language,
            title: record.title,
            inputsJson: record.inputs_json,
            outputsJson: record.outputs_json,
            notes: record.notes,
            tagsJson: record.tags_json,
            archived: record.archived === 1,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          await markRecordAsSynced(record.id, result.id, record.updated_at, session.userId);
          syncedCount++;
        } else if (response.status === 401 || response.status === 403) {
          // Signed out or token expired: keep everything pending and stop until the user signs in again.
          errorCount++;
          break;
        } else if (response.status >= 400 && response.status < 500) {
          // The server refused this record; it stays on the phone, marked so it is not resent in a loop.
          await markRecordAsError(record.id);
          errorCount++;
        } else {
          // Server asleep or failing: keep it pending and try again on the next sync.
          errorCount++;
          break;
        }
      } catch {
        // Connection dropped: keep it pending.
        errorCount++;
        break;
      }
    }

    notifySyncListeners(errorCount === 0 ? 'success' : 'error');
    return { success: errorCount === 0, synced: syncedCount, errors: errorCount };
  } catch {
    notifySyncListeners('error');
    return { success: false, synced: syncedCount, errors: errorCount };
  } finally {
    isSyncing = false;
  }
}

export async function fetchRecordsFromServer(_userId?: string): Promise<ServerCalcRecord[]> {
  const session = currentSession();
  if (!session) return [];
  const isOnline = await isNetworkAvailable();
  if (!isOnline) return [];
  try {
    const response = await fetch(new URL('/api/calc-records', getApiUrl()).toString(), {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (response.ok) return await response.json();
    return [];
  } catch {
    return [];
  }
}

export async function syncFromServer(userId: string): Promise<number> {
  const database = await getDatabase();
  if (!database) return 0;
  
  const serverRecords = await fetchRecordsFromServer(userId);
  let importedCount = 0;
  
  for (const serverRecord of serverRecords) {
    const existingByServerId = await database.getFirstAsync<{ id: string }>(
      "SELECT id FROM calc_records WHERE server_id = ?",
      [serverRecord.id]
    );
    
    const existingByLocalId = await database.getFirstAsync<{ id: string }>(
      "SELECT id FROM calc_records WHERE id = ?",
      [serverRecord.localId]
    );
    
    if (!existingByServerId && !existingByLocalId) {
      await database.runAsync(
        `INSERT INTO calc_records (id, record_type, created_at, updated_at, language, title, inputs_json, outputs_json, notes, tags_json, archived, sync_status, server_id, last_synced_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?)`,
        [
          serverRecord.localId || serverRecord.id,
          serverRecord.recordType,
          new Date(serverRecord.createdAt).getTime(),
          new Date(serverRecord.updatedAt).getTime(),
          serverRecord.language || 'bn',
          serverRecord.title,
          serverRecord.inputsJson,
          serverRecord.outputsJson,
          serverRecord.notes,
          serverRecord.tagsJson,
          serverRecord.archived ? 1 : 0,
          serverRecord.id,
          Date.now(),
          userId,
        ]
      );
      importedCount++;
    }
  }
  
  return importedCount;
}

export async function fullSync(_userId?: string): Promise<{ uploaded: number; downloaded: number; errors: number }> {
  const uploadResult = await syncRecordsToServer();
  const userId = currentSession()?.userId;
  
  let downloadedCount = 0;
  if (userId) {
    downloadedCount = await syncFromServer(userId);
  }
  
  return {
    uploaded: uploadResult.synced,
    downloaded: downloadedCount,
    errors: uploadResult.errors,
  };
}
