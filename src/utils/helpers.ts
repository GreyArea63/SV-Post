import { KeyValuePair } from '../types';

export const generateId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// ИСПРАВЛЕНИЕ 1.1: Убран третий параметр, теперь только 2 аргумента
export const replaceVariables = (
  text: string,
  variables: KeyValuePair[]
): string => {
  let result = text;
  
  // Сортируем по длине ключа (сначала длинные), чтобы заменять {{base_url}} до {{base}}
  const sortedVars = [...variables].sort((a, b) => b.key.length - a.key.length);
  
  sortedVars.forEach(variable => {
    if (variable.enabled && variable.key) {
      const regex = new RegExp(`{{${variable.key.trim()}}}`, 'g');
      result = result.replace(regex, variable.value);
    }
  });
  
  return result;
};

export const parseKeyValuePairs = (pairs: KeyValuePair[]) => {
  const result: Record<string, string> = {};
  pairs.forEach(pair => {
    if (pair.enabled && pair.key) {
      result[pair.key] = pair.value;
    }
  });
  return result;
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

export const findVariablesInText = (text: string): string[] => {
  const regex = /{{([^}]+)}}/g;
  const matches: string[] = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  
  return matches;
};

export const isVariableResolved = (
  variableName: string,
  variables: KeyValuePair[]
) => {
  const variable = variables.find(
    v => v.enabled && v.key.trim() === variableName.trim()
  );
  
  return {
    resolved: !!variable && variable.value !== '',
    value: variable?.value || '',
  };
};

export const escapeRegex = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};