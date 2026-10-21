import { getDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';

export type TxnType = 'SALE' | 'PURCHASE' | 'RECEIVED' | 'PAID' | 'EXPENSE' | 'COMMISSION' | 'DUE_ADJUST' | 'OTHER';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'DUE';

export interface ExpenseItem {
  name: string;
  amount: number;
}

export interface LedgerTransaction {
  id: string;
  created_at: number;
  updated_at: number;
  language: string;
  txn_type: TxnType;
  party_name?: string;
  party_phone?: string;
  market_place?: string;
  fish_type?: string;
  weight_kg?: number;
  pieces?: number;
  rate_per_kg?: number;
  gross_amount: number;
  expense_items_json?: string;
  extra_items_json?: string;
  paid_now: number;
  due_amount: number;
  status: PaymentStatus;
  notes?: string;
  tags_json?: string;
  archived: number;
}

export interface LedgerPayment {
  id: string;
  transaction_id: string;
  created_at: number;
  amount: number;
  method: string;
  notes?: string;
}

export async function saveLedgerTransaction(
  data: Omit<LedgerTransaction, 'id' | 'created_at' | 'updated_at' | 'archived'> & { id?: string }
): Promise<string> {
  const database = await getDatabase();
  const now = Date.now();
  const id = data.id || uuidv4();
  
  if (!database) return id;

  const existing = await database.getFirstAsync<LedgerTransaction>(
    'SELECT * FROM ledger_transactions WHERE id = ?',
    [id]
  );

  if (existing) {
    await database.runAsync(
      `UPDATE ledger_transactions SET 
        updated_at = ?,
        language = ?,
        txn_type = ?,
        party_name = ?,
        party_phone = ?,
        market_place = ?,
        fish_type = ?,
        weight_kg = ?,
        pieces = ?,
        rate_per_kg = ?,
        gross_amount = ?,
        expense_items_json = ?,
        extra_items_json = ?,
        paid_now = ?,
        due_amount = ?,
        status = ?,
        notes = ?,
        tags_json = ?
       WHERE id = ?`,
      [
        now,
        data.language || 'bn',
        data.txn_type,
        data.party_name || null,
        data.party_phone || null,
        data.market_place || null,
        data.fish_type || null,
        data.weight_kg || null,
        data.pieces || null,
        data.rate_per_kg || null,
        data.gross_amount,
        data.expense_items_json || null,
        data.extra_items_json || null,
        data.paid_now,
        data.due_amount,
        data.status,
        data.notes || null,
        data.tags_json || null,
        id
      ]
    );
  } else {
    await database.runAsync(
      `INSERT INTO ledger_transactions (
        id, created_at, updated_at, language, txn_type, party_name, party_phone,
        market_place, fish_type, weight_kg, pieces, rate_per_kg, gross_amount,
        expense_items_json, extra_items_json, paid_now, due_amount, status, notes, tags_json, archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id, now, now,
        data.language || 'bn',
        data.txn_type,
        data.party_name || null,
        data.party_phone || null,
        data.market_place || null,
        data.fish_type || null,
        data.weight_kg || null,
        data.pieces || null,
        data.rate_per_kg || null,
        data.gross_amount,
        data.expense_items_json || null,
        data.extra_items_json || null,
        data.paid_now,
        data.due_amount,
        data.status,
        data.notes || null,
        data.tags_json || null
      ]
    );
  }

  return id;
}

export async function getLedgerTransactions(
  filters: {
    txnType?: TxnType;
    status?: PaymentStatus;
    partyName?: string;
    archived?: boolean;
    fromDate?: number;
    toDate?: number;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<LedgerTransaction[]> {
  const database = await getDatabase();
  if (!database) return [];
  
  let query = 'SELECT * FROM ledger_transactions WHERE 1=1';
  const params: any[] = [];

  if (filters.txnType) {
    query += ' AND txn_type = ?';
    params.push(filters.txnType);
  }

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.partyName) {
    query += ' AND party_name LIKE ?';
    params.push(`%${filters.partyName}%`);
  }

  if (filters.archived !== undefined) {
    query += ' AND archived = ?';
    params.push(filters.archived ? 1 : 0);
  } else {
    query += ' AND archived = 0';
  }

  if (filters.search) {
    query += ' AND (party_name LIKE ? OR fish_type LIKE ? OR notes LIKE ?)';
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

  return database.getAllAsync<LedgerTransaction>(query, params);
}

export async function getLedgerTransaction(id: string): Promise<LedgerTransaction | null> {
  const database = await getDatabase();
  if (!database) return null;
  return database.getFirstAsync<LedgerTransaction>(
    'SELECT * FROM ledger_transactions WHERE id = ?',
    [id]
  );
}

export async function addPayment(
  transactionId: string,
  amount: number,
  method: string = 'cash',
  notes?: string
): Promise<string> {
  const database = await getDatabase();
  const paymentId = uuidv4();
  if (!database) return paymentId;
  
  const now = Date.now();

  await database.runAsync(
    'INSERT INTO ledger_payments (id, transaction_id, created_at, amount, method, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [paymentId, transactionId, now, amount, method, notes || null]
  );

  const totalPaid = await database.getFirstAsync<{ total: number }>(
    'SELECT SUM(amount) as total FROM ledger_payments WHERE transaction_id = ?',
    [transactionId]
  );

  const txn = await getLedgerTransaction(transactionId);
  if (txn) {
    const newPaidNow = (totalPaid?.total || 0);
    const newDue = txn.gross_amount - newPaidNow;
    let newStatus: PaymentStatus = 'DUE';
    if (newDue <= 0) {
      newStatus = 'PAID';
    } else if (newPaidNow > 0) {
      newStatus = 'PARTIAL';
    }

    await database.runAsync(
      'UPDATE ledger_transactions SET paid_now = ?, due_amount = ?, status = ?, updated_at = ? WHERE id = ?',
      [newPaidNow, Math.max(0, newDue), newStatus, now, transactionId]
    );
  }

  return paymentId;
}

export async function getPayments(transactionId: string): Promise<LedgerPayment[]> {
  const database = await getDatabase();
  if (!database) return [];
  return database.getAllAsync<LedgerPayment>(
    'SELECT * FROM ledger_payments WHERE transaction_id = ? ORDER BY created_at DESC',
    [transactionId]
  );
}

export async function archiveLedgerTransaction(id: string): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  await database.runAsync(
    'UPDATE ledger_transactions SET archived = 1, updated_at = ? WHERE id = ?',
    [Date.now(), id]
  );
}

export async function getPartyLedger(partyName: string): Promise<{
  transactions: LedgerTransaction[];
  totalDue: number;
  totalPaid: number;
}> {
  const database = await getDatabase();
  if (!database) return { transactions: [], totalDue: 0, totalPaid: 0 };
  
  const transactions = await database.getAllAsync<LedgerTransaction>(
    'SELECT * FROM ledger_transactions WHERE party_name = ? AND archived = 0 ORDER BY created_at DESC',
    [partyName]
  );

  let totalDue = 0;
  let totalPaid = 0;

  for (const txn of transactions) {
    totalDue += txn.due_amount || 0;
    totalPaid += txn.paid_now || 0;
  }

  return { transactions, totalDue, totalPaid };
}

export async function getMonthlySummary(year: number, month: number): Promise<{
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalCommissions: number;
  totalReceived: number;
  totalPaid: number;
  totalDue: number;
}> {
  const database = await getDatabase();
  const defaultSummary = {
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    totalCommissions: 0,
    totalReceived: 0,
    totalPaid: 0,
    totalDue: 0,
  };
  
  if (!database) return defaultSummary;
  
  const startOfMonth = new Date(year, month - 1, 1).getTime();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  const transactions = await database.getAllAsync<LedgerTransaction>(
    'SELECT * FROM ledger_transactions WHERE created_at >= ? AND created_at <= ? AND archived = 0',
    [startOfMonth, endOfMonth]
  );

  let totalSales = 0;
  let totalPurchases = 0;
  let totalExpenses = 0;
  let totalCommissions = 0;
  let totalReceived = 0;
  let totalPaid = 0;
  let totalDue = 0;

  for (const txn of transactions) {
    switch (txn.txn_type) {
      case 'SALE':
        totalSales += txn.gross_amount || 0;
        break;
      case 'PURCHASE':
        totalPurchases += txn.gross_amount || 0;
        break;
      case 'EXPENSE':
        totalExpenses += txn.gross_amount || 0;
        break;
      case 'COMMISSION':
        totalCommissions += txn.gross_amount || 0;
        break;
      case 'RECEIVED':
        totalReceived += txn.gross_amount || 0;
        break;
      case 'PAID':
        totalPaid += txn.gross_amount || 0;
        break;
    }
    totalDue += txn.due_amount || 0;
  }

  return {
    totalSales,
    totalPurchases,
    totalExpenses,
    totalCommissions,
    totalReceived,
    totalPaid,
    totalDue,
  };
}
