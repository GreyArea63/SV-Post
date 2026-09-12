import { Collection, HistoryItem, Environment, KeyValuePair } from '../types';

const DB_NAME = 'sv-post-db';
const DB_VERSION = 1;
const DEFAULT_ID = 'default';

const STORES = {
  collections: 'collections',
  history: 'history',
  environments: 'environments',
  globals: 'globals',
  activeEnv: 'activeEnv',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;
let migrationPromise: Promise<void> | null = null;

/**
 * Получает или создаёт экземпляр IndexedDB
 */
const getDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.collections)) {
        db.createObjectStore(STORES.collections, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.history)) {
        db.createObjectStore(STORES.history, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.environments)) {
        db.createObjectStore(STORES.environments, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.globals)) {
        db.createObjectStore(STORES.globals, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.activeEnv)) {
        db.createObjectStore(STORES.activeEnv, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

/**
 * Ленивая миграция — выполняется один раз при первом чтении
 */
const ensureMigrated = (): Promise<void> => {
  if (!migrationPromise) {
    migrationPromise = migrateFromLocalStorage().catch((err) => {
      console.error('Migration failed:', err);
      migrationPromise = null;
    });
  }
  return migrationPromise;
};

/**
 * Миграция данных из localStorage в IndexedDB
 */
const migrateFromLocalStorage = async (): Promise<void> => {
  const db = await getDB();

  try {
    const cols = localStorage.getItem('collections');
    if (cols) {
      try {
        const data = JSON.parse(cols);
        await db.transaction(STORES.collections, 'readwrite').objectStore(STORES.collections).put({ id: DEFAULT_ID, data });
      } catch (e) {
        console.error('Failed to parse collections from localStorage:', e);
      }
    }

    const envs = localStorage.getItem('environments');
    if (envs) {
      try {
        const data = JSON.parse(envs);
        await db.transaction(STORES.environments, 'readwrite').objectStore(STORES.environments).put({ id: DEFAULT_ID, data });
      } catch (e) {
        console.error('Failed to parse environments from localStorage:', e);
      }
    }

    const globs = localStorage.getItem('globals');
    if (globs) {
      try {
        const data = JSON.parse(globs);
        await db.transaction(STORES.globals, 'readwrite').objectStore(STORES.globals).put({ id: DEFAULT_ID, data });
      } catch (e) {
        console.error('Failed to parse globals from localStorage:', e);
      }
    }

    const hist = localStorage.getItem('history');
    if (hist) {
      try {
        const data = JSON.parse(hist);
        await db.transaction(STORES.history, 'readwrite').objectStore(STORES.history).put({ id: DEFAULT_ID, data });
      } catch (e) {
        console.error('Failed to parse history from localStorage:', e);
      }
    }

    const active = localStorage.getItem('activeEnv');
    if (active) {
      await db.transaction(STORES.activeEnv, 'readwrite').objectStore(STORES.activeEnv).put({ id: DEFAULT_ID, envId: active });
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
};

/**
 * Получение данных из хранилища
 */
const getStoreData = async (storeName: StoreName): Promise<any> => {
  const db = await getDB();
  await ensureMigrated();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(DEFAULT_ID);

    request.onsuccess = () => {
      resolve(request.result?.data ?? null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Сохранение данных в хранилище
 */
const setStoreData = async (storeName: StoreName, data: any): Promise<boolean> => {
  const db = await getDB();

  try {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    await store.put({ id: DEFAULT_ID, data });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (error) {
    console.error(`Failed to save to ${storeName}:`, error);
    return false;
  }
};

// ========== Collections ==========

export const getCollections = async (): Promise<Collection[]> => {
  try {
    const data = await getStoreData(STORES.collections);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to get collections:', error);
    return [];
  }
};

export const saveCollections = async (collections: Collection[]): Promise<boolean> => {
  return setStoreData(STORES.collections, collections);
};

// ========== History ==========

export const getHistory = async (): Promise<HistoryItem[]> => {
  try {
    const data = await getStoreData(STORES.history);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to get history:', error);
    return [];
  }
};

export const saveHistory = async (history: HistoryItem[]): Promise<boolean> => {
  return setStoreData(STORES.history, history);
};

export const clearHistory = async (): Promise<boolean> => {
  return setStoreData(STORES.history, []);
};

// ========== Environments ==========

export const getEnvironments = async (): Promise<Environment[]> => {
  try {
    const data = await getStoreData(STORES.environments);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to get environments:', error);
    return [];
  }
};

export const saveEnvironments = async (environments: Environment[]): Promise<boolean> => {
  return setStoreData(STORES.environments, environments);
};

// ========== Global Variables ==========

export const getGlobalVariables = async (): Promise<KeyValuePair[]> => {
  try {
    const data = await getStoreData(STORES.globals);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to get global variables:', error);
    return [];
  }
};

export const saveGlobalVariables = async (variables: KeyValuePair[]): Promise<boolean> => {
  return setStoreData(STORES.globals, variables);
};

// ========== Active Environment ==========

export const getActiveEnvironment = async (): Promise<string | null> => {
  const db = await getDB();
  await ensureMigrated();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.activeEnv, 'readonly');
    const store = tx.objectStore(STORES.activeEnv);
    const request = store.get(DEFAULT_ID);

    request.onsuccess = () => {
      resolve(request.result?.envId ?? null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const setActiveEnvironment = async (envId: string | null): Promise<boolean> => {
  const db = await getDB();

  try {
    const tx = db.transaction(STORES.activeEnv, 'readwrite');
    const store = tx.objectStore(STORES.activeEnv);
    await store.put({ id: DEFAULT_ID, envId: envId ?? '' });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (error) {
    console.error('Failed to set active environment:', error);
    return false;
  }
};

// ========== Clear All ==========

export const clearAllData = async (): Promise<boolean> => {
  const db = await getDB();
  const storeNames: StoreName[] = Object.values(STORES) as StoreName[];

  try {
    const tx = db.transaction(storeNames, 'readwrite');
    await Promise.all(
      storeNames.map((storeName) => {
        return new Promise<void>((resolve, reject) => {
          const store = tx.objectStore(storeName);
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      })
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (error) {
    console.error('Failed to clear all data:', error);
    return false;
  }
};

// ========== Storage Stats ==========

export const getStorageStats = async (): Promise<{
  totalSize: number;
  collections: number;
  history: number;
  environments: number;
}> => {
  try {
    const collections = await getCollections();
    const history = await getHistory();
    const environments = await getEnvironments();

    // Считаем только данные, без служебных полей
    const collectionsSize = new Blob([JSON.stringify(collections)]).size;
    const historySize = new Blob([JSON.stringify(history)]).size;
    const environmentsSize = new Blob([JSON.stringify(environments)]).size;

    return {
      totalSize: collectionsSize + historySize + environmentsSize,
      collections: collectionsSize,
      history: historySize,
      environments: environmentsSize,
    };
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return { totalSize: 0, collections: 0, history: 0, environments: 0 };
  }
};

// ========== Storage Object ==========

export const storage = {
  getCollections,
  saveCollections,
  getHistory,
  saveHistory,
  clearHistory,
  getEnvironments,
  saveEnvironments,
  getGlobalVariables,
  saveGlobalVariables,
  getActiveEnvironment,
  setActiveEnvironment,
  clearAllData,
  getStorageStats,
};