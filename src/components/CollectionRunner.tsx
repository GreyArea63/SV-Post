import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  X, Play, Square, CheckCircle, XCircle, Clock, Upload,
  TrendingUp, TrendingDown, Loader2, AlertTriangle, Copy,
  MessageSquare, ExternalLink,
} from 'lucide-react';
import { HttpRequest, Environment, KeyValuePair, HttpResponse, ScriptExecutionResult } from '../types';
import { parseCSV } from '../utils/csvParser';
import { generateId, replaceVariables, parseKeyValuePairs } from '../utils/helpers';
import {
  ScriptRunner,
  createScriptContext,
  replaceVariablesInScript,
} from '../utils/scriptRunner';
import axios from 'axios';

interface RunResult {
  iteration: number;
  requestIndex: number;
  requestName: string;
  status: number | string;
  success: boolean;
  time: number;
  error?: string;
  requestData?: Record<string, any>;
  requestMethod?: string;
  requestUrl?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseData?: any;
  testResults?: { name: string; passed: boolean; error?: string }[];
  scriptLogs?: string[];
}

interface CollectionRunnerProps {
  requests: HttpRequest[];
  collectionName: string;
  environments: Environment[];
  activeEnvId: string | null;
  globalVariables: KeyValuePair[];
  onClose: () => void;
  onError?: (message: string) => void;
}

// ✅ In-memory override переменных в рамках Runner.
// Изменения pm.environment.set / pm.globals.set применяются на лету,
// как в Postman с опцией "Keep variable values".
interface RunnerVars {
  env: Record<string, string>;
  globals: Record<string, string>;
  envUnset: Set<string>;
  globalsUnset: Set<string>;
}

const emptyVars = (): RunnerVars => ({
  env: {},
  globals: {},
  envUnset: new Set(),
  globalsUnset: new Set(),
});

/**
 * Строит итоговый список переменных: env + globals + data-строка,
 * с учётом override от скриптов (pm.environment.set/unset).
 */
const buildVariables = (
  baseEnv: KeyValuePair[],
  baseGlobals: KeyValuePair[],
  dataVars: KeyValuePair[],
  overrides: RunnerVars
): KeyValuePair[] => {
  const result: KeyValuePair[] = [];

  // globals
  baseGlobals
    .filter(v => v.enabled)
    .forEach(v => {
      if (overrides.globalsUnset.has(v.key)) return;
      const value = overrides.globals[v.key] ?? v.value;
      result.push({ ...v, value });
    });
  // новые globals из скрипта
  Object.entries(overrides.globals).forEach(([key, value]) => {
    if (!result.find(v => v.key === key) && !overrides.globalsUnset.has(key)) {
      result.push({ id: 'script_g_' + key, key, value, enabled: true });
    }
  });

  // env
  baseEnv
    .filter(v => v.enabled)
    .forEach(v => {
      if (overrides.envUnset.has(v.key)) return;
      const value = overrides.env[v.key] ?? v.value;
      result.push({ ...v, value });
    });
  Object.entries(overrides.env).forEach(([key, value]) => {
    if (!result.find(v => v.key === key) && !overrides.envUnset.has(key)) {
      result.push({ id: 'script_e_' + key, key, value, enabled: true });
    }
  });

  // data vars — приоритет выше env/globals (как в Postman)
  dataVars.forEach(v => {
    const idx = result.findIndex(r => r.key === v.key);
    if (idx >= 0) result[idx] = { ...result[idx], value: v.value };
    else result.push(v);
  });

  return result;
};

/**
 * Сливает changes из ScriptExecutionResult в RunnerVars.
 */
const mergeChanges = (vars: RunnerVars, result: ScriptExecutionResult | null): RunnerVars => {
  if (!result) return vars;
  const next: RunnerVars = {
    env: { ...vars.env },
    globals: { ...vars.globals },
    envUnset: new Set(vars.envUnset),
    globalsUnset: new Set(vars.globalsUnset),
  };
  result.environmentChanges.forEach(c => {
    if (c.enabled) { next.env[c.key] = c.value; next.envUnset.delete(c.key); }
    else { delete next.env[c.key]; next.envUnset.add(c.key); }
  });
  result.globalsChanges.forEach(c => {
    if (c.enabled) { next.globals[c.key] = c.value; next.globalsUnset.delete(c.key); }
    else { delete next.globals[c.key]; next.globalsUnset.add(c.key); }
  });
  return next;
};

// ИСПРАВЛЕНИЕ 3.25: ограничение результатов
const MAX_RESULTS = 1000;
const MAX_SCRIPT_RETRIES = 2;

const HTTP_ERROR_DESCRIPTIONS: Record<number, { title: string; description: string; solution: string }> = {
  400: { title: 'Bad Request — Неверный запрос', description: 'Сервер не может обработать запрос из-за синтаксической ошибки.', solution: 'Проверьте правильность JSON-структуры и формат данных.' },
  401: { title: 'Unauthorized — Не авторизован', description: 'Запрос требует аутентификации. Токен отсутствует или недействителен.', solution: 'Проверьте токен авторизации во вкладке Authorization.' },
  403: { title: 'Forbidden — Доступ запрещен', description: 'Сервер понял запрос, но отказывается его выполнять.', solution: 'Проверьте права доступа пользователя или scope токена.' },
  404: { title: 'Not Found — Не найдено', description: 'Запрашиваемый ресурс не найден на сервере.', solution: 'Проверьте правильность URL и переменных окружения.' },
  405: { title: 'Method Not Allowed', description: 'HTTP-метод не поддерживается для данного endpoint.', solution: 'Измените метод запроса (GET/POST/PUT/DELETE) на поддерживаемый.' },
  408: { title: 'Request Timeout', description: 'Сервер не дождался полного запроса.', solution: 'Увеличьте таймаут в настройках или проверьте сеть.' },
  422: { title: 'Unprocessable Entity', description: 'Запрос синтаксически корректен, но содержит семантические ошибки.', solution: 'Проверьте бизнес-логику: уникальность полей, диапазоны значений.' },
  429: { title: 'Too Many Requests', description: 'Превышен лимит запросов (rate limit).', solution: 'Увеличьте задержку между запросами в настройках Runner (например, 1000 мс).' },
  500: { title: 'Internal Server Error', description: 'Сервер столкнулся с непредвиденной ситуацией.', solution: 'Проблема на стороне сервера. Проверьте логи сервера.' },
  502: { title: 'Bad Gateway', description: 'Сервер получил недействительный ответ от вышестоящего сервера.', solution: 'Проблема с инфраструктурой. Попробуйте повторить позже.' },
  503: { title: 'Service Unavailable', description: 'Сервер временно не может обработать запрос.', solution: 'Подождите и повторите попытку.' },
  504: { title: 'Gateway Timeout', description: 'Сервер не дождался ответа от вышестоящего сервера.', solution: 'Увеличьте таймаут или проверьте доступность сервиса.' },
};

const NETWORK_ERROR_DESCRIPTIONS: Record<string, { title: string; description: string; solution: string }> = {
  ECONNREFUSED: { title: 'Connection Refused', description: 'Сервер активно отклонил подключение.', solution: 'Убедитесь, что сервер запущен и слушает указанный порт.' },
  ENOTFOUND: { title: 'DNS Not Found', description: 'Не удалось разрешить DNS-имя хоста.', solution: 'Проверьте правильность URL и доступность домена.' },
  ETIMEDOUT: { title: 'Connection Timeout', description: 'Не удалось установить соединение в отведенное время.', solution: 'Проверьте сетевое подключение и настройки firewall.' },
  ECONNRESET: { title: 'Connection Reset', description: 'Соединение было принудительно закрыто.', solution: 'Проверьте стабильность сети.' },
  ERR_NETWORK: { title: 'Network Error', description: 'Произошла ошибка сети.', solution: 'Проверьте интернет-соединение и настройки CORS.' },
  ERR_CANCELED: { title: 'Request Canceled', description: 'Запрос был отменен пользователем.', solution: 'Это нормальное поведение при остановке Runner.' },
};

const getErrorDetails = (error: string, status: number | string) => {
  if (typeof status === 'number' && HTTP_ERROR_DESCRIPTIONS[status]) {
    return HTTP_ERROR_DESCRIPTIONS[status];
  }
  for (const [code, desc] of Object.entries(NETWORK_ERROR_DESCRIPTIONS)) {
    if (error && error.includes(code)) return desc;
  }
  return {
    title: 'Unknown Error — Неизвестная ошибка',
    description: error || 'Произошла непредвиденная ошибка.',
    solution: 'Проверьте логи, сетевое подключение и настройки запроса.',
  };
};

export const CollectionRunner: React.FC<CollectionRunnerProps> = ({
  requests,
  collectionName,
  environments,
  activeEnvId,
  globalVariables,
  onClose,
  onError,
}) => {
  const [iterations, setIterations] = useState(1);
  const [delay, setDelay] = useState(0);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [results, setResults] = useState<RunResult[]>([]);
  const [totalIterations, setTotalIterations] = useState(0);
  const [selectedError, setSelectedError] = useState<RunResult | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const isCancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (parsedData.length > 0) {
      setTotalIterations(Math.min(iterations, parsedData.length));
    } else {
      setTotalIterations(iterations);
    }
  }, [iterations, parsedData]);

  // ИСПРАВЛЕНИЕ 3.45: clearTimeout для уведомлений
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) clearTimeout(copyFeedbackTimerRef.current);
    };
  }, []);

  const showError = useCallback((message: string) => {
    if (onErrorRef.current) {
      onErrorRef.current(message);
    } else {
      window.alert(message);
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDataFile(file);
    const text = await file.text();
    try {
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        const data = Array.isArray(parsed) ? parsed : [parsed];
        setParsedData(data);
        setIterations(data.length);
        setTotalIterations(data.length);
      } else if (file.name.endsWith('.csv')) {
        const data = parseCSV(text);
        setParsedData(data);
        setIterations(data.length);
        setTotalIterations(data.length);
      } else {
        showError('Поддерживаются только .json и .csv файлы');
      }
    } catch (err: any) {
      showError('Ошибка парсинга файла: ' + (err.message || 'неизвестная ошибка'));
    }
  };

  /**
   * Выполняет скрипт (pre-request / test) через ScriptRunner.
   * Возвращает результат или null.
   */
  const runScript = useCallback(async (
    scriptType: 'preRequest' | 'test',
    script: string,
    request: HttpRequest,
    response: HttpResponse | null,
    envVars: KeyValuePair[],
    globals: KeyValuePair[],
    dataVars: KeyValuePair[],
    iteration: number,
    iterationCount: number
  ): Promise<ScriptExecutionResult | null> => {
    let finalScript = script || '';
    if (scriptType === 'test' && activeEnvId) {
      const env = environments.find(e => e.id === activeEnvId);
      const globalScript = env?.globalTestScript || '';
      if (globalScript.trim()) {
        finalScript = globalScript + '\n\n' + finalScript;
      }
    }
    if (!finalScript.trim()) return null;

    // Резолв {{var}} для pm.request.headers
    const allVars = [...globals, ...envVars, ...dataVars];

    const requestHeaders: Record<string, string> = {};
    request.headers.filter(h => h.enabled && h.key).forEach(h => {
      requestHeaders[h.key] = replaceVariables(h.value, allVars);
    });

    const context = createScriptContext(
      {
        ...request,
        url: replaceVariables(request.url, allVars),
        headers: request.headers.map(h => ({
          ...h,
          value: replaceVariables(h.value, allVars),
        })),
      },
      response,
      envVars,
      globals,
      Object.fromEntries(dataVars.map(v => [v.key, v.value])),
      iteration,
      iterationCount
    );
    context.request.headers = requestHeaders;

    const runner = new ScriptRunner(context);
    const processedScript = replaceVariablesInScript(finalScript, allVars);

    return await runner.runScript(processedScript, response || undefined);
  }, [activeEnvId, environments]);

  const startRun = useCallback(async () => {
    isCancelledRef.current = false;
    setIsRunning(true);
    setResults([]);
    setCurrentIteration(0);
    abortControllerRef.current = new AbortController();

    const activeEnv = environments.find(e => e.id === activeEnvId);
    const baseEnvVars = activeEnv?.variables.filter(v => v.enabled) || [];
    const baseGlobals = globalVariables.filter(v => v.enabled);
    const dataRows = parsedData.length > 0 ? parsedData.slice(0, iterations) : Array(iterations).fill({});
    const totalRequests = requests.length;
    const effectiveIterations = dataRows.length;

    // ✅ In-memory переменные Runner'а (переживают все итерации)
    let runnerVars = emptyVars();

    for (let i = 0; i < effectiveIterations; i++) {
      if (isCancelledRef.current) break;

      setCurrentIteration(i + 1);
      const rowData = dataRows[i];
      const dataVars: KeyValuePair[] = Object.entries(rowData).map(([key, value]) => ({
        id: generateId(), key, value: String(value), enabled: true,
      }));

      for (let j = 0; j < totalRequests; j++) {
        if (isCancelledRef.current) break;

        const req = requests[j];

        // ✅ Собираем актуальный список переменных (с учётом override от скриптов)
        const allVariables = buildVariables(baseEnvVars, baseGlobals, dataVars, runnerVars);

        // === PRE-REQUEST LOOP (с поддержкой retry) ===
        let attempt = 0;
        let accumulatedLogs: string[] = [];
        let skipThisRequest = false;
        let lastHttpResponse: HttpResponse | null = null;
        let lastTestResult: ScriptExecutionResult | null = null;

        while (attempt <= MAX_SCRIPT_RETRIES) {
          const startTime = Date.now();

          // 1. Pre-request script
          let preRequestResult: ScriptExecutionResult | null = null;
          if (req.scripts?.preRequest?.trim()) {
            preRequestResult = await runScript(
              'preRequest',
              req.scripts.preRequest,
              req,
              null,
              baseEnvVars,
              baseGlobals,
              dataVars,
              i + 1,
              effectiveIterations
            );
            if (preRequestResult) {
              accumulatedLogs = [...accumulatedLogs, ...(preRequestResult.logs || [])];
              runnerVars = mergeChanges(runnerVars, preRequestResult);

              if (preRequestResult.error) {
                accumulatedLogs.push(`[Pre-request error] ${preRequestResult.error}`);
                const newResult: RunResult = {
                  iteration: i + 1,
                  requestIndex: j,
                  requestName: req.name,
                  status: 'Script Error',
                  success: false,
                  time: Date.now() - startTime,
                  error: preRequestResult.error,
                  requestData: rowData,
                  requestMethod: req.method,
                  requestUrl: req.url,
                  scriptLogs: accumulatedLogs,
                };
                setResults(prev => {
                  const updated = [...prev, newResult];
                  return updated.length > MAX_RESULTS ? updated.slice(-MAX_RESULTS) : updated;
                });
                skipThisRequest = true;
                break;
              }

              if (preRequestResult.skipped) {
                accumulatedLogs.push('[Pre-request] Request skipped by script');
                const newResult: RunResult = {
                  iteration: i + 1,
                  requestIndex: j,
                  requestName: req.name,
                  status: 'Skipped',
                  success: true,
                  time: Date.now() - startTime,
                  requestData: rowData,
                  scriptLogs: accumulatedLogs,
                  testResults: preRequestResult.testResults,
                };
                setResults(prev => {
                  const updated = [...prev, newResult];
                  return updated.length > MAX_RESULTS ? updated.slice(-MAX_RESULTS) : updated;
                });
                skipThisRequest = true;
                break;
              }
            }
          }

          // 2. Формируем и шлём запрос с актуальными переменными (включая изменения из pre-request)
          const liveVars = buildVariables(baseEnvVars, baseGlobals, dataVars, runnerVars);

          try {
            const processedReq = {
              ...req,
              url: replaceVariables(req.url, liveVars),
              headers: req.headers.map(h => ({ ...h, value: replaceVariables(h.value, liveVars) })),
              queryParams: req.queryParams.map(p => ({ ...p, value: replaceVariables(p.value, liveVars) })),
              body: { ...req.body, content: replaceVariables(req.body.content, liveVars) },
              auth: req.auth ? {
                ...req.auth,
                token: req.auth.token ? replaceVariables(req.auth.token, liveVars) : req.auth.token,
                username: req.auth.username ? replaceVariables(req.auth.username, liveVars) : req.auth.username,
                password: req.auth.password ? replaceVariables(req.auth.password, liveVars) : req.auth.password,
                apiKey: req.auth.apiKey ? replaceVariables(req.auth.apiKey, liveVars) : req.auth.apiKey,
                apiValue: req.auth.apiValue ? replaceVariables(req.auth.apiValue, liveVars) : req.auth.apiValue,
                accessToken: req.auth.accessToken ? replaceVariables(req.auth.accessToken, liveVars) : req.auth.accessToken,
                tokenType: req.auth.tokenType ? replaceVariables(req.auth.tokenType, liveVars) : req.auth.tokenType,
              } : req.auth,
            };

            let url = processedReq.url;
            const queryParams = parseKeyValuePairs(processedReq.queryParams);
            if (Object.keys(queryParams).length > 0) {
              url += (url.includes('?') ? '&' : '?') + new URLSearchParams(queryParams).toString();
            }

            const headers = parseKeyValuePairs(processedReq.headers);

            // Auth
            if (processedReq.auth) {
              const removeH = (name: string) => {
                const lower = name.toLowerCase();
                Object.keys(headers).forEach(k => { if (k.toLowerCase() === lower) delete headers[k]; });
              };
              removeH('Authorization');
              if (processedReq.auth.type === 'bearer' && processedReq.auth.token) {
                headers['Authorization'] = `Bearer ${processedReq.auth.token}`;
              } else if (processedReq.auth.type === 'basic' && processedReq.auth.username) {
                headers['Authorization'] = `Basic ${btoa(unescape(encodeURIComponent(`${processedReq.auth.username}:${processedReq.auth.password || ''}`)))}`;
              } else if (processedReq.auth.type === 'apikey' && processedReq.auth.apiKey && processedReq.auth.apiValue) {
                if (processedReq.auth.addTo === 'header') {
                  removeH(processedReq.auth.apiKey);
                  headers[processedReq.auth.apiKey] = processedReq.auth.apiValue;
                } else {
                  const sp = new URLSearchParams(url.split('?')[1] || '');
                  sp.set(processedReq.auth.apiKey, processedReq.auth.apiValue);
                  url += (url.includes('?') ? '&' : '?') + sp.toString();
                }
              } else if (processedReq.auth.type === 'oauth2' && processedReq.auth.accessToken) {
                headers['Authorization'] = `${processedReq.auth.tokenType || 'Bearer'} ${processedReq.auth.accessToken}`;
              }
            }

            const config: any = {
              method: processedReq.method.toLowerCase(),
              url,
              headers,
              timeout: req.settings?.timeout ?? 30000,
              maxRedirects: req.settings?.followRedirects === false ? 0 : 5,
              signal: abortControllerRef.current!.signal,
            };

            if (processedReq.body.type !== 'none' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(processedReq.method)) {
              const hasManualCT = Object.keys(headers).some(k => k.toLowerCase() === 'content-type');
              if (processedReq.body.type === 'json' || processedReq.body.type === 'raw') {
                try { config.data = JSON.parse(processedReq.body.content); }
                catch { config.data = processedReq.body.content; }
                if (!hasManualCT) headers['Content-Type'] = 'application/json';
              } else if (processedReq.body.type === 'x-www-form-urlencoded') {
                if (processedReq.body.form && processedReq.body.form.length > 0) {
                  const fd = new URLSearchParams();
                  processedReq.body.form.forEach(f => { if (f.enabled && f.key) fd.append(f.key, f.value); });
                  config.data = fd.toString();
                } else {
                  config.data = processedReq.body.content;
                }
                if (!hasManualCT) headers['Content-Type'] = 'application/x-www-form-urlencoded';
              } else if (processedReq.body.type === 'form-data') {
                if (processedReq.body.form && processedReq.body.form.length > 0) {
                  const fd = new FormData();
                  processedReq.body.form.forEach(f => { if (f.enabled && f.key) fd.append(f.key, f.value); });
                  config.data = fd;
                }
              } else if (processedReq.body.type === 'graphql') {
                try {
                  const g = JSON.parse(processedReq.body.content);
                  config.data = { query: g.query || '', variables: g.variables || {}, operationName: g.operationName || null };
                } catch {
                  config.data = { query: processedReq.body.content };
                }
                if (!hasManualCT) headers['Content-Type'] = 'application/json';
              } else {
                config.data = processedReq.body.content;
              }
            }

            const axiosResponse = await axios(config);
            const httpResponse: HttpResponse = {
              status: axiosResponse.status,
              statusText: axiosResponse.statusText,
              headers: (axiosResponse.headers as any).toJSON ? (axiosResponse.headers as any).toJSON() : axiosResponse.headers,
              data: axiosResponse.data,
              time: Date.now() - startTime,
              size: new Blob([JSON.stringify(axiosResponse.data)]).size,
            };
            lastHttpResponse = httpResponse;

            // 3. Test script
            let testResult: ScriptExecutionResult | null = null;
            const hasTestScript = req.scripts?.test?.trim() || activeEnv?.globalTestScript?.trim();
            if (hasTestScript) {
              testResult = await runScript(
                'test',
                req.scripts?.test || '',
                req,
                httpResponse,
                baseEnvVars,
                baseGlobals,
                dataVars,
                i + 1,
                effectiveIterations
              );
              if (testResult) {
                lastTestResult = testResult;
                accumulatedLogs = [...accumulatedLogs, ...(testResult.logs || [])];
                runnerVars = mergeChanges(runnerVars, testResult);
              }
            }

            // 4. Retry?
            if (testResult?.retry && attempt < MAX_SCRIPT_RETRIES) {
              attempt++;
              accumulatedLogs.push(`[Retry] Attempt ${attempt}/${MAX_SCRIPT_RETRIES} after pm.retryRequest()`);
              if (delay > 0 && !isCancelledRef.current) {
                await new Promise(r => setTimeout(r, delay));
              }
              continue; // → перезапуск pre-request с обновлённым токеном
            }

            // 5. Финализация результата
            const newResult: RunResult = {
              iteration: i + 1,
              requestIndex: j,
              requestName: req.name,
              status: httpResponse.status,
              success: httpResponse.status >= 200 && httpResponse.status < 300,
              time: httpResponse.time,
              requestData: rowData,
              requestMethod: processedReq.method,
              requestUrl: processedReq.url,
              requestHeaders: headers,
              requestBody: processedReq.body.content,
              responseHeaders: httpResponse.headers,
              responseData: httpResponse.data,
              testResults: testResult?.testResults,
              scriptLogs: accumulatedLogs,
            };
            setResults(prev => {
              const updated = [...prev, newResult];
              return updated.length > MAX_RESULTS ? updated.slice(-MAX_RESULTS) : updated;
            });
            break; // выходим из retry-цикла, переходим к след. запросу

          } catch (err: any) {
            if (axios.isCancel(err)) { skipThisRequest = true; break; }

            if (err.response) {
              const httpResponse: HttpResponse = {
                status: err.response.status,
                statusText: err.response.statusText,
                headers: (err.response.headers as any).toJSON ? (err.response.headers as any).toJSON() : err.response.headers,
                data: err.response.data,
                time: Date.now() - startTime,
                size: new Blob([JSON.stringify(err.response.data)]).size,
              };
              lastHttpResponse = httpResponse;

              // Test script на ошибочном статусе (например, 401)
              let testResult: ScriptExecutionResult | null = null;
              const hasTestScript = req.scripts?.test?.trim() || activeEnv?.globalTestScript?.trim();
              if (hasTestScript) {
                testResult = await runScript(
                  'test',
                  req.scripts?.test || '',
                  req,
                  httpResponse,
                  baseEnvVars,
                  baseGlobals,
                  dataVars,
                  i + 1,
                  effectiveIterations
                );
                if (testResult) {
                  lastTestResult = testResult;
                  accumulatedLogs = [...accumulatedLogs, ...(testResult.logs || [])];
                  runnerVars = mergeChanges(runnerVars, testResult);
                }
              }

              if (testResult?.retry && attempt < MAX_SCRIPT_RETRIES) {
                attempt++;
                accumulatedLogs.push(`[Retry] Attempt ${attempt}/${MAX_SCRIPT_RETRIES} after pm.retryRequest() (${httpResponse.status})`);
                if (delay > 0 && !isCancelledRef.current) {
                  await new Promise(r => setTimeout(r, delay));
                }
                continue;
              }

              const processedReqForError = {
                ...req,
                url: replaceVariables(req.url, liveVars),
                headers: req.headers.map(h => ({ ...h, value: replaceVariables(h.value, liveVars) })),
                queryParams: req.queryParams.map(p => ({ ...p, value: replaceVariables(p.value, liveVars) })),
                body: { ...req.body, content: replaceVariables(req.body.content, liveVars) },
              };
              const errorHeaders = parseKeyValuePairs(processedReqForError.headers);
              let errorUrl = processedReqForError.url;
              const errorQP = parseKeyValuePairs(processedReqForError.queryParams);
              if (Object.keys(errorQP).length > 0) {
                errorUrl += (errorUrl.includes('?') ? '&' : '?') + new URLSearchParams(errorQP).toString();
              }

              const newResult: RunResult = {
                iteration: i + 1,
                requestIndex: j,
                requestName: req.name,
                status: httpResponse.status,
                success: false,
                time: httpResponse.time,
                error: `HTTP ${httpResponse.status}`,
                requestData: rowData,
                requestMethod: processedReqForError.method,
                requestUrl: errorUrl,
                requestHeaders: errorHeaders,
                requestBody: processedReqForError.body.content,
                responseHeaders: httpResponse.headers,
                responseData: httpResponse.data,
                testResults: testResult?.testResults,
                scriptLogs: accumulatedLogs,
              };
              setResults(prev => {
                const updated = [...prev, newResult];
                return updated.length > MAX_RESULTS ? updated.slice(-MAX_RESULTS) : updated;
              });
              break;
            }

            // Network error — без response
            const processedReqForError = {
              ...req,
              url: replaceVariables(req.url, liveVars),
              headers: req.headers.map(h => ({ ...h, value: replaceVariables(h.value, liveVars) })),
              queryParams: req.queryParams.map(p => ({ ...p, value: replaceVariables(p.value, liveVars) })),
              body: { ...req.body, content: replaceVariables(req.body.content, liveVars) },
            };
            const errorHeaders = parseKeyValuePairs(processedReqForError.headers);
            let errorUrl = processedReqForError.url;
            const errorQP = parseKeyValuePairs(processedReqForError.queryParams);
            if (Object.keys(errorQP).length > 0) {
              errorUrl += (errorUrl.includes('?') ? '&' : '?') + new URLSearchParams(errorQP).toString();
            }

            const newResult: RunResult = {
              iteration: i + 1,
              requestIndex: j,
              requestName: req.name,
              status: 'Error',
              success: false,
              time: Date.now() - startTime,
              error: err.message || 'Unknown error',
              requestData: rowData,
              requestMethod: processedReqForError.method,
              requestUrl: errorUrl,
              requestHeaders: errorHeaders,
              requestBody: processedReqForError.body.content,
              scriptLogs: accumulatedLogs,
            };
            setResults(prev => {
              const updated = [...prev, newResult];
              return updated.length > MAX_RESULTS ? updated.slice(-MAX_RESULTS) : updated;
            });
            break;
          }
        }

        if (skipThisRequest && isCancelledRef.current) break;

        // Задержка между запросами
        if (delay > 0 && !isCancelledRef.current) {
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (!isCancelledRef.current) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }

    isCancelledRef.current = false;
    setIsRunning(false);
  }, [environments, activeEnvId, globalVariables, parsedData, iterations, requests, delay, runScript]);

  const stopRun = useCallback(() => {
    isCancelledRef.current = true;
    abortControllerRef.current?.abort();
    setIsRunning(false);
  }, []);

  const handleRowDoubleClick = useCallback((result: RunResult) => {
    if (!result.success) setSelectedError(result);
  }, []);

  const successCount = useMemo(() => results.filter(r => r.success).length, [results]);
  const failCount = useMemo(() => results.filter(r => !r.success).length, [results]);
  const requestName = requests.length === 1 ? requests[0].name : `${requests.length} запросов`;
  const progress = totalIterations > 0 ? (currentIteration / totalIterations) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
              <Play size={16} className="text-white" />
            </div>
            Runner: {collectionName || requestName}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-all" aria-label="Close">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/3 border-r border-[rgba(255,255,255,0.08)] p-4 space-y-4 overflow-y-auto">
            {!isRunning ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Итерации</label>
                  <input
                    type="number" min="1" value={iterations}
                    onChange={(e) => setIterations(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 transition-all"
                  />
                  {parsedData.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1.5">* Будет выполнено {Math.min(iterations, parsedData.length)} итераций по файлу</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Задержка (мс)</label>
                  <input
                    type="number" min="0" step="100" value={delay}
                    onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Файл данных</label>
                  <label className="flex items-center justify-center w-full px-3 py-4 border-2 border-dashed border-[rgba(255,255,255,0.15)] rounded-lg cursor-pointer hover:border-gray-500/50 hover:bg-gray-500/5 transition-all">
                    <input type="file" accept=".csv,.json" className="hidden" onChange={handleFileUpload} />
                    <div className="text-center">
                      <Upload size={20} className="mx-auto text-gray-500 mb-1" />
                      <span className="text-xs text-gray-400">{dataFile ? dataFile.name : 'Нажмите для загрузки'}</span>
                    </div>
                  </label>
                  {parsedData.length > 0 && (
                    <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                      <CheckCircle size={12} /> Загружено строк: {parsedData.length}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <p className="text-[10px] text-blue-400 leading-relaxed">
                    💡 Pre-request и Tests скрипты выполняются автоматически на каждой итерации.
                    Изменения переменных через <code className="font-mono">pm.environment.set()</code> сохраняются между итерациями.
                  </p>
                </div>

                <button
                  onClick={startRun}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 rounded-lg text-sm transition-all text-white font-medium shadow-lg shadow-blue-500/30 border border-blue-400/30 active:translate-y-0.5"
                >
                  <Play size={16} /> Запустить
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center p-4 bg-gradient-to-br from-gray-600/20 to-gray-700/20 rounded-lg border border-gray-500/30">
                  <div className="text-3xl font-bold text-gray-200 mb-1">{currentIteration} / {totalIterations}</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider">Текущая итерация</div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Прогресс</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#2d2d2d] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-gray-500 to-gray-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp size={12} className="text-emerald-400" />
                      <span className="text-xs text-gray-400">Успешно</span>
                    </div>
                    <div className="text-xl font-bold text-emerald-400">{successCount}</div>
                  </div>
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingDown size={12} className="text-red-400" />
                      <span className="text-xs text-gray-400">Ошибок</span>
                    </div>
                    <div className="text-xl font-bold text-red-400">{failCount}</div>
                  </div>
                </div>

                <button
                  onClick={stopRun}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 rounded-lg text-sm transition-all text-white font-medium shadow-lg shadow-red-500/30 border border-red-400/30 active:translate-y-0.5"
                >
                  <Square size={16} /> Стоп
                </button>
              </div>
            )}
          </div>

          <div className="w-2/3 flex flex-col">
            <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Результаты выполнения</h3>
              <span className="text-[10px] text-gray-500 italic">Двойной клик по ошибке — детали</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {results.length === 0 && !isRunning && (
                <div className="text-center text-gray-500 py-12">
                  <Clock size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Нажмите "Запустить" для начала</p>
                </div>
              )}

              {results.map((result, index) => (
                <div
                  key={index}
                  onDoubleClick={() => handleRowDoubleClick(result)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${result.success
                      ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                      : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 cursor-pointer'
                    }`}
                  title={!result.success ? 'Двойной клик для подробностей' : ''}
                >
                  {result.success ? (
                    <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200">
                      Итерация #{result.iteration}
                      {result.requestName && (
                        <span className="text-xs text-gray-500 ml-2">• {result.requestName}</span>
                      )}
                      {result.requestData && Object.keys(result.requestData).length > 0 && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({Object.entries(result.requestData).map(([k, v]) => `${k}=${v}`).join(', ')})
                        </span>
                      )}
                    </div>
                    {result.error && (
                      <div className="text-xs text-red-400 truncate mt-0.5" title={result.error}>{result.error}</div>
                    )}
                    {result.testResults && result.testResults.length > 0 && (
                      <div className="text-[10px] mt-0.5 flex items-center gap-1">
                        <span className={
                          result.testResults.some(t => !t.passed)
                            ? 'text-red-400'
                            : 'text-emerald-400'
                        }>
                          Tests: {result.testResults.filter(t => t.passed).length}/{result.testResults.length}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result.status}
                    </div>
                    <div className="text-xs text-gray-500">{result.time} мс</div>
                  </div>
                </div>
              ))}

              {isRunning && (
                <div className="flex items-center gap-3 p-3 bg-gray-500/10 rounded-lg border border-gray-500/30 animate-pulse">
                  <Loader2 size={18} className="text-gray-400 shrink-0 animate-spin" />
                  <div className="text-sm text-gray-300">Выполняется итерация {currentIteration} из {totalIterations}...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedError && (
        <ErrorDetailModal
          result={selectedError}
          onClose={() => setSelectedError(null)}
          copyFeedback={copyFeedback}
          setCopyFeedback={setCopyFeedback}
        />
      )}
    </div>
  );
};

interface ErrorDetailModalProps {
  result: RunResult;
  onClose: () => void;
  copyFeedback: string | null;
  setCopyFeedback: (feedback: string | null) => void;
}

const ErrorDetailModal: React.FC<ErrorDetailModalProps> = ({ result, onClose, copyFeedback, setCopyFeedback }) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'request' | 'response' | 'scripts'>('overview');
  const errorDetails = getErrorDetails(result.error || '', result.status);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(label);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyFeedback(null), 1500);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopyFeedback(label);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyFeedback(null), 1500);
    });
  };

  const hasScripts = (result.scriptLogs && result.scriptLogs.length > 0) ||
    (result.testResults && result.testResults.length > 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-scale-in">
      <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)] bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-200">{errorDetails.title}</h3>
              <p className="text-xs text-gray-500">Итерация #{result.iteration} • {result.time} мс</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-all" aria-label="Close">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="flex border-b border-[rgba(255,255,255,0.08)] bg-[#1e1e1e]">
          {[
            { id: 'overview', label: 'Обзор', icon: <MessageSquare size={14} /> },
            { id: 'request', label: 'Запрос', icon: <ExternalLink size={14} /> },
            { id: 'response', label: 'Ответ', icon: <MessageSquare size={14} /> },
            ...(hasScripts ? [{ id: 'scripts', label: 'Scripts', icon: <ExternalLink size={14} /> }] : []),
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-all ${activeSection === tab.id
                  ? 'text-gray-200 bg-[#2d2d2d] border-b-2 border-gray-400'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-300 mb-2">{errorDetails.description}</p>
                    <div className="text-xs text-gray-500 font-mono bg-black/30 rounded px-2 py-1.5 break-all">{result.error || 'Нет деталей ошибки'}</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Как исправить</div>
                    <p className="text-sm text-gray-300">{errorDetails.solution}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#2d2d2d] rounded-lg border border-[rgba(255,255,255,0.08)]">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Метод</div>
                  <div className="text-sm font-bold text-amber-400">{result.requestMethod || 'N/A'}</div>
                </div>
                <div className="p-3 bg-[#2d2d2d] rounded-lg border border-[rgba(255,255,255,0.08)]">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Статус</div>
                  <div className="text-sm font-bold text-red-400">{result.status}</div>
                </div>
                <div className="p-3 bg-[#2d2d2d] rounded-lg border border-[rgba(255,255,255,0.08)] col-span-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">URL</div>
                  <div className="text-xs font-mono text-gray-300 break-all">{result.requestUrl || 'N/A'}</div>
                </div>
              </div>

              {result.requestData && Object.keys(result.requestData).length > 0 && (
                <div className="p-3 bg-[#2d2d2d] rounded-lg border border-[rgba(255,255,255,0.08)]">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Данные итерации</div>
                  <div className="space-y-1">
                    {Object.entries(result.requestData).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="text-indigo-400 font-mono min-w-[100px]">{key}:</span>
                        <span className="text-gray-300 font-mono break-all">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'request' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">URL запроса</div>
                  <button onClick={() => copyToClipboard(`${result.requestMethod} ${result.requestUrl || ''}`, 'url')} className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded transition-all">
                    <Copy size={10} /> {copyFeedback === 'url' ? 'Скопировано!' : 'Копировать'}
                  </button>
                </div>
                <div className="p-3 bg-[#2d2d2d] rounded-lg border border-[rgba(255,255,255,0.08)] font-mono text-xs text-gray-300 break-all">
                  {result.requestMethod} {result.requestUrl || 'N/A'}
                </div>
              </div>

              {result.requestHeaders && Object.keys(result.requestHeaders).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Заголовки</div>
                    <button onClick={() => copyToClipboard(JSON.stringify(result.requestHeaders, null, 2), 'headers')} className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded transition-all">
                      <Copy size={10} /> {copyFeedback === 'headers' ? 'Скопировано!' : 'Копировать'}
                    </button>
                  </div>
                  <div className="p-3 bg-[#2d2d2d] rounded-lg border border-[rgba(255,255,255,0.08)] space-y-1 max-h-[200px] overflow-y-auto">
                    {Object.entries(result.requestHeaders).map(([key, value]) => (
                      <div key={key} className="flex gap-2 text-xs">
                        <span className="text-indigo-400 font-mono min-w-[140px] shrink-0">{key}:</span>
                        <span className="text-gray-300 font-mono break-all">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.requestBody && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Тело запроса</div>
                    <button onClick={() => copyToClipboard(result.requestBody || '', 'body')} className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded transition-all">
                      <Copy size={10} /> {copyFeedback === 'body' ? 'Скопировано!' : 'Копировать'}
                    </button>
                  </div>
                  <pre className="p-3 bg-[#2d2d2d] rounded-lg border border-[rgba(255,255,255,0.08)] font-mono text-xs text-gray-300 whitespace-pre-wrap max-h-[300px] overflow-auto">
                    {typeof result.requestBody === 'string' ? result.requestBody : JSON.stringify(result.requestBody, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeSection === 'response' && (
            <div className="space-y-4">
              {result.responseHeaders && Object.keys(result.responseHeaders).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Заголовки ответа</div>
                    <button onClick={() => copyToClipboard(JSON.stringify(result.responseHeaders, null, 2), 'respHeaders')} className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded transition-all">
                      <Copy size={10} /> {copyFeedback === 'respHeaders' ? 'Скопировано!' : 'Копировать'}
                    </button>
                  </div>
                  <div className="p-3 bg-[#2d2d2d] rounded-lg border border-[rgba(255,255,255,0.08)] space-y-1 max-h-[150px] overflow-y-auto">
                    {Object.entries(result.responseHeaders).map(([key, value]) => (
                      <div key={key} className="flex gap-2 text-xs">
                        <span className="text-indigo-400 font-mono min-w-[140px] shrink-0">{key}:</span>
                        <span className="text-gray-300 font-mono break-all">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.responseData && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Тело ответа</div>
                    <button onClick={() => copyToClipboard(typeof result.responseData === 'string' ? result.responseData : JSON.stringify(result.responseData, null, 2), 'respBody')} className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded transition-all">
                      <Copy size={10} /> {copyFeedback === 'respBody' ? 'Скопировано!' : 'Копировать'}
                    </button>
                  </div>
                  <pre className="p-3 bg-[#2d2d2d] rounded-lg border border-[rgba(255,255,255,0.08)] font-mono text-xs text-gray-300 whitespace-pre-wrap max-h-[400px] overflow-auto">
                    {typeof result.responseData === 'string' ? result.responseData : JSON.stringify(result.responseData, null, 2)}
                  </pre>
                </div>
              )}

              {!result.responseData && !result.responseHeaders && (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Нет данных ответа</p>
                  <p className="text-xs mt-1">Возможно, запрос не был отправлен из-за сетевой ошибки</p>
                </div>
              )}
            </div>
          )}

          {activeSection === 'scripts' && (
            <div className="space-y-4">
              {result.testResults && result.testResults.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tests</div>
                  <div className="space-y-1.5">
                    {result.testResults.map((t, i) => (
                      <div key={i} className={`flex items-start gap-2 p-2 rounded text-xs ${t.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                        {t.passed ? <CheckCircle size={12} className="shrink-0 mt-0.5" /> : <XCircle size={12} className="shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{t.name}</div>
                          {t.error && <div className="text-[10px] opacity-75 font-mono mt-0.5 break-all">{t.error}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.scriptLogs && result.scriptLogs.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Console Logs</div>
                  <div className="space-y-1">
                    {result.scriptLogs.map((log, i) => (
                      <div key={i} className="text-[11px] text-gray-300 font-mono bg-[#252525] px-2 py-1 rounded break-all">
                        <span className="text-gray-600 mr-1">[{i + 1}]</span>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!hasScripts && (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Скрипты не выполнялись</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};