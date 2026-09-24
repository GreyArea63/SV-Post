import {
  KeyValuePair,
  Environment,
  PostmanEnvironmentFile,
  ImportFileType,
} from '../types';

// ИСПРАВЛЕНИЕ 3.1: используем crypto.randomUUID() вместо Math.random()
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback для старых браузеров
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const escapeRegex = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const replaceVariables = (
  text: string,
  variables: KeyValuePair[]
): string => {
  if (!text) return text;
  let result = text;
  const sortedVars = [...variables]
    .filter(v => v.enabled && v.key)
    .sort((a, b) => b.key.length - a.key.length);
  sortedVars.forEach(variable => {
    const escapedKey = escapeRegex(variable.key.trim());
    const regex = new RegExp(`{{${escapedKey}}}`, 'g');
    result = result.replace(regex, variable.value);
  });
  return result;
};

export const parseKeyValuePairs = (pairs: KeyValuePair[]): Record<string, string> => {
  const result: Record<string, string> = {};
  const seenKeys = new Set<string>();
  pairs.forEach(pair => {
    if (pair.enabled && pair.key) {
      let finalKey = pair.key;
      if (seenKeys.has(pair.key)) {
        let counter = 2;
        while (seenKeys.has(`${pair.key}_${counter}`)) {
          counter++;
        }
        finalKey = `${pair.key}_${counter}`;
      }
      seenKeys.add(finalKey);
      result[finalKey] = pair.value;
    }
  });
  return result;
};

export const parseKeyValuePairsToArray = (pairs: KeyValuePair[]): [string, string][] => {
  return pairs
    .filter(p => p.enabled && p.key)
    .map(p => [p.key, p.value]);
};

export const formatJSON = (data: any) => {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

export const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatTime = (ms: number) => {
  if (ms < 0) ms = 0;
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

export const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const findVariablesInText = (text: string): string[] => {
  if (!text) return [];
  const regex = /{{([^}]+)}}/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1].trim();
    if (key && !matches.includes(key)) {
      matches.push(key);
    }
  }
  return matches;
};

export const isVariableResolved = (
  variableName: string,
  variables: KeyValuePair[]
) => {
  const trimmedName = variableName.trim();
  const variable = variables.find(
    v => v.enabled && v.key.trim() === trimmedName
  );
  return {
    resolved: !!variable && variable.value !== '',
    value: variable?.value || '',
  };
};

// ============ Postman Import Helpers ============

/**
 * Определяет тип файла Postman по его содержимому.
 */
export const detectPostmanFileType = (data: any): ImportFileType => {
  if (!data || typeof data !== 'object') return 'unknown';

  // Environment или Globals (новый формат Postman)
  if (data._postman_variable_scope === 'environment') return 'environment';
  if (data._postman_variable_scope === 'globals') return 'globals';

  // Collection (v2.1 формат)
  if (data.info && typeof data.info.schema === 'string' && data.info.schema.includes('collection')) {
    return 'collection';
  }
  if (Array.isArray(data.item) && data.info?.name) {
    return 'collection';
  }

  return 'unknown';
};

/**
 * Конвертирует Postman Environment во внутренний формат приложения.
 */
export const convertPostmanEnvToApp = (postmanEnv: PostmanEnvironmentFile): Environment => {
  return {
    id: generateId(),
    name: postmanEnv.name || 'Imported Environment',
    variables: (postmanEnv.values || []).map(v => ({
      id: generateId(),
      key: v.key || '',
      value: typeof v.value === 'string' ? v.value : String(v.value ?? ''),
      enabled: v.enabled !== false, // по умолчанию true
    })),
  };
};

/**
 * Конвертирует Postman Globals в массив KeyValuePair.
 */
export const convertPostmanGlobalsToApp = (
  postmanGlobals: PostmanEnvironmentFile
): KeyValuePair[] => {
  return (postmanGlobals.values || []).map(v => ({
    id: generateId(),
    key: v.key || '',
    value: typeof v.value === 'string' ? v.value : String(v.value ?? ''),
    enabled: v.enabled !== false,
  }));
};

/**
 * Мерджит новые глобальные переменные с существующими.
 * Если ключ уже есть — перезаписывает значение.
 */
export const mergeGlobals = (
  existing: KeyValuePair[],
  incoming: KeyValuePair[]
): KeyValuePair[] => {
  const map = new Map<string, KeyValuePair>();
  existing.forEach(v => {
    if (v.key) map.set(v.key, v);
  });
  incoming.forEach(v => {
    if (v.key) {
      const ex = map.get(v.key);
      if (ex) {
        // Перезаписываем значение, сохраняя ID
        map.set(v.key, { ...ex, value: v.value, enabled: v.enabled });
      } else {
        map.set(v.key, v);
      }
    }
  });
  return Array.from(map.values());
};