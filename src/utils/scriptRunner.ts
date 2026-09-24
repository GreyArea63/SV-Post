import {
  KeyValuePair,
  TestResult,
  ScriptExecutionResult,
  ScriptContext,
  HttpResponse,
} from '../types';
import { generateId } from './helpers';

/**
 * ScriptRunner — безопасное выполнение Pre-request Scripts и Tests
 * в изолированной песочнице с Postman-совместимым API (pm.*)
 */
export class ScriptRunner {
  private context: ScriptContext;
  private testResults: TestResult[] = [];
  private logs: string[] = [];
  private environmentChanges: KeyValuePair[] = [];
  private globalsChanges: KeyValuePair[] = [];
  private environment: Record<string, string>;
  private globals: Record<string, string>;

  constructor(context: ScriptContext) {
    this.context = context;
    this.environment = { ...context.environment };
    this.globals = { ...context.globals };
  }

  /**
   * Создаёт объект pm с полным Postman-совместимым API
   */
  private createPmObject(response?: HttpResponse) {
    const self = this;

    // ВАЖНО: Извлекаем тело ответа из response.data (а не response.body)
    const responseBody = response ? response.data : null;

    const createExpect = (value: any) => ({
      toBe: (expected: any) => {
        if (value !== expected) {
          throw new Error(
            `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`
          );
        }
      },
      toEqual: (expected: any) => {
        if (JSON.stringify(value) !== JSON.stringify(expected)) {
          throw new Error(
            `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`
          );
        }
      },
      toBeTruthy: () => {
        if (!value) throw new Error(`Expected truthy value but got ${JSON.stringify(value)}`);
      },
      toBeFalsy: () => {
        if (value) throw new Error(`Expected falsy value but got ${JSON.stringify(value)}`);
      },
      toBeDefined: () => {
        if (value === undefined) throw new Error('Expected defined value but got undefined');
      },
      toBeUndefined: () => {
        if (value !== undefined)
          throw new Error(`Expected undefined but got ${JSON.stringify(value)}`);
      },
      toBeNull: () => {
        if (value !== null) throw new Error(`Expected null but got ${JSON.stringify(value)}`);
      },
      toBeGreaterThan: (expected: number) => {
        if (typeof value !== 'number' || value <= expected) {
          throw new Error(`Expected ${value} to be greater than ${expected}`);
        }
      },
      toBeLessThan: (expected: number) => {
        if (typeof value !== 'number' || value >= expected) {
          throw new Error(`Expected ${value} to be less than ${expected}`);
        }
      },
      toBeGreaterThanOrEqual: (expected: number) => {
        if (typeof value !== 'number' || value < expected) {
          throw new Error(`Expected ${value} to be >= ${expected}`);
        }
      },
      toBeLessThanOrEqual: (expected: number) => {
        if (typeof value !== 'number' || value > expected) {
          throw new Error(`Expected ${value} to be <= ${expected}`);
        }
      },
      toInclude: (expected: any) => {
        if (typeof value === 'string') {
          if (!value.includes(expected)) {
            throw new Error(`Expected "${value}" to include "${expected}"`);
          }
        } else if (Array.isArray(value)) {
          if (!value.includes(expected)) {
            throw new Error(`Expected array to include ${JSON.stringify(expected)}`);
          }
        } else {
          throw new Error('toInclude can only be used with strings and arrays');
        }
      },
      toHaveProperty: (key: string) => {
        if (typeof value !== 'object' || value === null || !(key in value)) {
          throw new Error(`Expected object to have property "${key}"`);
        }
      },
      toMatch: (pattern: string | RegExp) => {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        if (typeof value !== 'string' || !regex.test(value)) {
          throw new Error(`Expected "${value}" to match ${pattern}`);
        }
      },
      toHaveLength: (length: number) => {
        if (value === null || value === undefined || value.length !== length) {
          throw new Error(`Expected length ${length} but got ${value?.length}`);
        }
      },
      toBeOneOf: (options: any[]) => {
        if (!options.includes(value)) {
          throw new Error(
            `Expected ${JSON.stringify(value)} to be one of ${JSON.stringify(options)}`
          );
        }
      },
      to: {
        have: {
          property: (key: string) => {
            if (typeof value !== 'object' || value === null || !(key in value)) {
              throw new Error(`Expected object to have property "${key}"`);
            }
          },
          length: (length: number) => {
            if (value?.length !== length) {
              throw new Error(`Expected length ${length} but got ${value?.length}`);
            }
          },
        },
        be: {
          a: (type: string) => {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== type) {
              throw new Error(`Expected type "${type}" but got "${actualType}"`);
            }
          },
        },
      },
    });

    const responseToHave = response
      ? {
        status: (code: number) => {
          if (response.status !== code) {
            throw new Error(`Expected status ${code} but got ${response.status}`);
          }
        },
        header: (key: string) => {
          const headers = response.headers || {};
          const found = Object.keys(headers).some(
            (k) => k.toLowerCase() === key.toLowerCase()
          );
          if (!found) {
            throw new Error(`Expected header "${key}" to be present`);
          }
        },
        jsonBody: () => {
          try {
            if (typeof responseBody === 'string') {
              JSON.parse(responseBody);
            }
          } catch {
            throw new Error('Expected response body to be valid JSON');
          }
        },
        body: () => {
          if (!responseBody) {
            throw new Error('Expected response body to be present');
          }
        },
      }
      : {
        status: () => {
          throw new Error('No response available');
        },
        header: () => {
          throw new Error('No response available');
        },
        jsonBody: () => {
          throw new Error('No response available');
        },
        body: () => {
          throw new Error('No response available');
        },
      };

    return {
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
          status: response.statusText,
          headers: { ...response.headers },
          body: responseBody,
          responseTime: response.time,
          responseSize: response.size,
          json: () => {
            try {
              return typeof responseBody === 'string'
                ? JSON.parse(responseBody)
                : responseBody;
            } catch {
              return null;
            }
          },
          text: () => String(responseBody ?? ''),
          to: {
            have: responseToHave,
          },
        }
        : {
          code: 0,
          status: '',
          headers: {},
          body: null,
          responseTime: 0,
          responseSize: 0,
          json: () => null,
          text: () => '',
          to: {
            have: responseToHave,
          },
        },

      environment: {
        get: (key: string) => self.environment[key] ?? '',
        set: (key: string, value: any) => {
          const strValue = String(value ?? '');
          self.environmentChanges.push({
            id: generateId(),
            key,
            value: strValue,
            enabled: true,
          });
          self.environment[key] = strValue;
        },
        unset: (key: string) => {
          self.environmentChanges.push({
            id: generateId(),
            key,
            value: '',
            enabled: false,
          });
          delete self.environment[key];
        },
        has: (key: string) => key in self.environment,
        toObject: () => ({ ...self.environment }),
        clear: () => {
          Object.keys(self.environment).forEach((key) => {
            self.environmentChanges.push({
              id: generateId(),
              key,
              value: '',
              enabled: false,
            });
          });
          self.environment = {};
        },
      },

      globals: {
        get: (key: string) => self.globals[key] ?? '',
        set: (key: string, value: any) => {
          const strValue = String(value ?? '');
          self.globalsChanges.push({
            id: generateId(),
            key,
            value: strValue,
            enabled: true,
          });
          self.globals[key] = strValue;
        },
        unset: (key: string) => {
          self.globalsChanges.push({
            id: generateId(),
            key,
            value: '',
            enabled: false,
          });
          delete self.globals[key];
        },
        has: (key: string) => key in self.globals,
        toObject: () => ({ ...self.globals }),
        clear: () => {
          Object.keys(self.globals).forEach((key) => {
            self.globalsChanges.push({
              id: generateId(),
              key,
              value: '',
              enabled: false,
            });
          });
          self.globals = {};
        },
      },

      collectionVariables: {
        get: (key: string) => self.globals[key] ?? '',
        set: (key: string, value: any) => {
          const strValue = String(value ?? '');
          self.globalsChanges.push({
            id: generateId(),
            key,
            value: strValue,
            enabled: true,
          });
          self.globals[key] = strValue;
        },
        unset: (key: string) => {
          self.globalsChanges.push({
            id: generateId(),
            key,
            value: '',
            enabled: false,
          });
          delete self.globals[key];
        },
      },

      variables: {
        get: (key: string) => {
          return (
            self.environment[key] ??
            self.globals[key] ??
            self.context.iterationData?.[key] ??
            ''
          );
        },
        set: (key: string, value: any, scope: 'environment' | 'globals' = 'environment') => {
          const strValue = String(value ?? '');
          const change: KeyValuePair = {
            id: generateId(),
            key,
            value: strValue,
            enabled: true,
          };
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
          self.testResults.push({
            name,
            passed: true,
            timestamp: Date.now(),
          });
        } catch (error: any) {
          self.testResults.push({
            name,
            passed: false,
            error: error?.message || 'Assertion failed',
            timestamp: Date.now(),
          });
        }
      },

      expect: (value: any) => createExpect(value),

      log: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          )
          .join(' ');
        self.logs.push(message);
      },

      info: {
        eventName: 'test',
        iteration: self.context.iteration ?? 1,
        iterationCount: self.context.iterationCount ?? 1,
        requestName: '',
        requestId: '',
      },

      skipRequest: () => {
        throw new Error('__SKIP_REQUEST__');
      },

      sendRequest: (
        request: any,
        callback?: (error: any, response: any) => void
      ) => {
        self.logs.push('[pm.sendRequest] Not implemented in browser context');
        if (callback) {
          setTimeout(() => callback(new Error('pm.sendRequest not supported'), null), 0);
        }
        return Promise.reject(new Error('pm.sendRequest not supported in SV-Post'));
      },

      responseCode: response
        ? {
          code: response.status,
          name: response.statusText,
          detail: '',
        }
        : { code: 0, name: '', detail: '' },

      responseHeaders: response?.headers || {},

      responseTime: response?.time || 0,

      responseBody: responseBody ?? '',
    };
  }

  async runScript(
    script: string,
    response?: HttpResponse
  ): Promise<ScriptExecutionResult> {
    if (!script || !script.trim()) {
      return {
        environmentChanges: [],
        globalsChanges: [],
        testResults: [],
        logs: [],
      };
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

      const scriptFunction = new Function(
        'pm',
        'postman',
        'console',
        'require',
        'process',
        'global',
        'window',
        'document',
        script
      );

      await scriptFunction(
        pm,
        pm,
        sandboxConsole,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );

      return {
        environmentChanges: this.environmentChanges,
        globalsChanges: this.globalsChanges,
        testResults: this.testResults,
        logs: this.logs,
      };
    } catch (error: any) {
      if (error?.message === '__SKIP_REQUEST__') {
        return {
          environmentChanges: this.environmentChanges,
          globalsChanges: this.globalsChanges,
          testResults: this.testResults,
          logs: this.logs,
          skipped: true,
        };
      }

      return {
        environmentChanges: this.environmentChanges,
        globalsChanges: this.globalsChanges,
        testResults: this.testResults,
        logs: this.logs,
        error: error?.message || 'Script execution failed',
      };
    }
  }
}

/**
 * Замена переменных {{var}} в тексте скрипта
 */
export function replaceVariablesInScript(
  script: string,
  variables: KeyValuePair[]
): string {
  if (!script) return script;
  let result = script;
  const sortedVars = [...variables]
    .filter((v) => v.enabled && v.key)
    .sort((a, b) => b.key.length - a.key.length);

  sortedVars.forEach((variable) => {
    const escapedKey = variable.key.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
    result = result.replace(regex, variable.value);
  });
  return result;
}

/**
 * Хелпер для создания контекста скрипта из текущего запроса
 */
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
  envVariables
    .filter((v) => v.enabled && v.key)
    .forEach((v) => {
      env[v.key] = v.value;
    });

  const globals: Record<string, string> = {};
  globalVariables
    .filter((v) => v.enabled && v.key)
    .forEach((v) => {
      globals[v.key] = v.value;
    });

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