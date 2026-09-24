import { Collection, HistoryItem, Environment, KeyValuePair } from '../types';

const DB_NAME = 'sv-post-db';
const DB_VERSION = 1;
const DEFAULT_ID = 'default';
const TRANSACTION_TIMEOUT = 10000;

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
let isCorrupted = false;
let isOpening = false;

export const isDatabaseCorrupted = (): boolean => isCorrupted;

/**
 * Получает или создаёт экземпляр IndexedDB с улучшенной обработкой ошибок
 */
const getDB = (): Promise<IDBDatabase> => {
  if (dbInstance && dbInstance.objectStoreNames.length > 0) {
    return Promise.resolve(dbInstance);
  }

  if (isOpening) {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (dbInstance) {
          clearInterval(checkInterval);
          resolve(dbInstance);
        } else if (!isOpening && !dbInstance) {
          clearInterval(checkInterval);
          getDB().then(resolve).catch(reject);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for DB to open'));
      }, TRANSACTION_TIMEOUT);
    });
  }

  isOpening = true;

  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      isOpening = false;
      isCorrupted = true;
      reject(err);
      return;
    }

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
      const db = (event.target as IDBOpenDBRequest).result;
      dbInstance = db;
      isOpening = false;
      isCorrupted = false;

      db.onversionchange = () => {
        console.warn('IndexedDB versionchange detected, closing connection');
        db.close();
        dbInstance = null;
      };

      db.onclose = () => {
        console.warn('IndexedDB connection closed unexpectedly');
        dbInstance = null;
      };

      resolve(db);
    };

    request.onerror = (event) => {
      isOpening = false;
      const error = (event.target as IDBOpenDBRequest).error;
      if (error?.name !== 'VersionError') {
        console.error('Failed to open IndexedDB:', error);
      }
      reject(error);
    };

    request.onblocked = () => {
      isOpening = false;
      console.warn(
        'IndexedDB open blocked. Close other app instances or tabs. Retrying in 1s...'
      );
      setTimeout(() => {
        getDB().then(resolve).catch(reject);
      }, 1000);
    };
  });
};

/**
 * Полностью удаляет и пересоздаёт базу данных
 */
export const resetDatabase = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }

    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => {
      console.log('Database deleted successfully');
      isCorrupted = false;
      migrationPromise = null;
      isOpening = false;
      resolve();
    };

    request.onerror = (event) => {
      console.error('Failed to delete database:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };

    request.onblocked = () => {
      console.warn('Database deletion blocked. Retrying...');
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
      }
      setTimeout(() => {
        resetDatabase().then(resolve).catch(reject);
      }, 500);
    };
  });
};

/**
 * Ленивая миграция — выполняется один раз при первом чтении
 */
const ensureMigrated = async (): Promise<void> => {
  if (isCorrupted) {
    throw new Error('Database is corrupted. Please reset it.');
  }

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
        const tx = db.transaction(STORES.collections, 'readwrite');
        tx.objectStore(STORES.collections).put({ id: DEFAULT_ID, data });
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {
        console.error('Failed to parse collections from localStorage:', e);
      }
    }

    const envs = localStorage.getItem('environments');
    if (envs) {
      try {
        const data = JSON.parse(envs);
        const tx = db.transaction(STORES.environments, 'readwrite');
        tx.objectStore(STORES.environments).put({ id: DEFAULT_ID, data });
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {
        console.error('Failed to parse environments from localStorage:', e);
      }
    }

    const globs = localStorage.getItem('globals');
    if (globs) {
      try {
        const data = JSON.parse(globs);
        const tx = db.transaction(STORES.globals, 'readwrite');
        tx.objectStore(STORES.globals).put({ id: DEFAULT_ID, data });
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {
        console.error('Failed to parse globals from localStorage:', e);
      }
    }

    const hist = localStorage.getItem('history');
    if (hist) {
      try {
        const data = JSON.parse(hist);
        const tx = db.transaction(STORES.history, 'readwrite');
        tx.objectStore(STORES.history).put({ id: DEFAULT_ID, data });
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (e) {
        console.error('Failed to parse history from localStorage:', e);
      }
    }

    const active = localStorage.getItem('activeEnv');
    if (active) {
      const tx = db.transaction(STORES.activeEnv, 'readwrite');
      tx.objectStore(STORES.activeEnv).put({ id: DEFAULT_ID, envId: active });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
};

/**
 * Получение данных из хранилища
 */
const getStoreData = async (storeName: StoreName): Promise<any> => {
  try {
    const db = await getDB();
    await ensureMigrated();

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(DEFAULT_ID);

        const timeout = setTimeout(() => {
          reject(new Error(`Timeout reading from ${storeName}`));
        }, TRANSACTION_TIMEOUT);

        request.onsuccess = () => {
          clearTimeout(timeout);
          resolve(request.result?.data ?? null);
        };

        request.onerror = () => {
          clearTimeout(timeout);
          console.error(`Failed to get data from ${storeName}:`, request.error);
          reject(request.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  } catch (error) {
    console.error(`Error accessing ${storeName}:`, error);
    throw error;
  }
};

/**
 * Сохранение данных в хранилище
 */
const setStoreData = async (storeName: StoreName, data: any): Promise<boolean> => {
  try {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put({ id: DEFAULT_ID, data });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout writing to ${storeName}`));
      }, TRANSACTION_TIMEOUT);

      tx.oncomplete = () => {
        clearTimeout(timeout);
        resolve();
      };
      tx.onerror = () => {
        clearTimeout(timeout);
        reject(tx.error);
      };
      tx.onabort = () => {
        clearTimeout(timeout);
        reject(tx.error || new Error('Transaction aborted'));
      };
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
  try {
    const db = await getDB();
    await ensureMigrated();

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORES.activeEnv, 'readonly');
        const store = tx.objectStore(STORES.activeEnv);
        const request = store.get(DEFAULT_ID);

        const timeout = setTimeout(() => {
          reject(new Error('Timeout reading active environment'));
        }, TRANSACTION_TIMEOUT);

        request.onsuccess = () => {
          clearTimeout(timeout);
          resolve(request.result?.envId ?? null);
        };

        request.onerror = () => {
          clearTimeout(timeout);
          reject(request.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  } catch (error) {
    console.error('Failed to get active environment:', error);
    return null;
  }
};

export const setActiveEnvironment = async (envId: string | null): Promise<boolean> => {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.activeEnv, 'readwrite');
    const store = tx.objectStore(STORES.activeEnv);
    store.put({ id: DEFAULT_ID, envId: envId ?? '' });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout setting active environment'));
      }, TRANSACTION_TIMEOUT);

      tx.oncomplete = () => {
        clearTimeout(timeout);
        resolve();
      };
      tx.onerror = () => {
        clearTimeout(timeout);
        reject(tx.error);
      };
    });

    return true;
  } catch (error) {
    console.error('Failed to set active environment:', error);
    return false;
  }
};

// ========== Clear All ==========
export const clearAllData = async (): Promise<boolean> => {
  try {
    const db = await getDB();
    const storeNames: StoreName[] = Object.values(STORES) as StoreName[];

    const tx = db.transaction(storeNames, 'readwrite');
    storeNames.forEach((storeName) => {
      tx.objectStore(storeName).clear();
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout clearing all data'));
      }, TRANSACTION_TIMEOUT);

      tx.oncomplete = () => {
        clearTimeout(timeout);
        resolve();
      };
      tx.onerror = () => {
        clearTimeout(timeout);
        reject(tx.error);
      };
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
  resetDatabase,
  isDatabaseCorrupted,
};