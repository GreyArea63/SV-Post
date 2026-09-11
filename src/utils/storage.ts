import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Collection, Environment, HistoryItem, KeyValuePair } from '../types';

interface SVPostDB extends DBSchema {
  collections: { key: string; value: { id: string; data: Collection[] } };
  environments: { key: string; value: { id: string; data: Environment[] } };
  globals: { key: string; value: { id: string; data: KeyValuePair[] } };
  history: { key: string; value: { id: string; data: HistoryItem[] } };
  activeEnv: { key: string; value: { id: string; envId: string | null } };
}

const DB_NAME = 'sv-post-db';
const DB_VERSION = 1;
let dbInstance: IDBPDatabase<SVPostDB> | null = null;

const getDB = async (): Promise<IDBPDatabase<SVPostDB>> => {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<SVPostDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('collections')) db.createObjectStore('collections', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('environments')) db.createObjectStore('environments', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('globals')) db.createObjectStore('globals', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('activeEnv')) db.createObjectStore('activeEnv', { keyPath: 'id' });
    },
  });
  return dbInstance;
};

const DEFAULT_ID = 'default';

const migrateFromLocalStorage = async () => {
  try {
    if (localStorage.getItem('sv-post-migrated')) return;
    const db = await getDB();
    const tx = db.transaction(['collections', 'environments', 'globals', 'history', 'activeEnv'], 'readwrite');

    const cols = localStorage.getItem('sv-post-collections');
    if (cols) await tx.store('collections').put({ id: DEFAULT_ID, data: JSON.parse(cols) });

    const envs = localStorage.getItem('sv-post-environments');
    if (envs) await tx.store('environments').put({ id: DEFAULT_ID, data: JSON.parse(envs) });

    const globs = localStorage.getItem('sv-post-globals');
    if (globs) await tx.store('globals').put({ id: DEFAULT_ID, data: JSON.parse(globs) });

    const hist = localStorage.getItem('sv-post-history');
    if (hist) await tx.store('history').put({ id: DEFAULT_ID, data: JSON.parse(hist) });

    const active = localStorage.getItem('sv-post-active-env');
    if (active) await tx.store('activeEnv').put({ id: DEFAULT_ID, envId: active });

    await tx.done;
    localStorage.setItem('sv-post-migrated', 'true');
    console.log('✅ Данные мигрированы в IndexedDB');
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
  }
};
migrateFromLocalStorage();

export const storage = {
  getCollections: async () => { const db = await getDB(); const item = await db.get('collections', DEFAULT_ID); return item?.data || []; },
  saveCollections: async (data: Collection[]) => { try { const db = await getDB(); await db.put('collections', { id: DEFAULT_ID, data }); return true; } catch { return false; } },
  
  getEnvironments: async () => { const db = await getDB(); const item = await db.get('environments', DEFAULT_ID); return item?.data || []; },
  saveEnvironments: async (data: Environment[]) => { try { const db = await getDB(); await db.put('environments', { id: DEFAULT_ID, data }); return true; } catch { return false; } },
  
  getGlobalVariables: async () => { const db = await getDB(); const item = await db.get('globals', DEFAULT_ID); return item?.data || []; },
  saveGlobalVariables: async (data: KeyValuePair[]) => { try { const db = await getDB(); await db.put('globals', { id: DEFAULT_ID, data }); return true; } catch { return false; } },
  
  getActiveEnvironment: async () => { const db = await getDB(); const item = await db.get('activeEnv', DEFAULT_ID); return item?.envId || null; },
  setActiveEnvironment: async (envId: string | null) => { const db = await getDB(); await db.put('activeEnv', { id: DEFAULT_ID, envId }); },
  
  getHistory: async () => { const db = await getDB(); const item = await db.get('history', DEFAULT_ID); return item?.data || []; },
  saveHistory: async (data: HistoryItem[]) => { try { const db = await getDB(); await db.put('history', { id: DEFAULT_ID, data: data.slice(0, 100) }); return true; } catch { return false; } },
  
  clearAllData: async () => {
    const db = await getDB();
    await Promise.all(['collections', 'environments', 'globals', 'history', 'activeEnv'].map(store => db.clear(store as any)));
  },
  clearHistory: async () => { const db = await getDB(); await db.clear('history'); },
  
  getStorageStats: async () => {
    const db = await getDB();
    const [c, h, e, g] = await Promise.all([db.get('collections', DEFAULT_ID), db.get('history', DEFAULT_ID), db.get('environments', DEFAULT_ID), db.get('globals', DEFAULT_ID)]);
    const size = (d: any) => d ? JSON.stringify(d).length : 0;
    return { totalSize: size(c)+size(h)+size(e)+size(g), collections: size(c), history: size(h), environments: size(e), globals: size(g) };
  }
};