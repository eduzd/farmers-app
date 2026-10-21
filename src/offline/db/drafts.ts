import { getDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';

export interface Draft {
  id: string;
  screen_type: string;
  data_json: string;
  updated_at: number;
}

export async function saveDraft(screenType: string, data: any): Promise<string> {
  const database = await getDatabase();
  if (!database) return uuidv4();
  
  const now = Date.now();
  
  const existing = await database.getFirstAsync<Draft>(
    'SELECT * FROM drafts WHERE screen_type = ?',
    [screenType]
  );

  if (existing) {
    await database.runAsync(
      'UPDATE drafts SET data_json = ?, updated_at = ? WHERE screen_type = ?',
      [JSON.stringify(data), now, screenType]
    );
    return existing.id;
  } else {
    const id = uuidv4();
    await database.runAsync(
      'INSERT INTO drafts (id, screen_type, data_json, updated_at) VALUES (?, ?, ?, ?)',
      [id, screenType, JSON.stringify(data), now]
    );
    return id;
  }
}

export async function getDraft(screenType: string): Promise<any | null> {
  const database = await getDatabase();
  if (!database) return null;
  
  const draft = await database.getFirstAsync<Draft>(
    'SELECT * FROM drafts WHERE screen_type = ?',
    [screenType]
  );
  
  if (draft) {
    try {
      return JSON.parse(draft.data_json);
    } catch {
      return null;
    }
  }
  return null;
}

export async function deleteDraft(screenType: string): Promise<void> {
  const database = await getDatabase();
  if (!database) return;
  await database.runAsync(
    'DELETE FROM drafts WHERE screen_type = ?',
    [screenType]
  );
}

export async function getAllDrafts(): Promise<Draft[]> {
  const database = await getDatabase();
  if (!database) return [];
  return database.getAllAsync<Draft>(
    'SELECT * FROM drafts ORDER BY updated_at DESC'
  );
}
