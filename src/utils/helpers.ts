import {
  KeyValuePair,
  Environment,
  PostmanEnvironmentFile,
  ImportFileType,
  Collection,
  CollectionFolder,
  HttpRequest,
  RequestBody,
  RequestAuth,
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

  if (data._postman_variable_scope === 'environment') return 'environment';
  if (data._postman_variable_scope === 'globals') return 'globals';

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
      enabled: v.enabled !== false,
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
        map.set(v.key, { ...ex, value: v.value, enabled: v.enabled });
      } else {
        map.set(v.key, v);
      }
    }
  });
  return Array.from(map.values());
};

// ============ Postman Collection → Collection (с папками) ============

/**
 * Рекурсивно парсит Postman items в папки + запросы.
 */
const parsePostmanItems = (
  items: any[]
): { folders: CollectionFolder[]; requests: HttpRequest[] } => {
  const folders: CollectionFolder[] = [];
  const requests: HttpRequest[] = [];

  items.forEach((item: any) => {
    // Папка (есть item[])
    if (Array.isArray(item.item)) {
      const parsed = parsePostmanItems(item.item);
      folders.push({
        id: generateId(),
        name: item.name || 'Untitled Folder',
        folders: parsed.folders,
        requests: parsed.requests,
      });
      return;
    }

    // Запрос
    if (item.request) {
      const req = item.request;
      const url = typeof req.url === 'string'
        ? req.url
        : req.url?.raw || '';

      // Headers
      const headers: KeyValuePair[] = (req.header || []).map((h: any) => ({
        id: generateId(),
        key: h.key || '',
        value: h.value || '',
        enabled: h.disabled !== true,
      }));

      // Query params
      const queryParams: KeyValuePair[] = (
        (typeof req.url === 'object' ? req.url?.query : null) || []
      ).map((q: any) => ({
        id: generateId(),
        key: q.key || '',
        value: q.value || '',
        enabled: q.disabled !== true,
      }));

      // Body
      let body: RequestBody = { type: 'none', content: '' };
      if (req.body) {
        if (req.body.mode === 'raw') {
          let type: RequestBody['type'] = 'raw';
          const lang = req.body.options?.raw?.language;
          if (lang === 'json') type = 'json';
          body = { type, content: req.body.raw || '' };
        } else if (req.body.mode === 'urlencoded') {
          body = {
            type: 'x-www-form-urlencoded',
            content: '',
            form: (req.body.urlencoded || []).map((f: any) => ({
              id: generateId(),
              key: f.key || '',
              value: f.value || '',
              enabled: f.disabled !== true,
            })),
          };
        } else if (req.body.mode === 'formdata') {
          body = {
            type: 'form-data',
            content: '',
            form: (req.body.formdata || []).map((f: any) => ({
              id: generateId(),
              key: f.key || '',
              value: f.value || '',
              enabled: f.disabled !== true,
            })),
          };
        } else if (req.body.mode === 'graphql') {
          body = {
            type: 'graphql',
            content: JSON.stringify({
              query: req.body.graphql?.query || '',
              variables: req.body.graphql?.variables
                ? JSON.parse(req.body.graphql.variables)
                : {},
            }, null, 2),
          };
        }
      }

      // Auth
      let auth: RequestAuth | undefined;
      if (req.auth) {
        if (req.auth.type === 'bearer') {
          auth = { type: 'bearer', token: req.auth.bearer?.[0]?.value || '' };
        } else if (req.auth.type === 'basic') {
          auth = {
            type: 'basic',
            username: req.auth.basic?.[0]?.value || '',
            password: req.auth.basic?.[1]?.value || '',
          };
        } else if (req.auth.type === 'apikey') {
          const key = req.auth.apikey?.find((x: any) => x.key === 'key')?.value || '';
          const value = req.auth.apikey?.find((x: any) => x.key === 'value')?.value || '';
          const addTo = req.auth.apikey?.find((x: any) => x.key === 'in')?.value || 'header';
          auth = { type: 'apikey', apiKey: key, apiValue: value, addTo };
        }
      }

      // Scripts
      const preRequestScript = item.event?.find((e: any) => e.listen === 'prerequest')?.script?.exec?.join('\n') || '';
      const testScript = item.event?.find((e: any) => e.listen === 'test')?.script?.exec?.join('\n') || '';

      requests.push({
        id: generateId(),
        name: item.name || 'Untitled Request',
        method: (req.method || 'GET').toUpperCase(),
        url,
        headers,
        queryParams,
        body,
        auth,
        scripts: (preRequestScript || testScript)
          ? { preRequest: preRequestScript, test: testScript }
          : undefined,
      });
    }
  });

  return { folders, requests };
};

/**
 * Конвертирует Postman Collection в формат приложения (с папками).
 */
export const convertPostmanCollectionToApp = (data: any): Collection => {
  const parsed = parsePostmanItems(data.item || []);
  return {
    id: generateId(),
    name: data.info?.name || 'Imported Collection',
    folders: parsed.folders,
    requests: parsed.requests,
  };
};