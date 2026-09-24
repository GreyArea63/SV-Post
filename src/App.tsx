import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import axios from 'axios';
import { RequestBuilder } from './components/RequestBuilder';
import { ResponseViewer } from './components/ResponseViewer';
import { Sidebar } from './components/Sidebar';
import { FunctionMenu } from './components/FunctionMenu';
import { Tabs } from './components/Tabs';
import { EnvironmentManager } from './components/EnvironmentManager';
import { CollectionRunner } from './components/CollectionRunner';
import { JsonBuilder } from './components/JsonBuilder';
import { SaveRequestModal } from './components/SaveRequestModal';
import { UpdateNotification } from './components/UpdateNotification';
import {
  HttpRequest,
  HttpResponse,
  HistoryItem,
  Collection,
  Environment,
  KeyValuePair,
  TestResult,
  ScriptExecutionResult
} from './types';
import { storage } from './utils/storage';
import { generateId, replaceVariables, parseKeyValuePairs } from './utils/helpers';
import {
  ScriptRunner,
  createScriptContext,
  replaceVariablesInScript
} from './utils/scriptRunner';
import { X, CheckCircle, AlertCircle, Info, Save, Database } from 'lucide-react';

// ============================================================
// ТИПЫ
// ============================================================
interface Tab {
  id: string;
  request: HttpRequest;
  response: HttpResponse | null;
  loading: boolean;
  error: string | null;
  savedSnapshot?: string;
  collectionId?: string;
  testResults?: TestResult[];
  scriptLogs?: string[];
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// ============================================================
// КОНСТАНТЫ
// ============================================================
const MAX_TABS = 10;
const TOAST_DURATION = 3000;
const REQUEST_TIMEOUT = 30000;
const MAX_HISTORY = 100;
const DB_INIT_DELAY = 300;
const DB_MAX_RETRIES = 3;
const DB_RETRY_DELAY = 1000;

// ============================================================
// УТИЛИТЫ
// ============================================================
const createDefaultRequest = (method: string = 'GET'): HttpRequest => ({
  id: generateId(),
  name: method === 'GET' ? 'New Request' : `New ${method} Request`,
  method,
  url: '',
  headers: [],
  queryParams: [],
  body: { type: 'none', content: '' },
  documentation: '',
});

const createSnapshot = (request: HttpRequest): string => {
  const { method, name, ...rest } = request;
  return JSON.stringify(rest);
};

const isTabEmpty = (tab: Tab): boolean => {
  return (
    tab.request.name === 'New Request' &&
    tab.request.url === '' &&
    tab.request.method === 'GET' &&
    tab.request.headers.length === 0 &&
    tab.request.queryParams.length === 0 &&
    tab.request.body.type === 'none' &&
    tab.response === null
  );
};

const hasUnsavedChanges = (tab: Tab): boolean => {
  if (!tab.savedSnapshot) return false;
  return createSnapshot(tab.request) !== tab.savedSnapshot;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Удаляет из объекта headers все ключи, совпадающие с именем (регистронезависимо).
 * Нужно, чтобы не было двух заголовков Authorization в разном регистре.
 */
const removeHeaderCaseInsensitive = (headers: Record<string, string>, name: string): void => {
  const lower = name.toLowerCase();
  Object.keys(headers).forEach(key => {
    if (key.toLowerCase() === lower) {
      delete headers[key];
    }
  });
};

const mergeEnvironments = (
  existing: Environment[],
  incoming: Environment[]
): Environment[] => {
  const map = new Map<string, Environment>();
  existing.forEach(e => {
    map.set(e.name.trim().toLowerCase(), e);
  });
  incoming.forEach(e => {
    const key = e.name.trim().toLowerCase();
    const prev = map.get(key);
    if (prev) {
      map.set(key, { ...prev, name: e.name, variables: e.variables });
    } else {
      map.set(key, { ...e, id: generateId() });
    }
  });
  return Array.from(map.values());
};

const mergeCollections = (
  existing: Collection[],
  incoming: Collection[]
): Collection[] => {
  const map = new Map<string, Collection>();
  existing.forEach(c => {
    map.set(c.name.trim().toLowerCase(), c);
  });
  incoming.forEach(c => {
    const key = c.name.trim().toLowerCase();
    const prev = map.get(key);
    if (prev) {
      const requestMap = new Map<string, HttpRequest>();
      prev.requests.forEach(r => requestMap.set(r.id, r));
      c.requests.forEach(r => {
        if (requestMap.has(r.id)) {
          requestMap.set(r.id, { ...requestMap.get(r.id)!, ...r });
        } else {
          requestMap.set(r.id, { ...r, id: generateId() });
        }
      });
      map.set(key, { ...prev, requests: Array.from(requestMap.values()) });
    } else {
      map.set(key, { ...c, id: generateId() });
    }
  });
  return Array.from(map.values());
};

// ============================================================
// КОМПОНЕНТЫ
// ============================================================
const ToastContainer = memo(({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) => (
  <div className="fixed top-16 right-4 z-[300] space-y-2">
    {toasts.map(toast => (
      <div
        key={toast.id}
        className={`toast flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] animate-fade-in ${toast.type === 'success' ? 'bg-green-500/20 border border-green-500/30 text-green-400' :
          toast.type === 'error' ? 'bg-red-500/20 border border-red-500/30 text-red-400' :
            'bg-blue-500/20 border border-blue-500/30 text-blue-400'
          }`}
      >
        {toast.type === 'success' && <CheckCircle size={18} />}
        {toast.type === 'error' && <AlertCircle size={18} />}
        {toast.type === 'info' && <Info size={18} />}
        <span className="flex-1 text-sm">{toast.message}</span>
        <button onClick={() => onRemove(toast.id)} className="hover:opacity-70">
          <X size={14} />
        </button>
      </div>
    ))}
  </div>
));
ToastContainer.displayName = 'ToastContainer';

const SaveConfirmModal = memo(({
  action,
  onConfirm,
  onDiscard,
  onCancel,
}: {
  action: 'close' | 'switch';
  onConfirm: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[400] p-4 animate-scale-in">
    <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
          <Save size={20} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-200">Несохранённые изменения</h3>
          <p className="text-xs text-gray-500">Вкладка содержит изменения</p>
        </div>
      </div>
      <p className="text-sm text-gray-300 mb-6">
        {action === 'close'
          ? 'Вы хотите сохранить изменения перед закрытием вкладки?'
          : 'Вы хотите сохранить изменения перед переключением вкладки?'}
      </p>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all">
          Отмена
        </button>
        <button onClick={onDiscard} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all">
          Не сохранять
        </button>
        <button onClick={onConfirm} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all">
          Сохранить
        </button>
      </div>
    </div>
  </div>
));
SaveConfirmModal.displayName = 'SaveConfirmModal';

const DatabaseErrorModal = memo(({
  onReset,
  onIgnore,
}: {
  onReset: () => void;
  onIgnore: () => void;
}) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-scale-in">
    <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
          <Database size={20} className="text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-200">Ошибка базы данных</h3>
          <p className="text-xs text-gray-500">IndexedDB повреждена или заблокирована</p>
        </div>
      </div>
      <p className="text-sm text-gray-300 mb-6">
        База данных приложения повреждена или заблокирована другим процессом.
      </p>
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6">
        <p className="text-xs text-red-400">
          ⚠️ Сброс базы данных удалит все сохранённые коллекции, историю и окружения.
        </p>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onIgnore} className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all">
          Игнорировать
        </button>
        <button onClick={onReset} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all">
          Сбросить БД
        </button>
      </div>
    </div>
  </div>
));
DatabaseErrorModal.displayName = 'DatabaseErrorModal';

const HeaderBar = memo(({
  activeEnvId,
  environments,
  onEnvChange,
  onOpenEnvManager,
  onImportCollections,
  onExportAllCollections,
  collections,
  onOpenJsonBuilder,
  onClearHistory,
  onClearAll,
}: {
  activeEnvId: string | null;
  environments: Environment[];
  onEnvChange: (envId: string | null) => void;
  onOpenEnvManager: () => void;
  onImportCollections: (collections: Collection[]) => void;
  onExportAllCollections: () => void;
  collections: Collection[];
  onOpenJsonBuilder: () => void;
  onClearHistory: () => void;
  onClearAll: () => void;
}) => (
  <div className="h-8 bg-[#1e1e1e] border-b border-[rgba(255,255,255,0.08)] flex items-center px-3 gap-2 shrink-0">
    <FunctionMenu
      onImport={onImportCollections}
      onExportAll={onExportAllCollections}
      collections={collections}
      onOpenEnvManager={onOpenEnvManager}
      onOpenJsonBuilder={onOpenJsonBuilder}
      onClearHistory={onClearHistory}
      onClearAll={onClearAll}
    />
    <div className="h-4 w-px bg-[rgba(255,255,255,0.1)]" />
    <h1 className="text-sm font-bold text-gray-200">SV-Post</h1>
    <div className="ml-auto flex items-center gap-2">
      {activeEnvId && (
        <span className="text-[10px] text-gray-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-gray-300">{environments.find(e => e.id === activeEnvId)?.name}</span>
        </span>
      )}
      <select
        value={activeEnvId || ''}
        onChange={(e) => onEnvChange(e.target.value || null)}
        className="h-[24px] px-2 bg-[#2d2d2d] hover:bg-[#363636] border border-[rgba(255,255,255,0.08)] rounded text-[11px] text-gray-300 focus:outline-none focus:border-gray-500 transition-all cursor-pointer"
      >
        <option value="">Нет окружения</option>
        {environments.map(env => (
          <option key={env.id} value={env.id}>{env.name}</option>
        ))}
      </select>
      <button
        onClick={onOpenEnvManager}
        className="h-[24px] w-[24px] flex items-center justify-center bg-[#2d2d2d] hover:bg-[#363636] border border-[rgba(255,255,255,0.08)] rounded transition-all"
        title="Менеджер окружений"
      >
        <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  </div>
));
HeaderBar.displayName = 'HeaderBar';

// ============================================================
// ГЛАВНЫЙ КОМПОНЕНТ
// ============================================================
function App() {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: generateId(),
      request: createDefaultRequest(),
      response: null,
      loading: false,
      error: null,
      savedSnapshot: createSnapshot(createDefaultRequest()),
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [globalVariables, setGlobalVariables] = useState<KeyValuePair[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [showJsonBuilder, setShowJsonBuilder] = useState(false);
  const [runningRequest, setRunningRequest] = useState<{ request: HttpRequest; collectionName: string } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showSaveConfirm, setShowSaveConfirm] = useState<{ tabId: string; action: 'close' | 'switch' } | null>(null);
  const [showSaveRequestModal, setShowSaveRequestModal] = useState<{ request: HttpRequest; tabId: string } | null>(null);
  const [requestHeight, setRequestHeight] = useState<number>(50);
  const [isResizing, setIsResizing] = useState(false);
  const [showDbErrorModal, setShowDbErrorModal] = useState(false);
  const [lastScriptResult, setLastScriptResult] = useState<ScriptExecutionResult | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ============================================================
  // ЗАГРУЗКА ДАННЫХ
  // ============================================================
  useEffect(() => {
    if (isInitialized) return;
    let isMounted = true;

    const loadData = async () => {
      await delay(DB_INIT_DELAY);

      for (let attempt = 1; attempt <= DB_MAX_RETRIES; attempt++) {
        if (!isMounted) return;

        try {
          const [cols, hist, envs, globals, activeEnv] = await Promise.all([
            storage.getCollections(),
            storage.getHistory(),
            storage.getEnvironments(),
            storage.getGlobalVariables(),
            storage.getActiveEnvironment(),
          ]);

          if (!isMounted) return;

          setCollections(cols);
          setHistory(hist);
          setEnvironments(envs);
          setGlobalVariables(globals);
          setActiveEnvId(activeEnv);
          setIsInitialized(true);
          console.log(`[DB] Данные загружены успешно (попытка ${attempt})`);
          return;
        } catch (error) {
          console.error(`[DB] Ошибка загрузки (попытка ${attempt}/${DB_MAX_RETRIES}):`, error);

          if (attempt < DB_MAX_RETRIES) {
            await delay(DB_RETRY_DELAY);
            continue;
          }

          if (!isMounted) return;

          if (storage.isDatabaseCorrupted()) {
            setShowDbErrorModal(true);
          } else {
            showToast('error', 'Ошибка загрузки данных. Попробуйте перезапустить приложение.');
          }
          setIsInitialized(true);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isInitialized, showToast]);

  const handleResetDatabase = useCallback(async () => {
    try {
      await storage.resetDatabase();
      setShowDbErrorModal(false);
      showToast('success', 'База данных сброшена. Приложение перезагрузится...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Failed to reset database:', error);
      showToast('error', 'Не удалось сбросить базу данных');
    }
  }, [showToast]);

  const handleIgnoreDbError = useCallback(() => {
    setShowDbErrorModal(false);
    showToast('info', 'Приложение работает в ограниченном режиме');
  }, [showToast]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerHeight = containerRef.current.getBoundingClientRect().height;
      const newPercentage = ((e.clientY - containerRef.current.getBoundingClientRect().top) / containerHeight) * 100;
      if (newPercentage >= 20 && newPercentage <= 80) setRequestHeight(newPercentage);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const getActiveEnvironment = useCallback((): Environment | null => {
    return environments.find(env => env.id === activeEnvId) || null;
  }, [environments, activeEnvId]);

  /**
   * ИСПРАВЛЕНО: теперь обрабатывается auth.token, username, password, apiKey, apiValue, accessToken.
   */
  const processRequest = useCallback((request: HttpRequest): HttpRequest => {
    const env = getActiveEnvironment();
    const envVariables = env?.variables || [];
    const allVariables = [
      ...globalVariables.filter(g => g.enabled),
      ...envVariables.filter(e => e.enabled),
    ];
    return {
      ...request,
      url: replaceVariables(request.url, allVariables),
      headers: request.headers.map(h => ({ ...h, value: replaceVariables(h.value, allVariables) })),
      queryParams: request.queryParams.map(p => ({ ...p, value: replaceVariables(p.value, allVariables) })),
      body: { ...request.body, content: replaceVariables(request.body.content, allVariables) },
      // ✅ КРИТИЧНО: заменяем переменные в auth
      auth: request.auth
        ? {
          ...request.auth,
          token: request.auth.token ? replaceVariables(request.auth.token, allVariables) : request.auth.token,
          username: request.auth.username ? replaceVariables(request.auth.username, allVariables) : request.auth.username,
          password: request.auth.password ? replaceVariables(request.auth.password, allVariables) : request.auth.password,
          apiKey: request.auth.apiKey ? replaceVariables(request.auth.apiKey, allVariables) : request.auth.apiKey,
          apiValue: request.auth.apiValue ? replaceVariables(request.auth.apiValue, allVariables) : request.auth.apiValue,
          accessToken: request.auth.accessToken ? replaceVariables(request.auth.accessToken, allVariables) : request.auth.accessToken,
          tokenType: request.auth.tokenType ? replaceVariables(request.auth.tokenType, allVariables) : request.auth.tokenType,
        }
        : request.auth,
    };
  }, [getActiveEnvironment, globalVariables]);

  const executeScript = useCallback(async (
    scriptType: 'preRequest' | 'test',
    script: string,
    httpRequest: HttpRequest,
    httpResponse: HttpResponse | null
  ): Promise<ScriptExecutionResult | null> => {
    if (!script || !script.trim()) return null;

    const env = getActiveEnvironment();
    const envVars = env?.variables.filter((v) => v.enabled) || [];
    const globals = globalVariables.filter((v) => v.enabled);

    const requestHeaders: Record<string, string> = {};
    httpRequest.headers.filter((h) => h.enabled && h.key).forEach((h) => {
      requestHeaders[h.key] = replaceVariables(h.value, [...globals, ...envVars]);
    });

    const context = createScriptContext(
      {
        ...httpRequest,
        headers: httpRequest.headers.map((h) => ({
          ...h,
          value: replaceVariables(h.value, [...globals, ...envVars]),
        })),
      },
      httpResponse,
      envVars,
      globals
    );
    context.request.headers = requestHeaders;

    const runner = new ScriptRunner(context);
    const processedScript = replaceVariablesInScript(script, [...globals, ...envVars]);

    return await runner.runScript(processedScript, httpResponse || undefined);
  }, [getActiveEnvironment, globalVariables]);

  const applyScriptChanges = useCallback(async (result: ScriptExecutionResult) => {
    if (result.environmentChanges.length > 0 && activeEnvId) {
      const env = environments.find((e) => e.id === activeEnvId);
      if (env) {
        const updatedVars = [...env.variables];
        result.environmentChanges.forEach((change) => {
          const existingIndex = updatedVars.findIndex((v) => v.key === change.key);
          if (change.enabled) {
            if (existingIndex >= 0) {
              updatedVars[existingIndex] = { ...updatedVars[existingIndex], value: change.value };
            } else {
              updatedVars.push({ id: generateId(), key: change.key, value: change.value, enabled: true });
            }
          } else {
            if (existingIndex >= 0) updatedVars.splice(existingIndex, 1);
          }
        });
        const updatedEnv = { ...env, variables: updatedVars };
        const updatedEnvs = environments.map((e) => e.id === activeEnvId ? updatedEnv : e);
        setEnvironments(updatedEnvs);
        await storage.saveEnvironments(updatedEnvs);
      }
    }

    if (result.globalsChanges.length > 0) {
      const updatedGlobals = [...globalVariables];
      result.globalsChanges.forEach((change) => {
        const existingIndex = updatedGlobals.findIndex((v) => v.key === change.key);
        if (change.enabled) {
          if (existingIndex >= 0) {
            updatedGlobals[existingIndex] = { ...updatedGlobals[existingIndex], value: change.value };
          } else {
            updatedGlobals.push({ id: generateId(), key: change.key, value: change.value, enabled: true });
          }
        } else {
          if (existingIndex >= 0) updatedGlobals.splice(existingIndex, 1);
        }
      });
      setGlobalVariables(updatedGlobals);
      await storage.saveGlobalVariables(updatedGlobals);
    }
  }, [activeEnvId, environments, globalVariables]);

  const handleRunPreRequest = useCallback(async () => {
    if (!activeTab || !activeTab.request.scripts?.preRequest) return null;
    const result = await executeScript('preRequest', activeTab.request.scripts.preRequest, activeTab.request, null);
    if (result) {
      setLastScriptResult(result);
      if (result.error) {
        showToast('error', `Script error: ${result.error}`);
      } else if (result.skipped) {
        showToast('info', 'Request would be skipped');
      } else if (result.testResults.length > 0) {
        const passed = result.testResults.filter((t) => t.passed).length;
        showToast('success', `Pre-request: ${passed}/${result.testResults.length} tests passed`);
      }
      await applyScriptChanges(result);
    }
    return result;
  }, [activeTab, executeScript, showToast, applyScriptChanges]);

  const handleRunTest = useCallback(async () => {
    if (!activeTab || !activeTab.request.scripts?.test) return null;
    if (!activeTab.response) {
      showToast('error', 'Сначала отправьте запрос');
      return null;
    }

    const result = await executeScript('test', activeTab.request.scripts.test, activeTab.request, activeTab.response);
    if (result) {
      setLastScriptResult(result);
      if (result.error) {
        showToast('error', `Test script error: ${result.error}`);
      } else {
        const passed = result.testResults.filter((t) => t.passed).length;
        showToast(result.testResults.some((t) => !t.passed) ? 'error' : 'success', `Tests: ${passed}/${result.testResults.length} passed`);
      }
      await applyScriptChanges(result);
    }
    return result;
  }, [activeTab, executeScript, showToast, applyScriptChanges]);

  const handleSend = useCallback(async () => {
    if (!activeTab) return;

    let preRequestResult: ScriptExecutionResult | null = null;
    if (activeTab.request.scripts?.preRequest) {
      preRequestResult = await executeScript('preRequest', activeTab.request.scripts.preRequest, activeTab.request, null);
      if (preRequestResult) {
        if (preRequestResult.error) {
          showToast('error', `Pre-request script error: ${preRequestResult.error}`);
          return;
        }
        if (preRequestResult.skipped) {
          showToast('info', 'Request skipped by pre-request script');
          setTabs(prevTabs => prevTabs.map(tab =>
            tab.id === activeTabId ? { ...tab, loading: false, error: 'Request skipped by script', testResults: preRequestResult!.testResults, scriptLogs: preRequestResult!.logs } : tab
          ));
          return;
        }
        await applyScriptChanges(preRequestResult);
      }
    }

    setTabs(prevTabs => prevTabs.map(tab =>
      tab.id === activeTabId ? { ...tab, loading: true, error: null, response: null } : tab
    ));

    try {
      const processedRequest = processRequest(activeTab.request);
      let url = processedRequest.url;
      const queryParams = parseKeyValuePairs(processedRequest.queryParams);
      const urlSearchParams = new URLSearchParams(url.split('?')[1] || '');
      Object.entries(queryParams).forEach(([key, value]) => {
        urlSearchParams.set(key, value);
      });
      const headers = parseKeyValuePairs(processedRequest.headers);

      if (processedRequest.auth) {
        // ✅ КРИТИЧНО: удаляем все варианты Authorization (в разном регистре)
        // прежде чем установить новый, чтобы не было дублей
        removeHeaderCaseInsensitive(headers, 'Authorization');

        if (processedRequest.auth.type === 'bearer' && processedRequest.auth.token) {
          headers['Authorization'] = `Bearer ${processedRequest.auth.token}`;
        } else if (processedRequest.auth.type === 'basic' && processedRequest.auth.username) {
          headers['Authorization'] = `Basic ${btoa(unescape(encodeURIComponent(`${processedRequest.auth.username}:${processedRequest.auth.password || ''}`)))}`;
        } else if (processedRequest.auth.type === 'apikey' && processedRequest.auth.apiKey && processedRequest.auth.apiValue) {
          if (processedRequest.auth.addTo === 'header') {
            removeHeaderCaseInsensitive(headers, processedRequest.auth.apiKey);
            headers[processedRequest.auth.apiKey] = processedRequest.auth.apiValue;
          } else {
            urlSearchParams.set(processedRequest.auth.apiKey, processedRequest.auth.apiValue);
          }
        } else if (processedRequest.auth.type === 'oauth2' && processedRequest.auth.accessToken) {
          headers['Authorization'] = `${processedRequest.auth.tokenType || 'Bearer'} ${processedRequest.auth.accessToken}`;
        }
      }

      const queryString = urlSearchParams.toString();
      const baseUrl = url.split('?')[0];
      url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
      const startTime = Date.now();
      const config: any = {
        method: processedRequest.method.toLowerCase(),
        url,
        headers,
        timeout: REQUEST_TIMEOUT,
      };

      if (processedRequest.body.type !== 'none' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(processedRequest.method)) {
        switch (processedRequest.body.type) {
          case 'json':
          case 'raw':
            try {
              config.data = JSON.parse(processedRequest.body.content);
              headers['Content-Type'] = 'application/json';
            } catch {
              config.data = processedRequest.body.content;
              headers['Content-Type'] = 'text/plain';
            }
            break;
          case 'x-www-form-urlencoded':
            if (processedRequest.body.form && processedRequest.body.form.length > 0) {
              const formData = new URLSearchParams();
              processedRequest.body.form.forEach(field => {
                if (field.enabled && field.key) formData.append(field.key, field.value);
              });
              config.data = formData.toString();
              headers['Content-Type'] = 'application/x-www-form-urlencoded';
            } else {
              config.data = processedRequest.body.content;
              headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
            break;
          case 'form-data':
            if (processedRequest.body.form && processedRequest.body.form.length > 0) {
              const formData = new FormData();
              processedRequest.body.form.forEach(field => {
                if (field.enabled && field.key) formData.append(field.key, field.value);
              });
              config.data = formData;
              delete headers['Content-Type'];
            }
            break;
          case 'graphql':
            try {
              const graphqlData = JSON.parse(processedRequest.body.content);
              config.data = { query: graphqlData.query || '', variables: graphqlData.variables || {}, operationName: graphqlData.operationName || null };
              headers['Content-Type'] = 'application/json';
            } catch {
              config.data = { query: processedRequest.body.content };
              headers['Content-Type'] = 'application/json';
            }
            break;
          case 'binary':
            config.data = processedRequest.body.content;
            headers['Content-Type'] = 'application/octet-stream';
            break;
        }
      }

      const axiosResponse = await axios(config);
      const endTime = Date.now();
      const httpResponse: HttpResponse = {
        status: axiosResponse.status,
        statusText: axiosResponse.statusText,
        headers: (axiosResponse.headers as any).toJSON ? (axiosResponse.headers as any).toJSON() : axiosResponse.headers,
        data: axiosResponse.data,
        time: endTime - startTime,
        size: new Blob([JSON.stringify(axiosResponse.data)]).size,
      };

      let testResult: ScriptExecutionResult | null = null;
      if (activeTab.request.scripts?.test) {
        testResult = await executeScript('test', activeTab.request.scripts.test, activeTab.request, httpResponse);
        if (testResult) {
          await applyScriptChanges(testResult);
        }
      }

      setTabs(prevTabs => prevTabs.map(tab =>
        tab.id === activeTabId ? {
          ...tab,
          loading: false,
          response: httpResponse,
          error: null,
          testResults: testResult?.testResults || [],
          scriptLogs: [...(preRequestResult?.logs || []), ...(testResult?.logs || [])],
        } : tab
      ));

      const historyItem: HistoryItem = {
        id: generateId(),
        request: activeTab.request,
        response: httpResponse,
        timestamp: Date.now(),
      };
      const newHistory = [historyItem, ...history].slice(0, MAX_HISTORY);
      setHistory(newHistory);
      await storage.saveHistory(newHistory);

      if (testResult && testResult.testResults.length > 0) {
        const passed = testResult.testResults.filter((t) => t.passed).length;
        const total = testResult.testResults.length;
        if (passed === total) {
          showToast('success', `✓ ${httpResponse.status} · All ${total} tests passed`);
        } else {
          showToast('error', `✗ ${httpResponse.status} · ${passed}/${total} tests passed`);
        }
      } else {
        showToast('success', `Запрос выполнен: ${httpResponse.status}`);
      }

    } catch (err: any) {
      const endTime = Date.now();
      const startTime = endTime - REQUEST_TIMEOUT;
      if (err.response) {
        const httpResponse: HttpResponse = {
          status: err.response.status,
          statusText: err.response.statusText,
          headers: (err.response.headers as any).toJSON ? (err.response.headers as any).toJSON() : err.response.headers,
          data: err.response.data,
          time: endTime - startTime,
          size: new Blob([JSON.stringify(err.response.data)]).size,
        };

        let testResult: ScriptExecutionResult | null = null;
        if (activeTab.request.scripts?.test) {
          testResult = await executeScript('test', activeTab.request.scripts.test, activeTab.request, httpResponse);
          if (testResult) {
            await applyScriptChanges(testResult);
          }
        }

        setTabs(prevTabs => prevTabs.map(tab =>
          tab.id === activeTabId ? {
            ...tab,
            loading: false,
            response: httpResponse,
            error: null,
            testResults: testResult?.testResults || [],
            scriptLogs: [...(preRequestResult?.logs || []), ...(testResult?.logs || [])],
          } : tab
        ));
        showToast('error', `Ошибка: ${httpResponse.status}`);
      } else {
        setTabs(prevTabs => prevTabs.map(tab =>
          tab.id === activeTabId ? { ...tab, loading: false, error: err.message || 'Ошибка соединения' } : tab
        ));
        showToast('error', err.message || 'Ошибка соединения');
      }
    }
  }, [activeTab, activeTabId, processRequest, history, showToast, executeScript, applyScriptChanges]);

  const handleTabClick = useCallback((tabId: string) => {
    if (activeTab && hasUnsavedChanges(activeTab) && tabId !== activeTabId) {
      setShowSaveConfirm({ tabId, action: 'switch' });
    } else {
      setActiveTabId(tabId);
    }
  }, [activeTab, activeTabId]);

  const performTabClose = useCallback((tabId: string, currentTabs: Tab[]) => {
    const newTabs = currentTabs.filter(tab => tab.id !== tabId);
    if (newTabs.length === 0) {
      const defaultRequest = createDefaultRequest();
      const defaultTab: Tab = {
        id: generateId(),
        request: defaultRequest,
        response: null,
        loading: false,
        error: null,
        savedSnapshot: createSnapshot(defaultRequest),
      };
      setActiveTabId(defaultTab.id);
      return [defaultTab];
    }
    if (tabId === activeTabId) setActiveTabId(newTabs[0].id);
    return newTabs;
  }, [activeTabId]);

  const handleTabClose = useCallback((tabId: string) => {
    const tabToClose = tabs.find(t => t.id === tabId);
    if (tabToClose && hasUnsavedChanges(tabToClose)) {
      setShowSaveConfirm({ tabId, action: 'close' });
    } else {
      setTabs(prev => performTabClose(tabId, prev));
    }
  }, [tabs, performTabClose]);

  const handleNewTab = useCallback(() => {
    if (tabs.length >= MAX_TABS) {
      showToast('error', `Достигнут лимит в ${MAX_TABS} вкладок`);
      return;
    }
    const newRequest = createDefaultRequest();
    const newTab: Tab = {
      id: generateId(),
      request: newRequest,
      response: null,
      loading: false,
      error: null,
      savedSnapshot: createSnapshot(newRequest),
    };
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs.length, showToast]);

  const handleMethodChange = useCallback((newMethod: string) => {
    if (!activeTab) return;
    if (isTabEmpty(activeTab)) {
      const updatedRequest = {
        ...activeTab.request,
        method: newMethod,
        name: newMethod === 'GET' ? 'New Request' : `New ${newMethod} Request`,
      };
      const newSnapshot = createSnapshot(updatedRequest);
      setTabs(prevTabs => prevTabs.map(tab =>
        tab.id === activeTabId ? { ...tab, request: updatedRequest, savedSnapshot: newSnapshot } : tab
      ));
      showToast('info', `Метод изменён на ${newMethod}`);
      return;
    }
    if (tabs.length >= MAX_TABS) {
      showToast('error', `Достигнут лимит в ${MAX_TABS} вкладок. Закройте одну из вкладок.`);
      return;
    }
    const newRequest = createDefaultRequest(newMethod);
    const newTab: Tab = {
      id: generateId(),
      request: newRequest,
      response: null,
      loading: false,
      error: null,
      savedSnapshot: createSnapshot(newRequest),
    };
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);
    showToast('info', `Создана новая вкладка: ${newMethod}`);
  }, [activeTab, activeTabId, tabs.length, showToast]);

  const handleRequestChange = useCallback((request: HttpRequest) => {
    setTabs(prevTabs => prevTabs.map(tab =>
      tab.id === activeTabId ? { ...tab, request } : tab
    ));
  }, [activeTabId]);

  const handleSaveCurrentTab = useCallback(async () => {
    if (!activeTab) return;

    if (activeTab.collectionId) {
      const collection = collections.find(c => c.id === activeTab.collectionId);
      if (collection) {
        const existingIndex = collection.requests.findIndex(
          r => r.id === activeTab.request.id
        );

        if (existingIndex >= 0) {
          const updatedRequests = collection.requests.map(r =>
            r.id === activeTab.request.id ? activeTab.request : r
          );
          const updatedCollection = { ...collection, requests: updatedRequests };
          const updatedCollections = collections.map(c =>
            c.id === activeTab.collectionId ? updatedCollection : c
          );
          setCollections(updatedCollections);
          await storage.saveCollections(updatedCollections);
          const newSnapshot = createSnapshot(activeTab.request);
          setTabs(prevTabs => prevTabs.map(tab =>
            tab.id === activeTabId ? { ...tab, savedSnapshot: newSnapshot } : tab
          ));
          showToast('success', `Запрос "${activeTab.request.name}" обновлён в "${collection.name}"`);
          return;
        } else {
          const updatedCollection = {
            ...collection,
            requests: [...collection.requests, activeTab.request],
          };
          const updatedCollections = collections.map(c =>
            c.id === activeTab.collectionId ? updatedCollection : c
          );
          setCollections(updatedCollections);
          await storage.saveCollections(updatedCollections);
          const newSnapshot = createSnapshot(activeTab.request);
          setTabs(prevTabs => prevTabs.map(tab =>
            tab.id === activeTabId ? { ...tab, savedSnapshot: newSnapshot } : tab
          ));
          showToast('success', `Запрос "${activeTab.request.name}" добавлен в "${collection.name}"`);
          return;
        }
      } else {
        console.warn('[Save] Коллекция не найдена, collectionId сброшен');
        setTabs(prevTabs => prevTabs.map(tab =>
          tab.id === activeTabId ? { ...tab, collectionId: undefined } : tab
        ));
      }
    }

    setShowSaveRequestModal({
      request: activeTab.request,
      tabId: activeTab.id,
    });
  }, [activeTab, activeTabId, collections, showToast]);

  const handleConfirmSave = useCallback(() => {
    if (!showSaveConfirm) return;
    handleSaveCurrentTab();
    if (showSaveConfirm.action === 'close') {
      setTabs(prev => performTabClose(showSaveConfirm.tabId, prev));
    } else if (showSaveConfirm.action === 'switch') {
      setActiveTabId(showSaveConfirm.tabId);
    }
    setShowSaveConfirm(null);
  }, [showSaveConfirm, handleSaveCurrentTab, performTabClose]);

  const handleDiscardChanges = useCallback(() => {
    if (!showSaveConfirm) return;
    if (showSaveConfirm.action === 'close') {
      setTabs(prev => performTabClose(showSaveConfirm.tabId, prev));
    } else if (showSaveConfirm.action === 'switch') {
      setActiveTabId(showSaveConfirm.tabId);
    }
    setShowSaveConfirm(null);
  }, [showSaveConfirm, performTabClose]);

  const handleAddCollection = useCallback(async () => {
    const name = prompt('Название коллекции:');
    if (name) {
      const newCollection: Collection = { id: generateId(), name, requests: [] };
      const newCollections = [...collections, newCollection];
      setCollections(newCollections);
      await storage.saveCollections(newCollections);
      showToast('success', `Коллекция "${name}" создана`);
    }
  }, [collections, showToast]);

  const handleImportCollections = useCallback(async (importedCollections: Collection[]) => {
    const updated = mergeCollections(collections, importedCollections);
    setCollections(updated);
    await storage.saveCollections(updated);
    showToast('success', `Импортировано коллекций: ${importedCollections.length}`);
  }, [collections, showToast]);

  const handleExportAllCollections = useCallback(() => {
    const exportData = { version: '1.0', exportedAt: new Date().toISOString(), collections };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sv-post-collections-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Коллекции экспортированы');
  }, [collections, showToast]);

  const handleSelectRequest = useCallback((collectionId: string, requestId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    const request = collection?.requests.find(r => r.id === requestId);
    if (!request) {
      showToast('error', 'Запрос не найден в коллекции');
      return;
    }

    if (activeTab && isTabEmpty(activeTab)) {
      setTabs(prevTabs => prevTabs.map(tab =>
        tab.id === activeTabId
          ? {
            ...tab,
            request: { ...request },
            savedSnapshot: createSnapshot(request),
            collectionId,
            response: null,
            error: null,
          }
          : tab
      ));
      showToast('info', `Загружен запрос: ${request.name}`);
      return;
    }

    if (tabs.length >= MAX_TABS) {
      showToast('error', `Достигнут лимит в ${MAX_TABS} вкладок`);
      return;
    }

    const newTab: Tab = {
      id: generateId(),
      request: { ...request },
      response: null,
      loading: false,
      error: null,
      savedSnapshot: createSnapshot(request),
      collectionId,
    };
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);
    showToast('info', `Загружен запрос: ${request.name}`);
  }, [collections, activeTab, activeTabId, tabs.length, showToast]);

  const handleSelectHistory = useCallback((item: HistoryItem) => {
    if (activeTab && isTabEmpty(activeTab)) {
      const newRequest = { ...item.request, id: generateId() };
      setTabs(prevTabs => prevTabs.map(tab =>
        tab.id === activeTabId
          ? { ...tab, request: newRequest, response: item.response, savedSnapshot: createSnapshot(newRequest), collectionId: undefined }
          : tab
      ));
    } else {
      if (tabs.length >= MAX_TABS) {
        showToast('error', `Достигнут лимит в ${MAX_TABS} вкладок`);
        return;
      }
      const newRequest = { ...item.request, id: generateId() };
      const newTab: Tab = {
        id: generateId(),
        request: newRequest,
        response: item.response,
        loading: false,
        error: null,
        savedSnapshot: createSnapshot(newRequest),
      };
      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId(newTab.id);
    }
    showToast('info', 'Запрос из истории загружен');
  }, [activeTab, activeTabId, tabs.length, showToast]);

  const handleDeleteHistory = useCallback((id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    storage.saveHistory(newHistory);
    showToast('info', 'Запись удалена из истории');
  }, [history, showToast]);

  const handleRunRequest = useCallback((request: HttpRequest, collectionName: string) => {
    setRunningRequest({ request, collectionName });
  }, []);

  const handleUpdateCollections = useCallback((updatedCollections: Collection[]) => {
    setCollections(updatedCollections);
    storage.saveCollections(updatedCollections);
  }, []);

  const handleSaveEnvironments = useCallback(async (envs: Environment[], globals: KeyValuePair[]) => {
    const deduped = mergeEnvironments([], envs);
    setEnvironments(deduped);
    setGlobalVariables(globals);
    if (activeEnvId && !deduped.find(e => e.id === activeEnvId)) {
      setActiveEnvId(null);
      await storage.setActiveEnvironment(null);
    }
    await Promise.all([
      storage.saveEnvironments(deduped),
      storage.saveGlobalVariables(globals),
    ]);
  }, [activeEnvId]);

  const handleImportEnvironments = useCallback(async (envs: Environment[]) => {
    const updated = mergeEnvironments(environments, envs);
    setEnvironments(updated);
    await storage.saveEnvironments(updated);
    showToast('success', `Импортировано окружений: ${envs.length}`);
  }, [environments, showToast]);

  const handleExportEnvironments = useCallback((envs: Environment[], globals: KeyValuePair[]) => {
    const exportData = {
      type: 'sv-post-environments',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      environments: envs,
      globalVariables: globals,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sv-post-environments-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Окружения экспортированы');
  }, [showToast]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    storage.clearHistory();
    showToast('info', 'История очищена');
  }, [showToast]);

  const handleClearAll = useCallback(() => {
    setHistory([]);
    setCollections([]);
    setEnvironments([]);
    setGlobalVariables([]);
    setActiveEnvId(null);
    storage.clearAllData();
    showToast('info', 'Все данные очищены');
  }, [showToast]);

  const handleEnvChange = useCallback(async (envId: string | null) => {
    setActiveEnvId(envId);
    await storage.setActiveEnvironment(envId);
    showToast('info', envId ? 'Окружение изменено' : 'Окружение отключено');
  }, [showToast]);

  const handleOpenSaveRequestModal = useCallback(() => {
    if (!activeTab) return;
    setShowSaveRequestModal({
      request: activeTab.request,
      tabId: activeTab.id,
    });
  }, [activeTab]);

  const handleSaveRequestToCollection = useCallback(async (
    collectionId: string,
    requestName: string,
    request: HttpRequest
  ) => {
    try {
      const collection = collections.find(c => c.id === collectionId);
      if (!collection) throw new Error('Коллекция не найдена');

      const existingIndex = collection.requests.findIndex(r => r.id === request.id);

      let updatedCollection: Collection;

      if (existingIndex >= 0) {
        const updatedRequests = collection.requests.map((r, i) =>
          i === existingIndex ? { ...request, name: requestName } : r
        );
        updatedCollection = { ...collection, requests: updatedRequests };
      } else {
        const newRequest: HttpRequest = {
          ...request,
          id: generateId(),
          name: requestName,
        };
        updatedCollection = {
          ...collection,
          requests: [...collection.requests, newRequest],
        };
      }

      const updatedCollections = collections.map(c =>
        c.id === collectionId ? updatedCollection : c
      );
      setCollections(updatedCollections);
      await storage.saveCollections(updatedCollections);

      const savedRequest = existingIndex >= 0
        ? { ...request, name: requestName }
        : updatedCollection.requests[updatedCollection.requests.length - 1];

      setTabs(prevTabs => prevTabs.map(tab =>
        tab.id === activeTabId ? {
          ...tab,
          request: savedRequest,
          savedSnapshot: createSnapshot(savedRequest),
          collectionId,
        } : tab
      ));
      setShowSaveRequestModal(null);
      showToast('success', `Запрос "${requestName}" сохранён в "${collection.name}"`);
    } catch (error: any) {
      showToast('error', `Ошибка сохранения: ${error.message}`);
    }
  }, [collections, activeTabId, showToast]);

  const handleCreateCollectionAndSave = useCallback(async (
    collectionName: string,
    requestName: string,
    request: HttpRequest
  ) => {
    try {
      const newRequest = { ...request, id: generateId(), name: requestName };
      const newCollection: Collection = {
        id: generateId(),
        name: collectionName,
        requests: [newRequest],
      };
      const updatedCollections = [...collections, newCollection];
      setCollections(updatedCollections);
      await storage.saveCollections(updatedCollections);
      setTabs(prevTabs => prevTabs.map(tab =>
        tab.id === activeTabId ? {
          ...tab,
          request: newRequest,
          savedSnapshot: createSnapshot(newRequest),
          collectionId: newCollection.id,
        } : tab
      ));
      setShowSaveRequestModal(null);
      showToast('success', `Запрос сохранён в новой коллекции "${collectionName}"`);
    } catch (error: any) {
      showToast('error', `Ошибка создания коллекции: ${error.message}`);
    }
  }, [collections, activeTabId, showToast]);

  const handleUpdateVariable = useCallback((key: string, value: string, scope: 'global' | 'env') => {
    if (scope === 'global') {
      const existingVar = globalVariables.find(v => v.key === key);
      const updatedGlobals = existingVar
        ? globalVariables.map(v => v.key === key ? { ...v, value } : v)
        : [...globalVariables, { id: generateId(), key, value, enabled: true }];
      setGlobalVariables(updatedGlobals);
      storage.saveGlobalVariables(updatedGlobals);
    } else {
      if (!activeEnvId) {
        showToast('error', 'Активное окружение не выбрано');
        return;
      }
      const env = environments.find(e => e.id === activeEnvId);
      if (!env) return;
      const existingVar = env.variables.find(v => v.key === key);
      const updatedEnv = existingVar
        ? { ...env, variables: env.variables.map(v => v.key === key ? { ...v, value } : v) }
        : { ...env, variables: [...env.variables, { id: generateId(), key, value, enabled: true }] };
      const updatedEnvs = environments.map(e => e.id === activeEnvId ? updatedEnv : e);
      setEnvironments(updatedEnvs);
      storage.saveEnvironments(updatedEnvs);
    }
    showToast('success', `Переменная ${key} обновлена`);
  }, [globalVariables, environments, activeEnvId, showToast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveCurrentTab();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (activeTab && !activeTab.loading) {
          handleSend();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        handleNewTab();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {
          handleTabClose(activeTabId);
        }
      }
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTabId(tabs[nextIndex].id);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        setActiveTabId(tabs[prevIndex].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, activeTabId, tabs, handleSend, handleNewTab, handleTabClose, handleSaveCurrentTab]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasChanges = tabs.some(tab => hasUnsavedChanges(tab));
      if (hasChanges) {
        e.preventDefault();
        (e as any).returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tabs]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <HeaderBar
        activeEnvId={activeEnvId}
        environments={environments}
        onEnvChange={handleEnvChange}
        onOpenEnvManager={() => setShowEnvManager(true)}
        onImportCollections={handleImportCollections}
        onExportAllCollections={handleExportAllCollections}
        collections={collections}
        onOpenJsonBuilder={() => setShowJsonBuilder(true)}
        onClearHistory={handleClearHistory}
        onClearAll={handleClearAll}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          collections={collections}
          history={history}
          onSelectRequest={handleSelectRequest}
          onSelectHistory={handleSelectHistory}
          onDeleteHistory={handleDeleteHistory}
          onAddCollection={handleAddCollection}
          onRunRequest={handleRunRequest}
          onUpdateCollections={handleUpdateCollections}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onNewTab={handleNewTab}
            onTabsReorder={setTabs}
          />
          <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
            <div className="flex flex-col min-h-0" style={{ height: `${requestHeight}%` }}>
              {activeTab && (
                <RequestBuilder
                  request={activeTab.request}
                  onChange={handleRequestChange}
                  onSend={handleSend}
                  onError={(msg) => showToast('error', msg)}
                  onSaveRequest={handleOpenSaveRequestModal}
                  onUpdateVariable={handleUpdateVariable}
                  loading={activeTab.loading}
                  environments={environments}
                  activeEnvId={activeEnvId}
                  globalVariables={globalVariables}
                  collections={collections}
                  onMethodChange={handleMethodChange}
                  onRunPreRequest={handleRunPreRequest}
                  onRunTest={handleRunTest}
                  lastScriptResult={lastScriptResult}
                />
              )}
            </div>
            <div
              className={`h-1 bg-[rgba(255,255,255,0.05)] resize-handle shrink-0 ${isResizing ? 'active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
            />
            <div className="flex flex-col min-h-0" style={{ height: `${100 - requestHeight}%` }}>
              {activeTab && (
                <ResponseViewer
                  response={activeTab.response}
                  loading={activeTab.loading}
                  error={activeTab.error}
                  testResults={activeTab.testResults}
                  scriptLogs={activeTab.scriptLogs}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {showEnvManager && (
        <EnvironmentManager
          environments={environments}
          globalVariables={globalVariables}
          activeEnvId={activeEnvId}
          onClose={() => setShowEnvManager(false)}
          onSave={handleSaveEnvironments}
          onImport={handleImportEnvironments}
          onExport={handleExportEnvironments}
        />
      )}
      {showJsonBuilder && (
        <JsonBuilder onClose={() => setShowJsonBuilder(false)} />
      )}
      {runningRequest && (
        <CollectionRunner
          requests={[runningRequest.request]}
          collectionName={runningRequest.collectionName}
          environments={environments}
          activeEnvId={activeEnvId}
          globalVariables={globalVariables}
          onError={(msg) => showToast('error', msg)}
          onClose={() => setRunningRequest(null)}
        />
      )}
      {showSaveRequestModal && (
        <SaveRequestModal
          request={showSaveRequestModal.request}
          collections={collections}
          onSave={handleSaveRequestToCollection}
          onCreateCollection={handleCreateCollectionAndSave}
          onClose={() => setShowSaveRequestModal(null)}
        />
      )}
      {showSaveConfirm && (
        <SaveConfirmModal
          action={showSaveConfirm.action}
          onConfirm={handleConfirmSave}
          onDiscard={handleDiscardChanges}
          onCancel={() => setShowSaveConfirm(null)}
        />
      )}
      {showDbErrorModal && (
        <DatabaseErrorModal
          onReset={handleResetDatabase}
          onIgnore={handleIgnoreDbError}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <UpdateNotification />
    </div>
  );
}

export default App;