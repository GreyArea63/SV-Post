import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { RequestBuilder } from './components/RequestBuilder';
import { ResponseViewer } from './components/ResponseViewer';
import { Sidebar } from './components/Sidebar';
import { FunctionMenu } from './components/FunctionMenu';
import { Tabs } from './components/Tabs';
import { EnvironmentManager } from './components/EnvironmentManager';
import { HttpRequest, HttpResponse, HistoryItem, Collection, Environment, KeyValuePair } from './types';
import { storage } from './utils/storage';
import { generateId, replaceVariables, parseKeyValuePairs } from './utils/helpers';

interface Tab {
  id: string;
  request: HttpRequest;
  response: HttpResponse | null;
  loading: boolean;
  error: string | null;
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
  
  const [requestHeight, setRequestHeight] = useState<number>(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCollections(storage.getCollections());
    setHistory(storage.getHistory());
    setEnvironments(storage.getEnvironments());
    setGlobalVariables(storage.getGlobalVariables());
    setActiveEnvId(storage.getActiveEnvironment());
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const relativeY = e.clientY - containerRect.top;
      const containerHeight = containerRect.height;
      const newPercentage = (relativeY / containerHeight) * 100;
      
      if (newPercentage >= 20 && newPercentage <= 80) {
        setRequestHeight(newPercentage);
      }
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

      if (processedRequest.auth) {
        if (processedRequest.auth.type === 'bearer' && processedRequest.auth.token) {
          headers['Authorization'] = `Bearer ${processedRequest.auth.token}`;
        } else if (processedRequest.auth.type === 'basic' && processedRequest.auth.username) {
          const credentials = btoa(`${processedRequest.auth.username}:${processedRequest.auth.password || ''}`);
          headers['Authorization'] = `Basic ${credentials}`;
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
      storage.saveHistory(newHistory);

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
      } else {
        setTabs(tabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, loading: false, error: err.message || 'Произошла ошибка при отправке запроса' }
            : tab
        ));
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
    if (tabs.length >= 10) return;
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

  // НОВАЯ ФУНКЦИЯ: создание вкладки с конкретным методом
  const handleMethodChange = (newMethod: string) => {
    if (tabs.length >= 10) {
      alert('Достигнут лимит в 10 вкладок. Закройте одну из вкладок.');
      return;
    }

    const newTab: Tab = {
      id: generateId(),
      request: {
        ...DEFAULT_REQUEST,
        id: generateId(),
        method: newMethod,
      },
      response: null,
      loading: false,
      error: null,
    };

    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleRequestChange = (request: HttpRequest) => {
    setTabs(tabs.map(tab => 
      tab.id === activeTabId ? { ...tab, request } : tab
    ));
  };

  const handleAddCollection = () => {
    const name = prompt('Название коллекции:');
    if (name) {
      const newCollection: Collection = {
        id: generateId(),
        name,
        requests: [],
      };
      const newCollections = [...collections, newCollection];
      setCollections(newCollections);
      storage.saveCollections(newCollections);
    }
  };

  const handleImportCollections = (importedCollections: Collection[]) => {
    const existingIds = new Set(collections.map(c => c.id));
    const newCollections = importedCollections.map(c => 
      existingIds.has(c.id) ? { ...c, id: generateId() } : c
    );
    const updated = [...collections, ...newCollections];
    setCollections(updated);
    storage.saveCollections(updated);
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
  };

  const handleSelectRequest = (collectionId: string, requestId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    const request = collection?.requests.find(r => r.id === requestId);
    if (request && activeTab) {
      handleRequestChange(request);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    if (activeTab) {
      handleRequestChange(item.request);
      setTabs(tabs.map(tab => 
        tab.id === activeTabId ? { ...tab, response: item.response } : tab
      ));
    }
  };

  const handleSaveEnvironments = (envs: Environment[], globals: KeyValuePair[]) => {
    setEnvironments(envs);
    setGlobalVariables(globals);
    storage.saveEnvironments(envs);
    storage.saveGlobalVariables(globals);
  };

  const handleImportEnvironments = (envs: Environment[]) => {
    const existingIds = new Set(environments.map(e => e.id));
    const newEnvs = envs.map(e => 
      existingIds.has(e.id) ? { ...e, id: generateId() } : e
    );
    const updated = [...environments, ...newEnvs];
    setEnvironments(updated);
    storage.saveEnvironments(updated);
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
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header - 48px */}
      <div className="h-12 bg-[#1e1e1e] border-b border-[#3d3d3d] flex items-center px-4 gap-3 shrink-0">
        <FunctionMenu
          onImport={handleImportCollections}
          onExportAll={handleExportAllCollections}
          collections={collections}
          onOpenEnvManager={() => setShowEnvManager(true)}
        />

        <div className="h-6 w-px bg-[#3d3d3d]" />

        <h1 className="text-lg font-bold text-primary-500">SV-Post</h1>

        <div className="ml-auto flex items-center gap-3">
          {activeEnvId && (
            <span className="text-xs text-gray-400">
              Окружение: <span className="text-primary-500 font-medium">
                {environments.find(e => e.id === activeEnvId)?.name || '—'}
              </span>
            </span>
          )}
          <select
            value={activeEnvId || ''}
            onChange={(e) => {
              const envId = e.target.value || null;
              setActiveEnvId(envId);
              storage.setActiveEnvironment(envId);
            }}
            className="px-3 py-1 bg-[#2d2d2d] border border-[#3d3d3d] rounded text-sm"
          >
            <option value="">Нет окружения</option>
            {environments.map(env => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowEnvManager(true)}
            className="px-3 py-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#3d3d3d] rounded text-sm transition-colors"
            title="Менеджер окружений"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - 280px */}
        <Sidebar
          collections={collections}
          history={history}
          onSelectRequest={handleSelectRequest}
          onSelectHistory={handleSelectHistory}
          onAddCollection={handleAddCollection}
        />

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs - 38px */}
          <Tabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onNewTab={handleNewTab}
          />

          {/* Resizable Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
            {/* Request Builder - верхняя часть */}
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

            {/* Resizable Divider - 4px */}
            <div
              className={`h-1 bg-[#3d3d3d] resize-handle shrink-0 ${isResizing ? 'active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
            />

            {/* Response Viewer - нижняя часть */}
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

      {/* Environment Manager Modal */}
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
    </div>
  );
}

export default App;