import { Collection, HttpRequest, KeyValuePair } from '../types';
import { generateId } from './helpers';

interface PostmanCollection {
  info?: {
    name?: string;
    _postman_id?: string;
    schema?: string;
  };
  item?: PostmanItem[];
}

interface PostmanItem {
  name?: string;
  request?: {
    method?: string;
    header?: PostmanHeader[];
    url?: string | PostmanUrl;
    body?: PostmanBody;
    auth?: PostmanAuth;
  };
  item?: PostmanItem[];
}

interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
}

interface PostmanUrl {
  raw?: string;
  host?: string[];
  path?: string[];
  query?: PostmanQuery[];
}

interface PostmanQuery {
  key: string;
  value: string;
  disabled?: boolean;
}

interface PostmanBody {
  mode?: string;
  raw?: string;
  urlencoded?: PostmanUrlEncoded[];
  formdata?: PostmanFormData[];
}

interface PostmanUrlEncoded {
  key: string;
  value: string;
  disabled?: boolean;
}

interface PostmanFormData {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
}

interface PostmanAuth {
  type?: string;
  bearer?: PostmanAuthParam[];
  basic?: PostmanAuthParam[];
}

interface PostmanAuthParam {
  key: string;
  value: string;
}

// Определяет, является ли файл коллекцией Postman (более гибкая проверка)
export const isPostmanCollection = (data: any): boolean => {
  // Проверяем разные варианты schema
  const schema = data.info?.schema || data.info?.$schema || '';
  const hasPostmanSchema = schema.toLowerCase().includes('postman');
  
  // Или проверяем наличие _postman_id
  const hasPostmanId = data.info?._postman_id !== undefined;
  
  // Или проверяем наличие item (массив запросов)
  const hasItems = Array.isArray(data.item);
  
  // Или проверяем название info
  const hasInfo = data.info !== undefined;
  
  return (hasPostmanSchema || hasPostmanId) && hasItems;
};

// Конвертирует коллекцию Postman в наш формат
export const convertPostmanCollection = (postmanData: PostmanCollection): Collection => {
  const collectionName = postmanData.info?.name || 'Imported from Postman';
  const requests = flattenPostmanItems(postmanData.item || []);

  return {
    id: generateId(),
    name: collectionName,
    requests: requests,
  };
};

// Рекурсивно разворачивает вложенные папки Postman
const flattenPostmanItems = (items: PostmanItem[]): HttpRequest[] => {
  const requests: HttpRequest[] = [];

  const processItem = (item: PostmanItem) => {
    // Если это папка (есть вложенные item)
    if (item.item && item.item.length > 0) {
      requests.push(...flattenPostmanItems(item.item));
    }
    // Если это запрос
    else if (item.request) {
      const request = convertPostmanRequest(item);
      requests.push(request);
    }
  };

  items.forEach(processItem);
  return requests;
};

// Конвертирует отдельный запрос Postman
const convertPostmanRequest = (item: PostmanItem): HttpRequest => {
  const req = item.request!;

  // URL
  let url = '';
  let queryParams: KeyValuePair[] = [];

  if (typeof req.url === 'string') {
    url = req.url;
  } else if (req.url) {
    url = req.url.raw || '';
    
    // Query parameters
    if (req.url.query) {
      queryParams = req.url.query.map(q => ({
        id: generateId(),
        key: q.key,
        value: q.value,
        enabled: !q.disabled,
      }));
    }
  }

  // Headers
  const headers: KeyValuePair[] = (req.header || []).map(h => ({
    id: generateId(),
    key: h.key,
    value: h.value,
    enabled: !h.disabled,
  }));

  // Body
  let body: any = {
    type: 'none' as const,
    content: '',
  };

  if (req.body) {
    if (req.body.mode === 'raw' && req.body.raw) {
      body = {
        type: 'raw' as const,
        content: req.body.raw,
      };
      
      // Проверяем, JSON ли это
      try {
        JSON.parse(req.body.raw);
        body.type = 'json' as const;
      } catch {
        // Не JSON, оставляем raw
      }
    } else if (req.body.mode === 'urlencoded' && req.body.urlencoded) {
      body = {
        type: 'x-www-form-urlencoded' as const,
        content: '',
        formData: req.body.urlencoded.map(f => ({
          id: generateId(),
          key: f.key,
          value: f.value,
          enabled: !f.disabled,
        })),
      };
    } else if (req.body.mode === 'formdata' && req.body.formdata) {
      body = {
        type: 'form-data' as const,
        content: '',
        formData: req.body.formdata.map(f => ({
          id: generateId(),
          key: f.key,
          value: f.value,
          enabled: !f.disabled,
        })),
      };
    }
  }

  // Auth
  let auth: any = undefined;
  if (req.auth) {
    if (req.auth.type === 'bearer' && req.auth.bearer) {
      const tokenParam = req.auth.bearer.find(p => p.key === 'token');
      if (tokenParam) {
        auth = {
          type: 'bearer' as const,
          token: tokenParam.value,
        };
      }
    } else if (req.auth.type === 'basic' && req.auth.basic) {
      const usernameParam = req.auth.basic.find(p => p.key === 'username');
      const passwordParam = req.auth.basic.find(p => p.key === 'password');
      auth = {
        type: 'basic' as const,
        username: usernameParam?.value || '',
        password: passwordParam?.value || '',
      };
    }
  }

  return {
    id: generateId(),
    name: item.name || 'Unnamed Request',
    method: req.method || 'GET',
    url,
    headers,
    queryParams,
    body,
    auth,
  };
};