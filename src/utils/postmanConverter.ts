import { Collection, HttpRequest, KeyValuePair, RequestBody, RequestAuth } from '../types';
import { generateId } from './helpers';

/**
 * Проверяет, является ли объект коллекцией Postman
 */
export const isPostmanCollection = (data: any): boolean => {
  return data && data.info && data.info.schema && (
    data.info.schema.includes('getpostman.com') ||
    data.info.schema.includes('schema.getpostman.com')
  );
};

/**
 * Конвертирует коллекцию Postman во внутренний формат SV-Post
 */
export const convertPostmanCollection = (postmanCollection: any): Collection => {
  const requests: HttpRequest[] = [];

  const processItems = (items: any[]) => {
    if (!Array.isArray(items)) return;

    items.forEach((item: any) => {
      if (item.item && Array.isArray(item.item)) {
        // Вложенная папка — рекурсивно обрабатываем
        processItems(item.item);
      } else if (item.request) {
        // Это запрос
        const request = convertPostmanRequest(item);
        if (request) {
          requests.push(request);
        }
      }
    });
  };

  if (postmanCollection.item) {
    processItems(postmanCollection.item);
  }

  return {
    id: generateId(),
    name: postmanCollection.info?.name || 'Imported Collection',
    requests,
  };
};

/**
 * Конвертирует отдельный запрос Postman во внутренний формат
 */
const convertPostmanRequest = (postmanItem: any, _folderName?: string): HttpRequest | null => {
  if (!postmanItem.request) return null;

  const request = postmanItem.request;

  // ИСПРАВЛЕНИЕ 1.2: используем 'form' вместо несуществующего 'formData'
  const body: RequestBody = {
    type: 'none',
    content: '',
    form: [],
  };

  if (request.body) {
    switch (request.body.mode) {
      case 'raw':
        body.type = 'raw';
        body.content = request.body.raw || '';
        break;

      case 'formdata':
        body.type = 'form-data';
        body.form = (request.body.formdata || []).map((field: any) => ({
          id: generateId(),
          key: field.key || '',
          value: field.value || '',
          enabled: !field.disabled,
        }));
        break;

      case 'urlencoded':
        body.type = 'x-www-form-urlencoded';
        body.form = (request.body.urlencoded || []).map((field: any) => ({
          id: generateId(),
          key: field.key || '',
          value: field.value || '',
          enabled: !field.disabled,
        }));
        break;

      case 'graphql':
        body.type = 'graphql';
        body.content = JSON.stringify(request.body.graphql || {});
        break;

      case 'file':
        body.type = 'binary';
        body.content = '';
        break;

      default:
        body.type = 'none';
    }
  }

  // ИСПРАВЛЕНИЕ 2.29: вырезаем query-строку из url.raw, чтобы не дублировать с queryParams
  let urlStr = '';
  if (typeof request.url === 'string') {
    urlStr = request.url.split('?')[0];
  } else if (request.url && typeof request.url === 'object') {
    const protocol = request.url.protocol ? `${request.url.protocol}://` : '';
    const host = request.url.host ? request.url.host.join('.') : '';
    const path = request.url.path ? `/${request.url.path.join('/')}` : '';
    const port = request.url.port ? `:${request.url.port}` : '';
    urlStr = `${protocol}${host}${port}${path}`;
  }

  // Извлекаем query-параметры отдельно
  const queryParams: KeyValuePair[] = [];
  if (request.url && typeof request.url === 'object' && request.url.query) {
    request.url.query.forEach((param: any) => {
      queryParams.push({
        id: generateId(),
        key: param.key || '',
        value: param.value || '',
        enabled: !param.disabled,
      });
    });
  }

  // Извлекаем заголовки
  const headers: KeyValuePair[] = [];
  if (request.header) {
    request.header.forEach((header: any) => {
      headers.push({
        id: generateId(),
        key: header.key || '',
        value: header.value || '',
        enabled: !header.disabled,
      });
    });
  }

  // ИСПРАВЛЕНИЕ 2.30: обработка всех типов авторизации
  const auth: RequestAuth | undefined = request.auth
    ? convertPostmanAuth(request.auth)
    : undefined;

  return {
    id: generateId(),
    name: postmanItem.name || request.name || 'Unnamed Request',
    method: (request.method || 'GET').toUpperCase(),
    url: urlStr,
    headers,
    queryParams,
    body,
    auth,
  };
};

/**
 * Конвертирует объект авторизации Postman во внутренний формат
 */
const convertPostmanAuth = (postmanAuth: any): RequestAuth => {
  const auth: RequestAuth = {
    type: 'noauth',
  };

  if (!postmanAuth.type) return auth;

  // Собираем все параметры авторизации в объект
  const authData: Record<string, any> = {};
  if (postmanAuth[postmanAuth.type] && Array.isArray(postmanAuth[postmanAuth.type])) {
    postmanAuth[postmanAuth.type].forEach((item: any) => {
      if (item.key) {
        authData[item.key] = item.value;
      }
    });
  }

  switch (postmanAuth.type) {
    case 'bearer':
      auth.type = 'bearer';
      auth.token = authData.token || '';
      break;

    case 'basic':
      auth.type = 'basic';
      auth.username = authData.username || '';
      auth.password = authData.password || '';
      break;

    case 'apikey':
      auth.type = 'apikey';
      auth.apiKey = authData.key || '';
      auth.apiValue = authData.value || '';
      auth.addTo = authData.in === 'header' ? 'header' : 'queryParams';
      break;

    case 'oauth2':
      auth.type = 'oauth2';
      auth.accessToken = authData.accessToken || '';
      auth.tokenType = authData.tokenType || authData.headerPrefix || 'Bearer';
      auth.clientId = authData.clientId || '';
      auth.clientSecret = authData.clientSecret || '';
      auth.scope = authData.scope || '';
      auth.grantType = authData.grant_type || 'authorization_code';
      auth.authUrl = authData.authUrl || '';
      auth.accessTokenUrl = authData.accessTokenUrl || '';
      auth.callbackUrl = authData.callbackUrl || '';
      auth.state = authData.state || '';
      break;

    case 'digest':
      auth.type = 'basic'; // Маппим digest на basic как fallback
      auth.username = authData.username || '';
      auth.password = authData.password || '';
      console.warn('[Postman Converter] Digest auth маппирован на Basic (ограниченная поддержка)');
      break;

    case 'noauth':
      auth.type = 'noauth';
      break;

    default:
      auth.type = 'noauth';
      console.warn(`[Postman Converter] Не поддерживается тип авторизации: ${postmanAuth.type}`);
  }

  return auth;
};