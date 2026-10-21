import { getDatabase } from './database';
import { getApiUrl } from '@/lib/query-client';
import { Platform } from 'react-native';
import * as Network from 'expo-network';

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
    return (networkState.isConnected && networkState.isInternetReachable) ?? false;
  } catch {
    return false;
  }
}

export async function getPendingRecordsCount(): Promise<number> {
  const database = await getDatabase();
  if (!database) return 0;
  
  const result = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM calc_records WHERE sync_status = 'pending'"
  );
  return result?.count ?? 0;
}

export async function getUnsyncedRecords(): Promise<LocalCalcRecord[]> {
  const database = await getDatabase();
  if (!database) return [];
  
  return database.getAllAsync<LocalCalcRecord>(
    "SELECT * FROM calc_records WHERE sync_status = 'pending' ORDER BY created_at ASC"
  );
}

export async function markRecordAsSynced(
  localId: string, 
  serverId: string
): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  
  await database.runAsync(
    "UPDATE calc_records SET sync_status = 'synced', server_id = ?, last_synced_at = ? WHERE id = ?",
    [serverId, Date.now(), localId]
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

export async function syncRecordsToServer(userId?: string): Promise<{ success: boolean; synced: number; errors: number }> {
  if (isSyncing) {
    return { success: false, synced: 0, errors: 0 };
  }
  
  const isOnline = await isNetworkAvailable();
  if (!isOnline) {
    console.log('No network connection, skipping sync');
    return { success: false, synced: 0, errors: 0 };
  }
  
  isSyncing = true;
  notifySyncListeners('syncing');
  
  let syncedCount = 0;
  let errorCount = 0;
  
  try {
    const unsyncedRecords = await getUnsyncedRecords();
    
    if (unsyncedRecords.length === 0) {
      notifySyncListeners('success');
      return { success: true, synced: 0, errors: 0 };
    }
    
    console.log(`Syncing ${unsyncedRecords.length} records to server...`);
    
    for (const record of unsyncedRecords) {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(new URL('/api/calc-records/sync', apiUrl).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            localId: record.id,
            userId: userId,
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
          await markRecordAsSynced(record.id, result.id);
          syncedCount++;
        } else {
          console.error('Failed to sync record:', record.id, response.status);
          await markRecordAsError(record.id);
          errorCount++;
        }
      } catch (error) {
        console.error('Error syncing record:', record.id, error);
        await markRecordAsError(record.id);
        errorCount++;
      }
    }
    
    notifySyncListeners(errorCount === 0 ? 'success' : 'error');
    return { success: errorCount === 0, synced: syncedCount, errors: errorCount };
  } catch (error) {
    console.error('Sync failed:', error);
    notifySyncListeners('error');
    return { success: false, synced: syncedCount, errors: errorCount };
  } finally {
    isSyncing = false;
  }
}

export async function fetchRecordsFromServer(userId: string): Promise<ServerCalcRecord[]> {
  const isOnline = await isNetworkAvailable();
  if (!isOnline) {
    return [];
  }
  
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(new URL(`/api/calc-records?userId=${userId}`, apiUrl).toString());
    
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch records from server:', error);
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
        `INSERT INTO calc_records (id, record_type, created_at, updated_at, language, title, inputs_json, outputs_json, notes, tags_json, archived, sync_status, server_id, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
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
        ]
      );
      importedCount++;
    }
  }
  
  return importedCount;
}

export async function fullSync(userId?: string): Promise<{ uploaded: number; downloaded: number; errors: number }> {
  const uploadResult = await syncRecordsToServer(userId);
  
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
