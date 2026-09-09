import { Collection, Environment, HistoryItem, KeyValuePair } from '../types';

const STORAGE_KEYS = {
  COLLECTIONS: 'sv-post-collections',
  ENVIRONMENTS: 'sv-post-environments',
  GLOBALS: 'sv-post-globals',
  HISTORY: 'sv-post-history',
  ACTIVE_ENV: 'sv-post-active-env',
};

export const storage = {
  getCollections: (): Collection[] => {
    const data = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
    return data ? JSON.parse(data) : [];
  },

  saveCollections: (collections: Collection[]) => {
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));
  },

  getEnvironments: (): Environment[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ENVIRONMENTS);
    return data ? JSON.parse(data) : [];
  },

  saveEnvironments: (environments: Environment[]) => {
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENTS, JSON.stringify(environments));
  },

  getGlobalVariables: (): KeyValuePair[] => {
    const data = localStorage.getItem(STORAGE_KEYS.GLOBALS);
    return data ? JSON.parse(data) : [];
  },

  saveGlobalVariables: (variables: KeyValuePair[]) => {
    localStorage.setItem(STORAGE_KEYS.GLOBALS, JSON.stringify(variables));
  },

  getActiveEnvironment: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_ENV);
  },

  setActiveEnvironment: (envId: string | null) => {
    if (envId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ENV, envId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_ENV);
    }
  },

  getHistory: (): HistoryItem[] => {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
  },

  saveHistory: (history: HistoryItem[]) => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  },

  addToHistory: (item: HistoryItem) => {
    const history = storage.getHistory();
    history.unshift(item);
    const limitedHistory = history.slice(0, 100);
    storage.saveHistory(limitedHistory);
  },
};