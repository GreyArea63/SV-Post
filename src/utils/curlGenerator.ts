import { HttpRequest, KeyValuePair, Environment } from '../types';
import { replaceVariables } from './helpers';

interface GenerateOptions {
  /** pretty — с переносами строк, compact — в одну строку */
  format?: 'pretty' | 'compact';
  /** Активное окружение (для подстановки переменных) */
  environment?: Environment | null;
  /** Глобальные переменные */
  globals?: KeyValuePair[];
  /** Подставлять ли переменные {{var}}. Если false — оставить как есть */
  resolveVariables?: boolean;
  /** Добавлять --location при followRedirects */
  includeLocation?: boolean;
}

const shellEscape = (value: string, useDoubleQuotes = false): string => {
  if (value === '') return "''";

  if (useDoubleQuotes) {
    // В двойных кавычках экранируем \ " $ `
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
    return `"${escaped}"`;
  }

  // Одинарные кавычки: значение оборачивается в '...',
  // каждая внутренняя ' заменяется на '\''
  // Если значение содержит одиночную кавычку — используем комбинированный вариант
  if (value.includes("'")) {
    // 'foo'\''bar'
    return "'" + value.replace(/'/g, "'\\''") + "'";
  }
  return `'${value}'`;
};

const shouldQuote = (value: string): boolean => {
  if (value === '') return true;
  // Безопасные символы — можно без кавычек
  return !/^[a-zA-Z0-9_\-.,:\/@+=%]+$/.test(value);
};

const escapeArg = (value: string): string => {
  if (shouldQuote(value)) {
    // Если есть одинарные кавычки, но нет двойных — используем двойные
    if (value.includes("'") && !value.includes('"') && !value.includes('$') && !value.includes('`') && !value.includes('\\')) {
      return `"${value}"`;
    }
    return shellEscape(value, false);
  }
  return value;
};

const resolveUrl = (
  request: HttpRequest,
  vars: KeyValuePair[],
  resolveVariables: boolean
): string => {
  let url = request.url;

  // Добавляем queryParams
  const enabledParams = request.queryParams.filter(p => p.enabled && p.key);
  if (enabledParams.length > 0) {
    const query = enabledParams
      .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    const sep = url.includes('?') ? '&' : '?';
    url = url + sep + query;
  }

  if (resolveVariables) {
    url = replaceVariables(url, vars);
  }
  return url;
};

const buildAuthArgs = (
  request: HttpRequest,
  vars: KeyValuePair[],
  resolveVariables: boolean
): string[] => {
  const args: string[] = [];
  if (!request.auth || request.auth.type === 'noauth' || request.auth.type === 'none') {
    return args;
  }

  const resolve = (v?: string) => {
    if (!v) return v ?? '';
    return resolveVariables ? replaceVariables(v, vars) : v;
  };

  if (request.auth.type === 'basic' && request.auth.username) {
    const user = resolve(request.auth.username);
    const pass = resolve(request.auth.password) || '';
    args.push('-u', escapeArg(`${user}:${pass}`));
  } else if (request.auth.type === 'bearer' && request.auth.token) {
    const token = resolve(request.auth.token);
    args.push('-H', escapeArg(`Authorization: Bearer ${token}`));
  } else if (request.auth.type === 'apikey' && request.auth.apiKey && request.auth.apiValue) {
    const key = resolve(request.auth.apiKey);
    const value = resolve(request.auth.apiValue);
    if (request.auth.addTo === 'header') {
      args.push('-H', escapeArg(`${key}: ${value}`));
    } else {
      // queryParams — уже не в URL, добавим отдельным флагом невозможно,
      // поэтому добавляем как есть в query (можно было бы добавить в url)
      // Для простоты — не поддерживаем тут, пользователь сам добавит в Params
    }
  } else if (request.auth.type === 'oauth2' && request.auth.accessToken) {
    const token = resolve(request.auth.accessToken);
    const type = request.auth.tokenType || 'Bearer';
    args.push('-H', escapeArg(`Authorization: ${type} ${token}`));
  }

  return args;
};

/**
 * Генерирует curl-команду из HttpRequest.
 */
export const generateCurl = (
  request: HttpRequest,
  options: GenerateOptions = {}
): string => {
  const {
    format = 'pretty',
    environment = null,
    globals = [],
    resolveVariables = true,
    includeLocation = true,
  } = options;

  const vars: KeyValuePair[] = [
    ...globals.filter(g => g.enabled),
    ...(environment?.variables.filter(v => v.enabled) || []),
  ];

  const resolve = (v: string) => (resolveVariables ? replaceVariables(v, vars) : v);

  const parts: string[] = ['curl'];

  // Метод
  if (request.method && request.method.toUpperCase() !== 'GET') {
    parts.push('-X', request.method.toUpperCase());
  }

  // URL
  const url = resolveUrl(request, vars, resolveVariables);
  parts.push(escapeArg(url));

  // followRedirects
  if (includeLocation && request.settings?.followRedirects) {
    parts.push('--location');
  }

  // Headers
  request.headers
    .filter(h => h.enabled && h.key)
    .forEach(h => {
      const key = h.key.trim();
      const value = resolve(h.value);
      parts.push('-H', escapeArg(`${key}: ${value}`));
    });

  // Auth
  const authArgs = buildAuthArgs(request, vars, resolveVariables);
  parts.push(...authArgs);

  // User-Agent из settings (если не передан в headers)
  if (request.settings?.userAgent) {
    const hasUa = request.headers.some(
      h => h.enabled && h.key.toLowerCase() === 'user-agent'
    );
    if (!hasUa) {
      parts.push('-A', escapeArg(resolve(request.settings.userAgent)));
    }
  }

  // Body
  const body = request.body;
  if (body && body.type !== 'none') {
    if (body.type === 'form-data' && body.form && body.form.length > 0) {
      body.form
        .filter(f => f.enabled && f.key)
        .forEach(f => {
          parts.push('-F', escapeArg(`${f.key}=${resolve(f.value)}`));
        });
    } else if (body.type === 'x-www-form-urlencoded' && body.form && body.form.length > 0) {
      const encoded = body.form
        .filter(f => f.enabled && f.key)
        .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(resolve(f.value))}`)
        .join('&');
      parts.push('--data-raw', escapeArg(encoded));
    } else if (body.type === 'binary') {
      parts.push('--data-binary', escapeArg(resolve(body.content)));
    } else if (body.type === 'graphql') {
      parts.push('--data-raw', escapeArg(resolve(body.content)));
    } else {
      // raw, json
      if (body.content) {
        parts.push('--data-raw', escapeArg(resolve(body.content)));
      }
    }
  }

  // Сборка
  if (format === 'compact') {
    return parts.join(' ');
  }

  // pretty: группируем флаги с их значениями
  const lines: string[] = [];
  let i = 0;
  while (i < parts.length) {
    const token = parts[i];
    if (token.startsWith('-') && i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
      lines.push(`${token} ${parts[i + 1]}`);
      i += 2;
    } else {
      lines.push(token);
      i += 1;
    }
  }

  if (lines.length === 0) return 'curl';
  return lines
    .map((line, idx) => (idx === 0 ? line : `  ${line}`))
    .join(' \\\n');
};