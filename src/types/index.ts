export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  // ✅ Новые поля для form-data (обратная совместимость сохранена)
  type?: 'text' | 'file';
  files?: string[];
}

export interface RequestAuth {
  type: 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2' | 'noauth';
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiValue?: string;
  addTo?: 'header' | 'queryParams';
  accessToken?: string;
  tokenType?: string;
  refreshToken?: string;
  grantType?: string;
  callbackUrl?: string;
  authUrl?: string;
  accessTokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  state?: string;
}

export interface RequestBody {
  type: 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'json' | 'binary' | 'graphql';
  content: string;
  form?: KeyValuePair[];
}

export interface HttpRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body: RequestBody;
  auth?: RequestAuth;
  scripts?: {
    preRequest?: string;
    test?: string;
  };
  settings?: {
    followRedirects?: boolean;
    timeout?: number;
  };
  documentation?: string; // ✅ Добавлено, так как используется в App.tsx
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  time: number;
  size: number;
}

export interface HistoryItem {
  id: string;
  request: HttpRequest;
  response: HttpResponse;
  timestamp: number;
}

export interface CollectionFolder {
  id: string;
  name: string;
  folders: CollectionFolder[];
  requests: HttpRequest[];
}

export interface Collection {
  id: string;
  name: string;
  folders: CollectionFolder[];
  requests: HttpRequest[];
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
  globalTestScript?: string; // ✅ Добавлено, так как используется
}

// ============ Postman Import Types ============

export interface PostmanVariable {
  key: string;
  value: string;
  enabled: boolean;
  type?: 'default' | 'secret' | 'any';
  description?: string;
}

export interface PostmanEnvironmentFile {
  id?: string;
  name: string;
  values: PostmanVariable[];
  _postman_variable_scope: 'environment' | 'globals';
  _postman_exported_at?: string;
  _postman_exported_using?: string;
}

export interface PostmanCollectionInfo {
  name: string;
  _postman_id?: string;
  schema?: string;
}

export interface PostmanCollectionFile {
  info: PostmanCollectionInfo;
  item: any[];
}

export type ImportFileType = 'environment' | 'globals' | 'collection' | 'unknown';

export type ConflictAction = 'replace' | 'copy' | 'skip';

export interface ScriptExecutionResult {
  testResults: TestResult[];
  logs: string[];
  error?: string;
  skipped?: boolean;
  retry?: boolean;
  nextRequest?: string | null;
  environmentChanges: { key: string; value: string; enabled: boolean }[];
  globalsChanges: { key: string; value: string; enabled: boolean }[];
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}