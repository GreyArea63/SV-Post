import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { RequestBuilder } from './components/RequestBuilder';
import { ResponseViewer } from './components/ResponseViewer';
import { Sidebar } from './components/Sidebar';
import { FunctionMenu } from './components/FunctionMenu';
import { Tabs } from './components/Tabs';
import { EnvironmentManager } from './components/EnvironmentManager';
import { CollectionRunner } from './components/CollectionRunner';
import { JsonBuilder } from './components/JsonBuilder';
import { HttpRequest, HttpResponse, HistoryItem, Collection, Environment, KeyValuePair } from './types';
import { storage } from './utils/storage';
import { generateId, replaceVariables, parseKeyValuePairs } from './utils/helpers';
import { X, CheckCircle, AlertCircle, Info, Save } from 'lucide-react';

interface Tab {
  id: string;
  request: HttpRequest;
  response: HttpResponse | null;
  loading: boolean;
  error: string | null;
  // Snapshot для отслеживания изменений (без method и name)
  savedSnapshot?: string;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const createDefaultRequest = (method: string = 'GET'): HttpRequest => ({
  id: generateId(),
  name: method === 'GET' ? 'New Request' : `New ${method} Request`,
  method,
  url: '',
  headers: [],
  queryParams: [],
  body: { type: 'none', content: '' },
});

const DEFAULT_REQUEST = createDefaultRequest();

const MAX_TABS = 10;

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

// Создаём snapshot для сравнения (исключая method и name, которые меняются при смене метода)
const createSnapshot = (request: HttpRequest): string => {
  const { method, name, ...rest } = request;
  return JSON.stringify(rest);
};

// Проверяем, есть ли несохранённые изменения (сравниваем snapshot без method/name)
const hasUnsavedChanges = (tab: Tab): boolean => {
  if (!tab.savedSnapshot) return false;
  const currentSnapshot = createSnapshot(tab.request);
  return currentSnapshot !== tab.savedSnapshot;
};

function App() {
  const [tabs, setTabs] = useState<Tab[]>([
    { 
      id: generateId(), 
      request: DEFAULT_REQUEST, 
      response: null, 
      loading: false, 
      error: null, 
      savedSnapshot: createSnapshot(DEFAULT_REQUEST) 
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
  
  const [requestHeight, setRequestHeight] = useState<number>(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cols, hist, envs, globals, activeEnv] = await Promise.all([
          storage.getCollections(), storage.getHistory(), storage.getEnvironments(),
          storage.getGlobalVariables(), storage.getActiveEnvironment(),
        ]);
        setCollections(cols); setHistory(hist); setEnvironments(envs);
        setGlobalVariables(globals); setActiveEnvId(activeEnv);
      } catch (error) {
        console.error('Ошибка загрузки:', error);
        showToast('error', 'Ошибка загрузки данных');
      }
    };
    loadData();
  }, [showToast]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerHeight = containerRef.current.getBoundingClientRect().height;
      const newPercentage = ((e.clientY - containerRef.current.getBoundingClientRect().top) / containerHeight) * 100;
      if (newPercentage >= 20 && newPercentage <= 80) setRequestHeight(newPercentage);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Ctrl+S — сохранение текущей вкладки (обновляет snapshot)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveCurrentTab();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs]);

  // Предупреждение при закрытии вкладки браузера
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasChanges = tabs.some(tab => hasUnsavedChanges(tab));
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tabs]);

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const getActiveEnvironment = useCallback((): Environment | null => {
    return environments.find(env => env.id === activeEnvId) || null;
  }, [environments, activeEnvId]);

  const processRequest = useCallback((request: HttpRequest): HttpRequest => {
    const env = getActiveEnvironment();
    const envVariables = env?.variables || [];
    const allVariables = [...globalVariables.filter(g => g.enabled), ...envVariables.filter(e => e.enabled)];

    return {
      ...request,
      url: replaceVariables(request.url, allVariables),
      headers: request.headers.map(h => ({ ...h, value: replaceVariables(h.value, allVariables) })),
      queryParams: request.queryParams.map(p => ({ ...p, value: replaceVariables(p.value, allVariables) })),
      body: { ...request.body, content: replaceVariables(request.body.content, allVariables) },
    };
  }, [getActiveEnvironment, globalVariables]);

  const handleSend = useCallback(async () => {
    if (!activeTab) return;

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
        if (processedRequest.auth.type === 'bearer' && processedRequest.auth.token) {
          headers['Authorization'] = `Bearer ${processedRequest.auth.token}`;
        } else if (processedRequest.auth.type === 'basic' && processedRequest.auth.username) {
          headers['Authorization'] = `Basic ${btoa(unescape(encodeURIComponent(`${processedRequest.auth.username}:${processedRequest.auth.password || ''}`)))}`;
        } else if (processedRequest.auth.type === 'apikey' && processedRequest.auth.apiKey && processedRequest.auth.apiValue) {
          if (processedRequest.auth.addTo === 'header') {
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
      const config: any = { method: processedRequest.method.toLowerCase(), url, headers, timeout: 30000 };

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
                if (field.enabled && field.key) {
                  formData.append(field.key, field.value);
                }
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
                if (field.enabled && field.key) {
                  formData.append(field.key, field.value);
                }
              });
              config.data = formData;
              delete headers['Content-Type'];
            }
            break;
            
          case 'graphql':
            try {
              const graphqlData = JSON.parse(processedRequest.body.content);
              config.data = {
                query: graphqlData.query || '',
                variables: graphqlData.variables || {},
                operationName: graphqlData.operationName || null,
              };
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

      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === activeTabId ? { ...tab, loading: false, response: httpResponse, error: null } : tab
      ));

      const historyItem: HistoryItem = { id: generateId(), request: activeTab.request, response: httpResponse, timestamp: Date.now() };
      const newHistory = [historyItem, ...history].slice(0, 100);
      setHistory(newHistory);
      await storage.saveHistory(newHistory);
      showToast('success', `Запрос выполнен: ${httpResponse.status}`);

    } catch (err: any) {
      const endTime = Date.now();
      const startTime = endTime - 30000;
      if (err.response) {
        const httpResponse: HttpResponse = {
          status: err.response.status,
          statusText: err.response.statusText,
          headers: (err.response.headers as any).toJSON ? (err.response.headers as any).toJSON() : err.response.headers,
          data: err.response.data,
          time: endTime - startTime,
          size: new Blob([JSON.stringify(err.response.data)]).size,
        };
        setTabs(prevTabs => prevTabs.map(tab => tab.id === activeTabId ? { ...tab, loading: false, response: httpResponse, error: null } : tab));
        showToast('error', `Ошибка: ${httpResponse.status}`);
      } else {
        setTabs(prevTabs => prevTabs.map(tab => tab.id === activeTabId ? { ...tab, loading: false, error: err.message || 'Ошибка соединения' } : tab));
        showToast('error', err.message || 'Ошибка соединения');
      }
    }
  }, [activeTab, activeTabId, processRequest, history, showToast]);

  // Переключение вкладки — НЕ спрашиваем сохранение при смене метода
  const handleTabClick = useCallback((tabId: string) => {
    if (activeTab && hasUnsavedChanges(activeTab) && tabId !== activeTabId) {
      setShowSaveConfirm({ tabId, action: 'switch' });
    } else {
      setActiveTabId(tabId);
    }
  }, [activeTab, activeTabId]);

  // Закрытие вкладки — спрашиваем только если есть несохранённые изменения
  const handleTabClose = useCallback((tabId: string) => {
    const tabToClose = tabs.find(t => t.id === tabId);
    if (tabToClose && hasUnsavedChanges(tabToClose)) {
      setShowSaveConfirm({ tabId, action: 'close' });
    } else {
      performTabClose(tabId);
    }
  }, [tabs]);

  const performTabClose = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const newTabs = prevTabs.filter(tab => tab.id !== tabId);
      if (newTabs.length === 0) {
        const defaultTab = { 
          id: generateId(), 
          request: createDefaultRequest(), 
          response: null, 
          loading: false, 
          error: null, 
          savedSnapshot: createSnapshot(createDefaultRequest()) 
        };
        setActiveTabId(defaultTab.id);
        return [defaultTab];
      }
      if (tabId === activeTabId) setActiveTabId(newTabs[0].id);
      return newTabs;
    });
  }, [activeTabId]);

  // Ctrl+S — сохраняем текущий snapshot
  const handleSaveCurrentTab = useCallback(() => {
    if (!activeTab) return;
    
    const newSnapshot = createSnapshot(activeTab.request);
    setTabs(prevTabs => prevTabs.map(tab => 
      tab.id === activeTabId ? { ...tab, savedSnapshot: newSnapshot } : tab
    ));
    showToast('success', 'Запрос сохранён (Ctrl+S)');
  }, [activeTab, activeTabId, showToast]);

  const handleConfirmSave = useCallback(() => {
    if (!showSaveConfirm) return;
    
    handleSaveCurrentTab();
    
    if (showSaveConfirm.action === 'close') {
      performTabClose(showSaveConfirm.tabId);
    } else if (showSaveConfirm.action === 'switch') {
      setActiveTabId(showSaveConfirm.tabId);
    }
    
    setShowSaveConfirm(null);
  }, [showSaveConfirm, handleSaveCurrentTab, performTabClose]);

  const handleDiscardChanges = useCallback(() => {
    if (!showSaveConfirm) return;
    
    if (showSaveConfirm.action === 'close') {
      performTabClose(showSaveConfirm.tabId);
    } else if (showSaveConfirm.action === 'switch') {
      setActiveTabId(showSaveConfirm.tabId);
    }
    
    setShowSaveConfirm(null);
  }, [showSaveConfirm, performTabClose]);

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
      savedSnapshot: createSnapshot(newRequest) 
    };
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs.length, showToast]);

  // Смена метода — НЕ триггерит сохранение
  const handleMethodChange = useCallback((newMethod: string) => {
    if (!activeTab) return;
    
    if (isTabEmpty(activeTab)) {
      // На пустой вкладке меняем метод и обновляем snapshot (чтобы не спрашивать сохранение)
      const updatedRequest = { 
        ...activeTab.request, 
        method: newMethod, 
        name: newMethod === 'GET' ? 'New Request' : `New ${newMethod} Request` 
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
      savedSnapshot: createSnapshot(newRequest)
    };
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);
    showToast('info', `Создана новая вкладка: ${newMethod}`);
  }, [activeTab, activeTabId, tabs.length, showToast]);

  const handleRequestChange = useCallback((request: HttpRequest) => {
    setTabs(prevTabs => prevTabs.map(tab => tab.id === activeTabId ? { ...tab, request } : tab));
  }, [activeTabId]);

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
    const existingIds = new Set(collections.map(c => c.id));
    const newCollections = importedCollections.map(c => existingIds.has(c.id) ? { ...c, id: generateId() } : c);
    const updated = [...collections, ...newCollections];
    setCollections(updated);
    await storage.saveCollections(updated);
    showToast('success', `Импортировано коллекций: ${newCollections.length}`);
  }, [collections, showToast]);

  const handleExportAllCollections = useCallback(() => {
    const exportData = { version: '1.0', exportedAt: new Date().toISOString(), collections };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sv-post-collections-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Коллекции экспортированы');
  }, [collections, showToast]);

  const handleSelectRequest = useCallback((collectionId: string, requestId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    const request = collection?.requests.find(r => r.id === requestId);
    if (request) {
      if (activeTab && isTabEmpty(activeTab)) {
        handleRequestChange(request);
        // Обновляем snapshot при загрузке запроса из коллекции
        setTabs(prevTabs => prevTabs.map(tab => 
          tab.id === activeTabId ? { ...tab, savedSnapshot: createSnapshot(request) } : tab
        ));
      } else {
        if (tabs.length >= MAX_TABS) { showToast('error', `Достигнут лимит в ${MAX_TABS} вкладок`); return; }
        const newRequest = { ...request, id: generateId() };
        const newTab: Tab = { 
          id: generateId(), 
          request: newRequest, 
          response: null, 
          loading: false, 
          error: null, 
          savedSnapshot: createSnapshot(newRequest) 
        };
        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(newTab.id);
      }
      showToast('info', `Загружен запрос: ${request.name}`);
    }
  }, [collections, activeTab, activeTabId, tabs.length, handleRequestChange, showToast]);

  const handleSelectHistory = useCallback((item: HistoryItem) => {
    if (activeTab && isTabEmpty(activeTab)) {
      handleRequestChange(item.request);
      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === activeTabId ? { ...tab, response: item.response, savedSnapshot: createSnapshot(item.request) } : tab
      ));
    } else {
      if (tabs.length >= MAX_TABS) { showToast('error', `Достигнут лимит в ${MAX_TABS} вкладок`); return; }
      const newRequest = { ...item.request, id: generateId() };
      const newTab: Tab = { 
        id: generateId(), 
        request: newRequest, 
        response: item.response, 
        loading: false, 
        error: null, 
        savedSnapshot: createSnapshot(newRequest) 
      };
      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId(newTab.id);
    }
    showToast('info', 'Запрос из истории загружен');
  }, [activeTab, activeTabId, tabs.length, handleRequestChange, showToast]);

  const handleDeleteHistory = useCallback((id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    storage.saveHistory(newHistory);
    showToast('info', 'Запись удалена из истории');
  }, [history, showToast]);

  const handleRunRequest = useCallback((request: HttpRequest, collectionName: string) => {
    setRunningRequest({ request, collectionName });
  }, []);

  const handleSaveEnvironments = useCallback(async (envs: Environment[], globals: KeyValuePair[]) => {
    setEnvironments(envs); 
    setGlobalVariables(globals);
    
    if (activeEnvId && !envs.find(e => e.id === activeEnvId)) {
      setActiveEnvId(null);
      await storage.setActiveEnvironment(null);
      showToast('info', 'Активное окружение было удалено');
    }
    
    await Promise.all([storage.saveEnvironments(envs), storage.saveGlobalVariables(globals)]);
    showToast('success', 'Окружения сохранены');
  }, [showToast, activeEnvId]);

  const handleImportEnvironments = useCallback(async (envs: Environment[]) => {
    const existingIds = new Set(environments.map(e => e.id));
    const newEnvs = envs.map(e => existingIds.has(e.id) ? { ...e, id: generateId() } : e);
    const updated = [...environments, ...newEnvs];
    setEnvironments(updated);
    await storage.saveEnvironments(updated);
    showToast('success', `Импортировано окружений: ${newEnvs.length}`);
  }, [environments, showToast]);

  const handleExportEnvironments = useCallback((envs: Environment[], globals: KeyValuePair[]) => {
    const exportData = { type: 'sv-post-environments', version: '1.0', exportedAt: new Date().toISOString(), environments: envs, globalVariables: globals };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sv-post-environments-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Окружения экспортированы');
  }, [showToast]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    showToast('info', 'История очищена');
  }, [showToast]);

  const handleClearAll = useCallback(() => {
    setHistory([]);
    setCollections([]);
    setEnvironments([]);
    setGlobalVariables([]);
    setActiveEnvId(null);
    showToast('info', 'Все данные очищены');
  }, [showToast]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="h-8 bg-[#1e1e1e] border-b border-[rgba(255,255,255,0.08)] flex items-center px-3 gap-2 shrink-0">
        <FunctionMenu 
          onImport={handleImportCollections} 
          onExportAll={handleExportAllCollections} 
          collections={collections} 
          onOpenEnvManager={() => setShowEnvManager(true)} 
          onOpenJsonBuilder={() => setShowJsonBuilder(true)}
          onClearHistory={handleClearHistory}
          onClearAll={handleClearAll}
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
          <select value={activeEnvId || ''} onChange={async (e) => { const envId = e.target.value || null; setActiveEnvId(envId); await storage.setActiveEnvironment(envId); showToast('info', envId ? 'Окружение изменено' : 'Окружение отключено'); }} className="h-[24px] px-2 bg-[#2d2d2d] hover:bg-[#363636] border border-[rgba(255,255,255,0.08)] rounded text-[11px] text-gray-300 focus:outline-none focus:border-gray-500 transition-all cursor-pointer">
            <option value="">Нет окружения</option>
            {environments.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}
          </select>
          <button onClick={() => setShowEnvManager(true)} className="h-[24px] w-[24px] flex items-center justify-center bg-[#2d2d2d] hover:bg-[#363636] border border-[rgba(255,255,255,0.08)] rounded transition-all" title="Менеджер окружений">
            <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar collections={collections} history={history} onSelectRequest={handleSelectRequest} onSelectHistory={handleSelectHistory} onDeleteHistory={handleDeleteHistory} onAddCollection={handleAddCollection} onRunRequest={handleRunRequest} />
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
              {activeTab && <RequestBuilder request={activeTab.request} onChange={handleRequestChange} onSend={handleSend} onError={(msg) => showToast('error', msg)} loading={activeTab.loading} environments={environments} activeEnvId={activeEnvId} globalVariables={globalVariables} collections={collections} onMethodChange={handleMethodChange} />}
            </div>
            <div className={`h-1 bg-[rgba(255,255,255,0.05)] resize-handle shrink-0 ${isResizing ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }} />
            <div className="flex flex-col min-h-0" style={{ height: `${100 - requestHeight}%` }}>
              {activeTab && <ResponseViewer response={activeTab.response} loading={activeTab.loading} error={activeTab.error} />}
            </div>
          </div>
        </div>
      </div>

      {showEnvManager && <EnvironmentManager environments={environments} globalVariables={globalVariables} activeEnvId={activeEnvId} onClose={() => setShowEnvManager(false)} onSave={handleSaveEnvironments} onImport={handleImportEnvironments} onExport={handleExportEnvironments} />}
      {showJsonBuilder && <JsonBuilder onClose={() => setShowJsonBuilder(false)} />}
      
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

      {/* Модальное окно подтверждения сохранения */}
      {showSaveConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[400] p-4">
          <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-md p-6 animate-scale-in">
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
              {showSaveConfirm.action === 'close' 
                ? 'Вы хотите сохранить изменения перед закрытием вкладки?' 
                : 'Вы хотите сохранить изменения перед переключением вкладки?'}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveConfirm(null)}
                className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all"
              >
                Отмена
              </button>
              <button
                onClick={handleDiscardChanges}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all"
              >
                Не сохранять
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-16 right-4 z-[300] space-y-2">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] ${toast.type === 'success' ? 'bg-green-500/20 border border-green-500/30 text-green-400' : toast.type === 'error' ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-blue-500/20 border border-blue-500/30 text-blue-400'}`}>
            {toast.type === 'success' && <CheckCircle size={18} />}
            {toast.type === 'error' && <AlertCircle size={18} />}
            {toast.type === 'info' && <Info size={18} />}
            <span className="flex-1 text-sm">{toast.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="hover:opacity-70"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;