import { Platform } from 'react-native';
import { getDatabase } from './database';
import * as Sharing from 'expo-sharing';

export interface BackupData {
  version: number;
  created_at: number;
  settings: any[];
  calc_records: any[];
  calc_record_versions: any[];
  ledger_transactions: any[];
  ledger_payments: any[];
}

export async function exportBackup(): Promise<string> {
  const database = await getDatabase();
  
  if (!database) {
    return '';
  }
  
  const settings = await database.getAllAsync('SELECT * FROM settings');
  const calc_records = await database.getAllAsync('SELECT * FROM calc_records');
  const calc_record_versions = await database.getAllAsync('SELECT * FROM calc_record_versions');
  const ledger_transactions = await database.getAllAsync('SELECT * FROM ledger_transactions');
  const ledger_payments = await database.getAllAsync('SELECT * FROM ledger_payments');

  const backup: BackupData = {
    version: 1,
    created_at: Date.now(),
    settings,
    calc_records,
    calc_record_versions,
    ledger_transactions,
    ledger_payments,
  };

  if (Platform.OS === 'web') {
    return JSON.stringify(backup, null, 2);
  }

  const FileSystem = await import('expo-file-system/legacy');
  const fileName = `calculate_backup_${new Date().toISOString().split('T')[0]}.json`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;
  
  await FileSystem.writeAsStringAsync(filePath, JSON.stringify(backup, null, 2));
  
  return filePath;
}

export async function shareBackup(): Promise<void> {
  if (Platform.OS === 'web') {
    console.warn('Backup sharing not supported on web');
    return;
  }
  
  const filePath = await exportBackup();
  if (!filePath) return;
  
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Export Calculate Backup',
    });
  }
}

export async function importBackup(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const backup: BackupData = JSON.parse(jsonString);
    
    if (!backup.version || !backup.created_at) {
      return { success: false, message: 'Invalid backup file format' };
    }

    const database = await getDatabase();
    if (!database) {
      return { success: false, message: 'Database not available' };
    }

    for (const setting of backup.settings || []) {
      await database.runAsync(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
        [setting.key, setting.value, setting.updated_at]
      );
    }

    for (const record of backup.calc_records || []) {
      const existing = await database.getFirstAsync(
        'SELECT id FROM calc_records WHERE id = ?',
        [record.id]
      );
      if (!existing) {
        await database.runAsync(
          `INSERT INTO calc_records (id, record_type, created_at, updated_at, language, title, inputs_json, outputs_json, notes, tags_json, archived)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id, record.record_type, record.created_at, record.updated_at,
            record.language, record.title, record.inputs_json, record.outputs_json,
            record.notes, record.tags_json, record.archived
          ]
        );
      }
    }

    for (const version of backup.calc_record_versions || []) {
      const existing = await database.getFirstAsync(
        'SELECT id FROM calc_record_versions WHERE id = ?',
        [version.id]
      );
      if (!existing) {
        await database.runAsync(
          `INSERT INTO calc_record_versions (id, record_id, version, saved_at, inputs_json, outputs_json, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [version.id, version.record_id, version.version, version.saved_at, version.inputs_json, version.outputs_json, version.notes]
        );
      }
    }

    for (const txn of backup.ledger_transactions || []) {
      const existing = await database.getFirstAsync(
        'SELECT id FROM ledger_transactions WHERE id = ?',
        [txn.id]
      );
      if (!existing) {
        await database.runAsync(
          `INSERT INTO ledger_transactions (
            id, created_at, updated_at, language, txn_type, party_name, party_phone,
            market_place, fish_type, weight_kg, pieces, rate_per_kg, gross_amount,
            expense_items_json, extra_items_json, paid_now, due_amount, status, notes, tags_json, archived
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            txn.id, txn.created_at, txn.updated_at, txn.language, txn.txn_type,
            txn.party_name, txn.party_phone, txn.market_place, txn.fish_type,
            txn.weight_kg, txn.pieces, txn.rate_per_kg, txn.gross_amount,
            txn.expense_items_json, txn.extra_items_json, txn.paid_now,
            txn.due_amount, txn.status, txn.notes, txn.tags_json, txn.archived
          ]
        );
      }
    }

    for (const payment of backup.ledger_payments || []) {
      const existing = await database.getFirstAsync(
        'SELECT id FROM ledger_payments WHERE id = ?',
        [payment.id]
      );
      if (!existing) {
        await database.runAsync(
          'INSERT INTO ledger_payments (id, transaction_id, created_at, amount, method, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [payment.id, payment.transaction_id, payment.created_at, payment.amount, payment.method, payment.notes]
        );
      }
    }

    return { success: true, message: `Imported ${backup.calc_records?.length || 0} records, ${backup.ledger_transactions?.length || 0} transactions` };
  } catch (error) {
    return { success: false, message: `Import failed: ${error}` };
  }
}
