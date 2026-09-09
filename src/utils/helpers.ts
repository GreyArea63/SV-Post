import { KeyValuePair } from '../types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const formatJSON = (data: any): string => {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

export const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const formatTime = (ms: number): string => {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

export const replaceVariables = (text: string, variables: KeyValuePair[]): string => {
  if (!text) return text;
  let result = text;
  variables.forEach(v => {
    if (v.enabled && v.key) {
      const regex = new RegExp(`\\{\\{${escapeRegex(v.key)}\\}\\}`, 'g');
      result = result.replace(regex, v.value);
    }
  });
  return result;
};

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const parseKeyValuePairs = (pairs: KeyValuePair[]): Record<string, string> => {
  const result: Record<string, string> = {};
  pairs.forEach(pair => {
    if (pair.enabled && pair.key) {
      result[pair.key] = pair.value;
    }
  });
  return result;
};

// Находит все переменные в тексте ({{variable}})
export const findVariablesInText = (text: string): string[] => {
  if (!text) return [];
  const matches = text.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return matches.map(m => m.slice(2, -2));
};

// Проверяет, разрешена ли переменная
export const isVariableResolved = (
  varName: string,
  envVariables: KeyValuePair[],
  globalVariables: KeyValuePair[]
): { resolved: boolean; value: string | null } => {
  // Сначала ищем в окружении
  const envVar = envVariables.find(v => v.key === varName && v.enabled);
  if (envVar) return { resolved: true, value: envVar.value };
  
  // Потом в глобальных
  const globalVar = globalVariables.find(v => v.key === varName && v.enabled);
  if (globalVar) return { resolved: true, value: globalVar.value };
  
  return { resolved: false, value: null };
};