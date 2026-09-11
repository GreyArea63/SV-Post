import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface Tab {
  id: string;
  request: HttpRequest;
  response: HttpResponse | null;
  loading: boolean;
  error: string | null;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const DEFAULT_REQUEST: HttpRequest = {
  id: generateId(),
  name: 'New Request',
  method: 'GET',
  url: '',
  headers: [],
  queryParams: [],
  body: {
    type: 'none',
    content: '',
  },
};

const MAX_TABS = 10;

function App() {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: generateId(),
      request: DEFAULT_REQUEST,
      response: null,
      loading: false,
      error: null,
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
  
  const [requestHeight, setRequestHeight] = useState<number>(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cols, hist, envs, globals, activeEnv] = await Promise.all([
          storage.getCollections(),
          storage.getHistory(),
          storage.getEnvironments(),
          storage.getGlobalVariables(),
          storage.getActiveEnvironment(),
        ]);
        setCollections(cols);
        setHistory(hist);
        setEnvironments(envs);
        setGlobalVariables(globals);
        setActiveEnvId(activeEnv);
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

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const getActiveEnvironment = (): Environment | null => {
    return environments.find(env => env.id === activeEnvId) || null;
  };

  const processRequest = (request: HttpRequest): HttpRequest => {
    const env = getActiveEnvironment();
    const envVariables = env?.variables || [];
    
    const allVariables = [
      ...globalVariables.filter(g => g.enabled),
      ...envVariables.filter(e => e.enabled),
    ];

    return {
      ...request,
      url: replaceVariables(request.url, allVariables),
      headers: request.headers.map(h => ({
        ...h,
        value: replaceVariables(h.value, allVariables),
      })),
      queryParams: request.queryParams.map(p => ({
        ...p,
        value: replaceVariables(p.value, allVariables),
      })),
      body: {
        ...request.body,
        content: replaceVariables(request.body.content, allVariables),
      },
    };
  };

  const handleSend = async () => {
    if (!activeTab) return;

    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, loading: true, error: null, response: null }
        : tab
    ));

    try {
      const processedRequest = processRequest(activeTab.request);
      
      let url = processedRequest.url;
      const queryParams = parseKeyValuePairs(processedRequest.queryParams);
      if (Object.keys(queryParams).length > 0) {
        const searchParams = new URLSearchParams(queryParams);
        url += (url.includes('?') ? '&' : '?') + searchParams.toString();
      }

      const headers = parseKeyValuePairs(processedRequest.headers);

      // Обработка авторизации
      if (processedRequest.auth) {
        switch (processedRequest.auth.type) {
          case 'bearer':
            if (processedRequest.auth.token) {
              headers['Authorization'] = `Bearer ${processedRequest.auth.token}`;
            }
            break;
          case 'basic':
            if (processedRequest.auth.username) {
              const credentials = btoa(`${processedRequest.auth.username}:${processedRequest.auth.password || ''}`);
              headers['Authorization'] = `Basic ${credentials}`;
            }
            break;
          case 'apikey':
            if (processedRequest.auth.apiKey && processedRequest.auth.apiValue) {
              if (processedRequest.auth.addTo === 'header') {
                headers[processedRequest.auth.apiKey] = processedRequest.auth.apiValue;
              } else if (processedRequest.auth.addTo === 'queryParams') {
                const searchParams = new URLSearchParams(url.split('?')[1] || '');
                searchParams.set(processedRequest.auth.apiKey, processedRequest.auth.apiValue);
                url += (url.includes('?') ? '&' : '?') + searchParams.toString();
              }
            }
            break;
          case 'oauth2':
            if (processedRequest.auth.accessToken) {
              headers['Authorization'] = `${processedRequest.auth.tokenType || 'Bearer'} ${processedRequest.auth.accessToken}`;
            }
            break;
          case 'noauth':
          case 'none':
            // Нет авторизации
            break;
        }
      }

      const config: any = {
        method: processedRequest.method.toLowerCase(),
        url,
        headers,
        timeout: 30000,
      };

      if (processedRequest.body.type !== 'none' && ['POST', 'PUT', 'PATCH'].includes(processedRequest.method)) {
        if (processedRequest.body.type === 'json' || processedRequest.body.type === 'raw') {
          try {
            config.data = JSON.parse(processedRequest.body.content);
            headers['Content-Type'] = 'application/json';
          } catch {
            config.data = processedRequest.body.content;
          }
        }
      }

      const startTime = Date.now();
      const axiosResponse = await axios(config);
      const endTime = Date.now();

      const httpResponse: HttpResponse = {
        status: axiosResponse.status,
        statusText: axiosResponse.statusText,
        headers: axiosResponse.headers as Record<string, string>,
        data: axiosResponse.data,
        time: endTime - startTime,
        size: JSON.stringify(axiosResponse.data).length,
      };

      setTabs(tabs.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, loading: false, response: httpResponse, error: null }
          : tab
      ));

      const historyItem: HistoryItem = {
        id: generateId(),
        request: activeTab.request,
        response: httpResponse,
        timestamp: Date.now(),
      };
      
      const newHistory = [historyItem, ...history].slice(0, 100);
      setHistory(newHistory);
      await storage.saveHistory(newHistory);
      showToast('success', `Запрос выполнен: ${httpResponse.status}`);

    } catch (err: any) {
      if (err.response) {
        const endTime = Date.now();
        const httpResponse: HttpResponse = {
          status: err.response.status,
          statusText: err.response.statusText,
          headers: err.response.headers as Record<string, string>,
          data: err.response.data,
          time: endTime - (endTime - 30000),
          size: JSON.stringify(err.response.data).length,
        };
        setTabs(tabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, loading: false, response: httpResponse, error: null }
            : tab
        ));
        showToast('error', `Ошибка: ${httpResponse.status}`);
      } else {
        setTabs(tabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, loading: false, error: err.message || 'Произошла ошибка при отправке запроса' }
            : tab
        ));
        showToast('error', err.message || 'Ошибка соединения');
      }
    }
  };

  const handleTabClick = (tabId: string) => setActiveTabId(tabId);

  const handleTabClose = (tabId: string) => {
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    if (tabId === activeTabId && newTabs.length > 0) {
      setActiveTabId(newTabs[0].id);
    }
    setTabs(newTabs);
  };

  const handleNewTab = () => {
    if (tabs.length >= MAX_TABS) {
      showToast('error', `Достигнут лимит в ${MAX_TABS} вкладок`);
      return;
    }
    const newTab: Tab = {
      id: generateId(),
      request: { ...DEFAULT_REQUEST, id: generateId() },
      response: null,
      loading: false,
      error: null,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleMethodChange = (newMethod: string) => {
    if (tabs.length >= MAX_TABS) {
      showToast('error', `Достигнут лимит в ${MAX_TABS} вкладок. Закройте одну из вкладок.`);
      return;
    }

    const newTab: Tab = {
      id: generateId(),
      request: {
        ...DEFAULT_REQUEST,
        id: generateId(),
        method: newMethod,
        name: `New ${newMethod} Request`,
      },
      response: null,
      loading: false,
      error: null,
    };

    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    showToast('info', `Создана новая вкладка: ${newMethod}`);
  };

  const handleRequestChange = (request: HttpRequest) => {
    setTabs(tabs.map(tab => 
      tab.id === activeTabId ? { ...tab, request } : tab
    ));
  };

  const handleAddCollection = async () => {
    const name = prompt('Название коллекции:');
    if (name) {
      const newCollection: Collection = {
        id: generateId(),
        name,
        requests: [],
      };
      const newCollections = [...collections, newCollection];
      setCollections(newCollections);
      await storage.saveCollections(newCollections);
      showToast('success', `Коллекция "${name}" создана`);
    }
  };

  const handleImportCollections = async (importedCollections: Collection[]) => {
    const existingIds = new Set(collections.map(c => c.id));
    const newCollections = importedCollections.map(c => 
      existingIds.has(c.id) ? { ...c, id: generateId() } : c
    );
    const updated = [...collections, ...newCollections];
    setCollections(updated);
    await storage.saveCollections(updated);
    showToast('success', `Импортировано коллекций: ${newCollections.length}`);
  };

  const handleExportAllCollections = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      collections,
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `sv-post-collections-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Коллекции экспортированы');
  };

  const handleSelectRequest = (collectionId: string, requestId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    const request = collection?.requests.find(r => r.id === requestId);
    
    if (request) {
      const isEmptyTab = activeTab && 
        activeTab.request.name === 'New Request' && 
        activeTab.request.url === '' &&
        activeTab.response === null;
      
      if (isEmptyTab) {
        handleRequestChange(request);
      } else {
        if (tabs.length >= MAX_TABS) {
          showToast('error', `Достигнут лимит в ${MAX_TABS} вкладок`);
          return;
        }
        
        const newTab: Tab = {
          id: generateId(),
          request: { ...request, id: generateId() },
          response: null,
          loading: false,
          error: null,
        };
        
        setTabs([...tabs, newTab]);
        setActiveTabId(newTab.id);
      }
      
      showToast('info', `Загружен запрос: ${request.name}`);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    const isEmptyTab = activeTab && 
      activeTab.request.name === 'New Request' && 
      activeTab.request.url === '' &&
      activeTab.response === null;
    
    if (isEmptyTab) {
      handleRequestChange(item.request);
      setTabs(tabs.map(tab => 
        tab.id === activeTabId ? { ...tab, response: item.response } : tab
      ));
    } else {
      if (tabs.length >= MAX_TABS) {
        showToast('error', `Достигнут лимит в ${MAX_TABS} вкладок`);
        return;
      }
      
      const newTab: Tab = {
        id: generateId(),
        request: { ...item.request, id: generateId() },
        response: item.response,
        loading: false,
        error: null,
      };
      
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    }
    
    showToast('info', 'Запрос из истории загружен');
  };

  const handleRunRequest = (request: HttpRequest, collectionName: string) => {
    setRunningRequest({ request, collectionName });
  };

  const handleSaveEnvironments = async (envs: Environment[], globals: KeyValuePair[]) => {
    setEnvironments(envs);
    setGlobalVariables(globals);
    await Promise.all([
      storage.saveEnvironments(envs),
      storage.saveGlobalVariables(globals),
    ]);
    showToast('success', 'Окружения сохранены');
  };

  const handleImportEnvironments = async (envs: Environment[]) => {
    const existingIds = new Set(environments.map(e => e.id));
    const newEnvs = envs.map(e => 
      existingIds.has(e.id) ? { ...e, id: generateId() } : e
    );
    const updated = [...environments, ...newEnvs];
    setEnvironments(updated);
    await storage.saveEnvironments(updated);
    showToast('success', `Импортировано окружений: ${newEnvs.length}`);
  };

  const handleExportEnvironments = (envs: Environment[], globals: KeyValuePair[]) => {
    const exportData = {
      type: 'sv-post-environments',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      environments: envs,
      globalVariables: globals,
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `sv-post-environments-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Окружения экспортированы');
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header — узкий, 32px */}
      <div className="h-8 bg-gradient-to-r from-[#1a1a23] to-[#0f0f14] border-b border-[rgba(255,255,255,0.08)] flex items-center px-3 gap-2 shrink-0">
        <FunctionMenu
          onImport={handleImportCollections}
          onExportAll={handleExportAllCollections}
          collections={collections}
          onOpenEnvManager={() => setShowEnvManager(true)}
          onOpenJsonBuilder={() => setShowJsonBuilder(true)}
        />

        <div className="h-4 w-px bg-[rgba(255,255,255,0.1)]" />

        <h1 className="text-sm font-bold gradient-text">SV-Post</h1>

        <div className="ml-auto flex items-center gap-2">
          {activeEnvId && (
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-gray-300">{environments.find(e => e.id === activeEnvId)?.name}</span>
            </span>
          )}
          <select
            value={activeEnvId || ''}
            onChange={async (e) => {
              const envId = e.target.value || null;
              setActiveEnvId(envId);
              await storage.setActiveEnvironment(envId);
              showToast('info', envId ? 'Окружение изменено' : 'Окружение отключено');
            }}
            className="h-[24px] px-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[rgba(255,255,255,0.08)] rounded text-[11px] text-gray-300 focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer"
          >
            <option value="">Нет окружения</option>
            {environments.map(env => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowEnvManager(true)}
            className="h-[24px] w-[24px] flex items-center justify-center bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[rgba(255,255,255,0.08)] rounded transition-all"
            title="Менеджер окружений"
          >
            <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          collections={collections}
          history={history}
          onSelectRequest={handleSelectRequest}
          onSelectHistory={handleSelectHistory}
          onAddCollection={handleAddCollection}
          onRunRequest={handleRunRequest}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onNewTab={handleNewTab}
          />

          <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
            <div 
              className="flex flex-col min-h-0"
              style={{ height: `${requestHeight}%` }}
            >
              {activeTab && (
                <RequestBuilder
                  request={activeTab.request}
                  onChange={handleRequestChange}
                  onSend={handleSend}
                  loading={activeTab.loading}
                  environments={environments}
                  activeEnvId={activeEnvId}
                  globalVariables={globalVariables}
                  collections={collections}
                  onMethodChange={handleMethodChange}
                  tabCount={tabs.length}
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

            <div 
              className="flex flex-col min-h-0"
              style={{ height: `${100 - requestHeight}%` }}
            >
              {activeTab && (
                <ResponseViewer
                  response={activeTab.response}
                  loading={activeTab.loading}
                  error={activeTab.error}
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
          collections={collections}
          onClose={() => setShowEnvManager(false)}
          onSave={handleSaveEnvironments}
          onImport={handleImportEnvironments}
          onExport={handleExportEnvironments}
        />
      )}

      {showJsonBuilder && (
        <JsonBuilder
          onClose={() => setShowJsonBuilder(false)}
        />
      )}

      {runningRequest && (
        <CollectionRunner
          requests={[runningRequest.request]}
          collectionName={runningRequest.collectionName}
          environments={environments}
          activeEnvId={activeEnvId}
          globalVariables={globalVariables}
          onClose={() => setRunningRequest(null)}
        />
      )}

      {/* Toast Notifications */}
      <div className="fixed top-16 right-4 z-[300] space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] ${
              toast.type === 'success' ? 'bg-green-500/20 border border-green-500/30 text-green-400' :
              toast.type === 'error' ? 'bg-red-500/20 border border-red-500/30 text-red-400' :
              'bg-blue-500/20 border border-blue-500/30 text-blue-400'
            }`}
          >
            {toast.type === 'success' && <CheckCircle size={18} />}
            {toast.type === 'error' && <AlertCircle size={18} />}
            {toast.type === 'info' && <Info size={18} />}
            <span className="flex-1 text-sm">{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="hover:opacity-70"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;