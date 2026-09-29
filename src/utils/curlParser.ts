import { HttpRequest, KeyValuePair, RequestBody, RequestAuth } from '../types';
import { generateId } from './helpers';

/**
 * Токенизатор curl-команды.
 * Поддерживает:
 *  - одинарные и двойные кавычки
 *  - экранирование внутри двойных кавычек (\", \\, \n, \t, \r)
 *  - перенос строки через \
 *  - ANSI-C quoting ($'...') — базово
 */
const tokenize = (input: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let i = 0;

  const push = () => {
    if (current.length > 0) {
      tokens.push(current);
      current = '';
    }
  };

  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];

    // Перенос строки через \
    if (ch === '\\' && (next === '\n' || next === '\r')) {
      i += next === '\r' && input[i + 2] === '\n' ? 3 : 2;
      continue;
    }
    // Перенос строки в Windows (\r\n) без слеша — тоже пропускаем
    if (ch === '\r' && next === '\n') {
      i += 2;
      continue;
    }

    if (quote === "'") {
      if (ch === "'") {
        quote = null;
      } else {
        current += ch;
      }
      i++;
      continue;
    }

    if (quote === '"') {
      if (ch === '\\') {
        const esc = input[i + 1];
        switch (esc) {
          case 'n': current += '\n'; i += 2; continue;
          case 't': current += '\t'; i += 2; continue;
          case 'r': current += '\r'; i += 2; continue;
          case '"': current += '"'; i += 2; continue;
          case '\\': current += '\\'; i += 2; continue;
          case '/': current += '/'; i += 2; continue;
          default: current += esc ?? ''; i += 2; continue;
        }
      }
      if (ch === '"') {
        quote = null;
        i++;
        continue;
      }
      current += ch;
      i++;
      continue;
    }

    // Вне кавычек
    if (ch === "'" || ch === '"') {
      quote = ch;
      i++;
      continue;
    }

    if (ch === '\\' && next) {
      // Экранирование пробела/спецсимвола вне кавычек
      current += next;
      i += 2;
      continue;
    }

    if (/\s/.test(ch)) {
      push();
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  push();
  return tokens;
};

interface ParsedCurl {
  method: string;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body: RequestBody;
  auth?: RequestAuth;
  followRedirects?: boolean;
  userAgent?: string;
  cookies?: string;
}

const splitUrlAndQuery = (rawUrl: string): { url: string; query: KeyValuePair[] } => {
  const queryIdx = rawUrl.indexOf('?');
  if (queryIdx === -1) return { url: rawUrl, query: [] };

  const base = rawUrl.slice(0, queryIdx);
  const queryString = rawUrl.slice(queryIdx + 1);
  const query: KeyValuePair[] = [];

  queryString.split('&').forEach(pair => {
    if (!pair) return;
    const eqIdx = pair.indexOf('=');
    const key = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
    const value = eqIdx === -1 ? '' : pair.slice(eqIdx + 1);
    try {
      query.push({
        id: generateId(),
        key: decodeURIComponent(key.replace(/\+/g, ' ')),
        value: decodeURIComponent(value.replace(/\+/g, ' ')),
        enabled: true,
      });
    } catch {
      query.push({ id: generateId(), key, value, enabled: true });
    }
  });

  return { url: base, query };
};

const tryParseJsonBody = (content: string, contentType?: string): RequestBody => {
  const isJson = contentType?.toLowerCase().includes('application/json');
  if (isJson) {
    return { type: 'json', content };
  }
  // Пробуем распарсить как JSON, если похоже
  const trimmed = content.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return { type: 'json', content };
    } catch {
      // не JSON — оставляем raw
    }
  }
  return { type: 'raw', content };
};

/**
 * Парсит curl-команду в HttpRequest.
 * @throws Error с описанием проблемы
 */
export const parseCurl = (input: string): HttpRequest => {
  if (!input || !input.trim()) {
    throw new Error('Пустая curl-команда');
  }

  // Нормализация: убираем ведущий $, prompt-символы
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^\$\s*/, '');
  // Многострочный перенос через \ в Windows/Linux — оставляем, токенизатор сам разберётся

  const tokens = tokenize(cleaned);
  if (tokens.length === 0) {
    throw new Error('Не удалось разобрать команду');
  }

  // Ищем первое вхождение "curl"
  const curlIdx = tokens.findIndex(t => t === 'curl');
  if (curlIdx === -1) {
    throw new Error('Команда должна начинаться с "curl"');
  }
  const args = tokens.slice(curlIdx + 1);

  let method: string | null = null;
  let url = '';
  const headers: KeyValuePair[] = [];
  let bodyContent = '';
  let bodyIsBinary = false;
  let auth: RequestAuth | undefined;
  let followRedirects: boolean | undefined;
  let userAgent: string | undefined;
  let cookies: string | undefined;

  let i = 0;
  const next = (): string | undefined => args[i++];

  while (i < args.length) {
    const arg = next();
    if (arg === undefined) break;

    switch (arg) {
      case '-X':
      case '--request': {
        const m = next();
        if (m) method = m.toUpperCase();
        break;
      }
      case '-H':
      case '--header': {
        const h = next();
        if (h) {
          const colonIdx = h.indexOf(':');
          if (colonIdx !== -1) {
            const key = h.slice(0, colonIdx).trim();
            const value = h.slice(colonIdx + 1).trim();
            headers.push({ id: generateId(), key, value, enabled: true });
          }
        }
        break;
      }
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-ascii':
      case '--data-binary': {
        const d = next();
        if (d !== undefined) {
          bodyContent = d;
          if (arg === '--data-binary') bodyIsBinary = true;
        }
        break;
      }
      case '--data-urlencode': {
        const d = next();
        if (d !== undefined) {
          bodyContent = bodyContent ? bodyContent + '&' + d : d;
        }
        break;
      }
      case '-u':
      case '--user': {
        const creds = next();
        if (creds) {
          const colonIdx = creds.indexOf(':');
          if (colonIdx !== -1) {
            auth = {
              type: 'basic',
              username: creds.slice(0, colonIdx),
              password: creds.slice(colonIdx + 1),
            };
          } else {
            auth = { type: 'basic', username: creds, password: '' };
          }
        }
        break;
      }
      case '-A':
      case '--user-agent': {
        const ua = next();
        if (ua) userAgent = ua;
        break;
      }
      case '-b':
      case '--cookie': {
        const c = next();
        if (c) cookies = c;
        break;
      }
      case '-L':
      case '--location': {
        followRedirects = true;
        break;
      }
      case '--compressed':
      case '-s':
      case '--silent':
      case '-k':
      case '--insecure':
      case '-v':
      case '--verbose':
      case '-i':
      case '--include':
      case '-f':
      case '--fail':
      case '-g':
      case '--globoff': {
        // Игнорируем «шумные» флаги
        break;
      }
      case '-o':
      case '--output':
      case '-w':
      case '--write-out': {
        // Пропускаем значение
        next();
        break;
      }
      default: {
        // Неизвестный флаг — если начинается с -, пропускаем
        if (arg.startsWith('-')) {
          // Возможно, это флаг с параметром, но мы не знаем — просто игнорируем
          break;
        }
        // Позиционный аргумент — URL
        if (!url) {
          url = arg;
        }
        break;
      }
    }
  }

  if (!url) {
    throw new Error('В команде не найден URL');
  }

  // Если URL без протокола — добавляем http://
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url) && !url.startsWith('{{')) {
    url = 'http://' + url;
  }

  // Разбор URL и query
  const { url: baseUrl, query: urlQuery } = splitUrlAndQuery(url);

  // Определяем Content-Type
  const contentTypeHeader = headers.find(
    h => h.key.toLowerCase() === 'content-type'
  );
  const contentType = contentTypeHeader?.value;

  // Метод
  const hasBody = bodyContent.length > 0 || bodyIsBinary;
  let finalMethod = method;
  if (!finalMethod) {
    if (hasBody) {
      // Если Content-Type — urlencoded, PUT/DELETE всё равно POST по умолчанию не ставим
      finalMethod = 'POST';
    } else {
      finalMethod = 'GET';
    }
  }

  // Тело
  let body: RequestBody = { type: 'none', content: '' };
  if (hasBody) {
    if (bodyIsBinary) {
      body = { type: 'binary', content: bodyContent };
    } else if (contentType?.toLowerCase().includes('application/x-www-form-urlencoded')) {
      const form: KeyValuePair[] = [];
      bodyContent.split('&').forEach(pair => {
        if (!pair) return;
        const eqIdx = pair.indexOf('=');
        const key = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
        const value = eqIdx === -1 ? '' : pair.slice(eqIdx + 1);
        try {
          form.push({
            id: generateId(),
            key: decodeURIComponent(key.replace(/\+/g, ' ')),
            value: decodeURIComponent(value.replace(/\+/g, ' ')),
            enabled: true,
          });
        } catch {
          form.push({ id: generateId(), key, value, enabled: true });
        }
      });
      body = { type: 'x-www-form-urlencoded', content: bodyContent, form };
    } else if (contentType?.toLowerCase().includes('multipart/form-data')) {
      // Упрощённо: не парсим границы, кладём как raw
      body = { type: 'raw', content: bodyContent };
    } else {
      body = tryParseJsonBody(bodyContent, contentType);
    }
  }

  // Cookies → в Headers
  if (cookies) {
    headers.push({
      id: generateId(),
      key: 'Cookie',
      value: cookies,
      enabled: true,
    });
  }

  // User-Agent → в Headers
  if (userAgent) {
    headers.push({
      id: generateId(),
      key: 'User-Agent',
      value: userAgent,
      enabled: true,
    });
  }

  // Собираем settings
  const settings: HttpRequest['settings'] = {};
  if (followRedirects !== undefined) settings.followRedirects = followRedirects;
  if (userAgent) settings.userAgent = userAgent;

  const request: HttpRequest = {
    id: generateId(),
    name: deriveName(finalMethod, baseUrl),
    method: finalMethod,
    url: baseUrl,
    headers,
    queryParams: urlQuery,
    body,
    auth,
    settings: Object.keys(settings).length > 0 ? settings : undefined,
  };

  return request;
};

const deriveName = (method: string, url: string): string => {
  try {
    // Пытаемся выделить путь
    const withoutProto = url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    const firstSlash = withoutProto.indexOf('/');
    const path = firstSlash === -1 ? withoutProto : withoutProto.slice(firstSlash);
    if (path && path !== '/') {
      const segments = path.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last) return `${method} ${decodeURIComponent(last).split('?')[0]}`;
    }
  } catch {
    // ignore
  }
  return method === 'GET' ? 'New Request' : `New ${method} Request`;
};

/**
 * Проверяет, похожа ли строка на curl-команду.
 */
export const looksLikeCurl = (input: string): boolean => {
  if (!input) return false;
  const trimmed = input.trim().replace(/^\$\s*/, '');
  return /^curl(\s|$)/i.test(trimmed);
};