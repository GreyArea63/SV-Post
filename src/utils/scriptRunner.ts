import axios from 'axios';
import {
  KeyValuePair,
  TestResult,
  ScriptExecutionResult,
  ScriptContext,
  HttpResponse,
} from '../types';
import { generateId } from './helpers';

// ✅ КРИТИЧНО: конструктор асинхронных функций — поддерживает await
const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

/**
 * ScriptRunner — безопасное выполнение Pre-request Scripts и Tests
 * в изолированной песочнице с Postman-совместимым API (pm.*)
 *
 * Особенности:
 * - pm.sendRequest поддерживает Postman-формат (header/body.mode/body.raw) и резолвит {{var}}
 * - pm.retryRequest() ставит флаг (НЕ бросает исключение), как в Postman
 * - pm.skipRequest() бросает __SKIP_REQUEST__ (прерывает скрипт)
 * - pm.expect(...).to.eql(...) — добавлен алиас toEqual
 */
export class ScriptRunner {
  private context: ScriptContext;
  private testResults: TestResult[] = [];
  private logs: string[] = [];
  private environmentChanges: KeyValuePair[] = [];
  private globalsChanges: KeyValuePair[] = [];
  private environment: Record<string, string>;
  private globals: Record<string, string>;
  private retryRequested = false;

  constructor(context: ScriptContext) {
    this.context = context;
    this.environment = { ...context.environment };
    this.globals = { ...context.globals };
  }

  /**
   * Резолвит {{var}} в строке на основе текущих environment + globals
   */
  private resolveVars(text: string): string {
    if (typeof text !== 'string' || !text) return text;
    const vars: KeyValuePair[] = [
      ...Object.entries(this.globals).map(([key, value]) => ({
        id: 'g_' + key, key, value, enabled: true,
      })),
      ...Object.entries(this.environment).map(([key, value]) => ({
        id: 'e_' + key, key, value, enabled: true,
      })),
    ];
    // Сортируем по длине ключа (длинные первыми) для корректной замены
    const sorted = [...vars].sort((a, b) => b.key.length - a.key.length);
    let result = text;
    sorted.forEach((v) => {
      const escapedKey = v.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
      result = result.replace(regex, v.value);
    });
    return result;
  }

  /**
   * Резолвит {{var}} во всех строковых значениях объекта (1 уровень вложенности)
   */
  private resolveVarsInObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    Object.entries(obj).forEach(([k, v]) => {
      result[k] = typeof v === 'string' ? this.resolveVars(v) : v;
    });
    return result;
  }

  /**
   * Резолвит {{var}} в body для Postman-формата
   */
  private resolveBodyVars(body: any): any {
    if (!body || typeof body !== 'object') {
      return typeof body === 'string' ? this.resolveVars(body) : body;
    }
    const result: any = { ...body };
    if (typeof result.raw === 'string') result.raw = this.resolveVars(result.raw);
    if (Array.isArray(result.urlencoded)) {
      result.urlencoded = result.urlencoded.map((f: any) => ({
        ...f,
        key: typeof f.key === 'string' ? this.resolveVars(f.key) : f.key,
        value: typeof f.value === 'string' ? this.resolveVars(f.value) : f.value,
      }));
    }
    if (Array.isArray(result.formdata)) {
      result.formdata = result.formdata.map((f: any) => ({
        ...f,
        key: typeof f.key === 'string' ? this.resolveVars(f.key) : f.key,
        value: typeof f.value === 'string' ? this.resolveVars(f.value) : f.value,
      }));
    }
    if (result.graphql && typeof result.graphql === 'object') {
      result.graphql = {
        ...result.graphql,
        query: typeof result.graphql.query === 'string' ? this.resolveVars(result.graphql.query) : result.graphql.query,
        variables: typeof result.graphql.variables === 'string' ? this.resolveVars(result.graphql.variables) : result.graphql.variables,
      };
    }
    return result;
  }

  private createPmObject(response?: HttpResponse) {
    const self = this;
    const responseBody = response ? response.data : null;

    const createExpect = (value: any) => {
      const toEqualImpl = (expected: any) => {
        if (JSON.stringify(value) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
        }
      };
      return {
        toBe: (expected: any) => {
          if (value !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
        },
        toEqual: toEqualImpl,
        eql: toEqualImpl, // ✅ алиас
        toEql: toEqualImpl, // ✅ алиас
        toBeTruthy: () => { if (!value) throw new Error(`Expected truthy value but got ${JSON.stringify(value)}`); },
        toBeFalsy: () => { if (value) throw new Error(`Expected falsy value but got ${JSON.stringify(value)}`); },
        toBeDefined: () => { if (value === undefined) throw new Error('Expected defined value but got undefined'); },
        toBeUndefined: () => { if (value !== undefined) throw new Error(`Expected undefined but got ${JSON.stringify(value)}`); },
        toBeNull: () => { if (value !== null) throw new Error(`Expected null but got ${JSON.stringify(value)}`); },
        toBeGreaterThan: (expected: number) => {
          if (typeof value !== 'number' || value <= expected) throw new Error(`Expected ${value} to be greater than ${expected}`);
        },
        toBeLessThan: (expected: number) => {
          if (typeof value !== 'number' || value >= expected) throw new Error(`Expected ${value} to be less than ${expected}`);
        },
        toBeGreaterThanOrEqual: (expected: number) => {
          if (typeof value !== 'number' || value < expected) throw new Error(`Expected ${value} to be >= ${expected}`);
        },
        toBeLessThanOrEqual: (expected: number) => {
          if (typeof value !== 'number' || value > expected) throw new Error(`Expected ${value} to be <= ${expected}`);
        },
        toInclude: (expected: any) => {
          if (typeof value === 'string') {
            if (!value.includes(expected)) throw new Error(`Expected "${value}" to include "${expected}"`);
          } else if (Array.isArray(value)) {
            if (!value.includes(expected)) throw new Error(`Expected array to include ${JSON.stringify(expected)}`);
          } else {
            throw new Error('toInclude can only be used with strings and arrays');
          }
        },
        toHaveProperty: (key: string) => {
          if (typeof value !== 'object' || value === null || !(key in value)) throw new Error(`Expected object to have property "${key}"`);
        },
        toMatch: (pattern: string | RegExp) => {
          const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
          if (typeof value !== 'string' || !regex.test(value)) throw new Error(`Expected "${value}" to match ${pattern}`);
        },
        toHaveLength: (length: number) => {
          if (value === null || value === undefined || value.length !== length) throw new Error(`Expected length ${length} but got ${value?.length}`);
        },
        toBeOneOf: (options: any[]) => {
          if (!options.includes(value)) throw new Error(`Expected ${JSON.stringify(value)} to be one of ${JSON.stringify(options)}`);
        },
        to: {
          have: {
            property: (key: string) => {
              if (typeof value !== 'object' || value === null || !(key in value)) throw new Error(`Expected object to have property "${key}"`);
            },
            length: (length: number) => {
              if (value?.length !== length) throw new Error(`Expected length ${length} but got ${value?.length}`);
            },
          },
          be: {
            a: (type: string) => {
              const actualType = Array.isArray(value) ? 'array' : typeof value;
              if (actualType !== type) throw new Error(`Expected type "${type}" but got "${actualType}"`);
            },
            an: (type: string) => {
              const actualType = Array.isArray(value) ? 'array' : typeof value;
              if (actualType !== type) throw new Error(`Expected type "${type}" but got "${actualType}"`);
            },
          },
          eql: toEqualImpl, // ✅ pm.expect(x).to.eql(y)
          equal: toEqualImpl, // ✅ pm.expect(x).to.equal(y)
        },
      };
    };

    const responseToHave = response
      ? {
        status: (code: number) => {
          if (response.status !== code) throw new Error(`Expected status ${code} but got ${response.status}`);
        },
        header: (key: string) => {
          const headers = response.headers || {};
          const found = Object.keys(headers).some((k) => k.toLowerCase() === key.toLowerCase());
          if (!found) throw new Error(`Expected header "${key}" to be present`);
        },
        jsonBody: () => {
          try {
            if (typeof responseBody === 'string') JSON.parse(responseBody);
          } catch { throw new Error('Expected response body to be valid JSON'); }
        },
        body: () => {
          if (!responseBody) throw new Error('Expected response body to be present');
        },
      }
      : {
        status: () => { throw new Error('No response available'); },
        header: () => { throw new Error('No response available'); },
        jsonBody: () => { throw new Error('No response available'); },
        body: () => { throw new Error('No response available'); },
      };

    const pmObject: any = {
      request: {
        url: this.context.request.url,
        method: this.context.request.method,
        headers: { ...this.context.request.headers },
        body: this.context.request.body,
        queryParams: this.context.request.queryParams || {},
      },

      response: response
        ? {
          code: response.status,
          status: response.status,
          statusText: response.statusText,
          headers: { ...response.headers },
          body: responseBody,
          responseTime: response.time,
          time: response.time,
          responseSize: response.size,
          size: response.size,
          json: () => {
            try {
              return typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
            } catch { return null; }
          },
          text: () => String(responseBody ?? ''),
          to: { have: responseToHave },
        }
        : {
          code: 0, status: 0, statusText: '', headers: {}, body: null,
          responseTime: 0, time: 0, responseSize: 0, size: 0,
          json: () => null, text: () => '', to: { have: responseToHave },
        },

      environment: {
        get: (key: string) => self.environment[key] ?? '',
        set: (key: string, value: any) => {
          const strValue = String(value ?? '');
          self.environmentChanges.push({ id: generateId(), key, value: strValue, enabled: true });
          self.environment[key] = strValue;
        },
        unset: (key: string) => {
          self.environmentChanges.push({ id: generateId(), key, value: '', enabled: false });
          delete self.environment[key];
        },
        has: (key: string) => key in self.environment,
        toObject: () => ({ ...self.environment }),
        clear: () => {
          Object.keys(self.environment).forEach((key) => {
            self.environmentChanges.push({ id: generateId(), key, value: '', enabled: false });
          });
          self.environment = {};
        },
      },

      globals: {
        get: (key: string) => self.globals[key] ?? '',
        set: (key: string, value: any) => {
          const strValue = String(value ?? '');
          self.globalsChanges.push({ id: generateId(), key, value: strValue, enabled: true });
          self.globals[key] = strValue;
        },
        unset: (key: string) => {
          self.globalsChanges.push({ id: generateId(), key, value: '', enabled: false });
          delete self.globals[key];
        },
        has: (key: string) => key in self.globals,
        toObject: () => ({ ...self.globals }),
        clear: () => {
          Object.keys(self.globals).forEach((key) => {
            self.globalsChanges.push({ id: generateId(), key, value: '', enabled: false });
          });
          self.globals = {};
        },
      },

      collectionVariables: {
        get: (key: string) => self.globals[key] ?? '',
        set: (key: string, value: any) => {
          const strValue = String(value ?? '');
          self.globalsChanges.push({ id: generateId(), key, value: strValue, enabled: true });
          self.globals[key] = strValue;
        },
        unset: (key: string) => {
          self.globalsChanges.push({ id: generateId(), key, value: '', enabled: false });
          delete self.globals[key];
        },
      },

      variables: {
        get: (key: string) => {
          return self.environment[key] ?? self.globals[key] ?? self.context.iterationData?.[key] ?? '';
        },
        set: (key: string, value: any, scope: 'environment' | 'globals' = 'environment') => {
          const strValue = String(value ?? '');
          const change: KeyValuePair = { id: generateId(), key, value: strValue, enabled: true };
          if (scope === 'environment') {
            self.environmentChanges.push(change);
            self.environment[key] = strValue;
          } else {
            self.globalsChanges.push(change);
            self.globals[key] = strValue;
          }
        },
      },

      iterationData: self.context.iterationData || {},

      test: (name: string, fn: () => void) => {
        try {
          fn();
          self.testResults.push({ name, passed: true, timestamp: Date.now() });
        } catch (error: any) {
          self.testResults.push({ name, passed: false, error: error?.message || 'Assertion failed', timestamp: Date.now() });
        }
      },

      expect: (value: any) => createExpect(value),

      log: (...args: any[]) => {
        const message = args.map((arg) => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
        self.logs.push(message);
      },

      info: {
        eventName: 'test',
        iteration: self.context.iteration ?? 1,
        iterationCount: self.context.iterationCount ?? 1,
        requestName: '', requestId: '',
      },

      // ✅ skipRequest — бросает, чтобы прервать скрипт (правильно)
      skipRequest: () => { throw new Error('__SKIP_REQUEST__'); },

      // ✅ sendRequest — Postman-совместимый
      sendRequest: async (req: any, callback?: (error: any, response: any) => void) => {
        try {
          // 1. Alias: header → headers (Postman использует header)
          const rawHeaders = req.header || req.headers || {};

          // 2. Резолв переменных в URL и headers
          const resolvedUrl = self.resolveVars(req.url || '');
          const resolvedHeaders = self.resolveVarsInObject(rawHeaders);

          const config: any = {
            method: (req.method || 'GET').toLowerCase(),
            url: resolvedUrl,
            headers: resolvedHeaders,
            timeout: 30000,
          };

          // 3. Обработка body с поддержкой Postman-формата
          if (req.body) {
            const body = self.resolveBodyVars(req.body);

            if (typeof body === 'string') {
              // Строка — пытаемся распарсить как JSON, иначе шлём как есть
              try {
                config.data = JSON.parse(body);
                config.headers = { ...config.headers, 'Content-Type': 'application/json' };
              } catch {
                config.data = body;
              }
            } else if (typeof body === 'object' && body !== null && typeof body.mode === 'string') {
              // Postman-формат: { mode, raw, urlencoded, formdata, graphql }
              switch (body.mode) {
                case 'raw': {
                  const raw = body.raw || '';
                  try {
                    config.data = JSON.parse(raw);
                    config.headers = { ...config.headers, 'Content-Type': 'application/json' };
                  } catch {
                    config.data = raw;
                  }
                  break;
                }
                case 'urlencoded': {
                  const params = new URLSearchParams();
                  (body.urlencoded || []).forEach((f: any) => {
                    if (f.disabled !== true && f.key) params.append(f.key, f.value ?? '');
                  });
                  config.data = params.toString();
                  config.headers = { ...config.headers, 'Content-Type': 'application/x-www-form-urlencoded' };
                  break;
                }
                case 'formdata': {
                  const fd = new FormData();
                  (body.formdata || []).forEach((f: any) => {
                    if (f.disabled !== true && f.key) {
                      if (f.type === 'file' && f.src) {
                        // В песочнице файлы недоступны — пропускаем
                        self.logs.push(`[pm.sendRequest] formdata file skipped: ${f.key}`);
                      } else {
                        fd.append(f.key, f.value ?? '');
                      }
                    }
                  });
                  config.data = fd;
                  // НЕ ставим Content-Type — браузер сам с boundary
                  break;
                }
                case 'graphql': {
                  config.data = {
                    query: body.graphql?.query || '',
                    variables: body.graphql?.variables
                      ? (typeof body.graphql.variables === 'string'
                        ? (() => { try { return JSON.parse(body.graphql.variables); } catch { return {}; } })()
                        : body.graphql.variables)
                      : {},
                    operationName: body.graphql?.operationName || null,
                  };
                  config.headers = { ...config.headers, 'Content-Type': 'application/json' };
                  break;
                }
                default: {
                  config.data = body;
                  config.headers = { ...config.headers, 'Content-Type': 'application/json' };
                }
              }
            } else {
              // Обычный объект или массив — шлём как JSON
              config.data = body;
              config.headers = { ...config.headers, 'Content-Type': 'application/json' };
            }
          }

          const axiosResponse = await axios(config);
          const respHeaders = (axiosResponse.headers as any).toJSON
            ? (axiosResponse.headers as any).toJSON()
            : axiosResponse.headers;

          const resp = {
            code: axiosResponse.status,
            status: axiosResponse.statusText,
            statusText: axiosResponse.statusText,
            headers: respHeaders,
            data: axiosResponse.data,
            body: axiosResponse.data,
            responseTime: 0,
            time: 0,
            json: () => {
              try {
                return typeof axiosResponse.data === 'string'
                  ? JSON.parse(axiosResponse.data)
                  : axiosResponse.data;
              } catch { return axiosResponse.data; }
            },
            text: () => typeof axiosResponse.data === 'string'
              ? axiosResponse.data
              : JSON.stringify(axiosResponse.data),
          };

          self.logs.push(`[pm.sendRequest] ${req.method || 'GET'} ${resolvedUrl} → ${axiosResponse.status}`);
          if (callback) callback(null, resp);
          return resp;
        } catch (error: any) {
          const errResp = error.response
            ? {
              code: error.response.status,
              status: error.response.statusText,
              statusText: error.response.statusText,
              headers: (error.response.headers as any).toJSON
                ? (error.response.headers as any).toJSON()
                : error.response.headers,
              data: error.response.data,
              body: error.response.data,
              responseTime: 0,
              time: 0,
              json: () => {
                try {
                  return typeof error.response.data === 'string'
                    ? JSON.parse(error.response.data)
                    : error.response.data;
                } catch { return error.response.data; }
              },
              text: () => typeof error.response.data === 'string'
                ? error.response.data
                : JSON.stringify(error.response.data),
            }
            : null;

          self.logs.push(`[pm.sendRequest] ${req.method || 'GET'} ${req.url} → ERROR: ${error.message}`);
          if (callback) callback(error, errResp);
          if (errResp) return errResp;
          throw error;
        }
      },

      // ✅ retryRequest — ставит флаг, НЕ бросает (как в Postman)
      retryRequest: () => {
        self.retryRequested = true;
        self.logs.push('[pm.retryRequest] Флаг повторного запроса установлен');
      },

      responseCode: response ? { code: response.status, name: response.statusText, detail: '' } : { code: 0, name: '', detail: '' },
      responseHeaders: response?.headers || {},
      responseTime: response?.time || 0,
      responseBody: responseBody ?? '',
    };

    // ✅ АЛИАС pm.env → pm.environment
    pmObject.env = pmObject.environment;

    return pmObject;
  }

  async runScript(script: string, response?: HttpResponse): Promise<ScriptExecutionResult> {
    if (!script || !script.trim()) {
      return { environmentChanges: [], globalsChanges: [], testResults: [], logs: [] };
    }

    try {
      const pm = this.createPmObject(response);

      const sandboxConsole = {
        log: (...args: any[]) => pm.log(...args),
        error: (...args: any[]) => pm.log('[ERROR]', ...args),
        warn: (...args: any[]) => pm.log('[WARN]', ...args),
        info: (...args: any[]) => pm.log('[INFO]', ...args),
        debug: (...args: any[]) => pm.log('[DEBUG]', ...args),
      };

      const scriptFunction = new AsyncFunction(
        'pm', 'postman', 'console', 'require', 'process', 'global', 'window', 'document',
        script
      );

      await scriptFunction(pm, pm, sandboxConsole, undefined, undefined, undefined, undefined, undefined);

      return {
        environmentChanges: this.environmentChanges,
        globalsChanges: this.globalsChanges,
        testResults: this.testResults,
        logs: this.logs,
        retry: this.retryRequested || undefined,
      };
    } catch (error: any) {
      if (error?.message === '__SKIP_REQUEST__') {
        return {
          environmentChanges: this.environmentChanges,
          globalsChanges: this.globalsChanges,
          testResults: this.testResults,
          logs: this.logs,
          skipped: true,
          retry: this.retryRequested || undefined,
        };
      }
      return {
        environmentChanges: this.environmentChanges,
        globalsChanges: this.globalsChanges,
        testResults: this.testResults,
        logs: this.logs,
        error: error?.message || 'Script execution failed',
        retry: this.retryRequested || undefined,
      };
    }
  }
}

/**
 * Подставляет {{var}} в текст скрипта — с санитайзом значений.
 *
 * Если значение содержит символы, опасные для JS-кода (' " ` \ $ { } ; ( ) и переводы строк),
 * такая переменная НЕ подставляется — остаётся literal {{var}}, чтобы пользователь
 * использовал pm.environment.get("var") явно.
 *
 * Это защищает от поломки скрипта значениями со спецсимволами (например, JWT-токенами).
 */
export function replaceVariablesInScript(script: string, variables: KeyValuePair[]): string {
  if (!script) return script;
  let result = script;

  const DANGEROUS = /["'`\\${};\n\r()]/;

  const sortedVars = [...variables]
    .filter((v) => v.enabled && v.key)
    .sort((a, b) => b.key.length - a.key.length);

  sortedVars.forEach((variable) => {
    // Санитайз: пропускаем значения с опасными символами
    if (DANGEROUS.test(variable.value)) {
      return; // оставляем {{var}} literal — пользователь должен использовать pm.environment.get
    }
    const escapedKey = variable.key.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
    result = result.replace(regex, variable.value);
  });
  return result;
}

export function createScriptContext(
  request: any,
  response: HttpResponse | null,
  envVariables: KeyValuePair[],
  globalVariables: KeyValuePair[],
  iterationData?: Record<string, string>,
  iteration?: number,
  iterationCount?: number
): ScriptContext {
  const env: Record<string, string> = {};
  envVariables.filter((v) => v.enabled && v.key).forEach((v) => { env[v.key] = v.value; });

  const globals: Record<string, string> = {};
  globalVariables.filter((v) => v.enabled && v.key).forEach((v) => { globals[v.key] = v.value; });

  return {
    request: {
      url: request.url || '',
      method: request.method || 'GET',
      headers: {},
      body: request.body?.content || '',
      queryParams: {},
    },
    response: response
      ? {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers || {},
        body: response.data,
        time: response.time,
        size: response.size,
      }
      : undefined,
    environment: env,
    globals,
    iterationData,
    iteration,
    iterationCount,
  };
}