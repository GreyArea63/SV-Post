import { useState, useMemo, useCallback } from 'react';
import { Send, AlertCircle, CheckCircle, Save, Share2, Code, Database, Key, Lock, User, RefreshCw, Play } from 'lucide-react';
import { HttpRequest, KeyValuePair, RequestBody, Environment, Collection, RequestAuth, ScriptExecutionResult } from '../types';
import { findVariablesInText, isVariableResolved } from '../utils/helpers';
import { getMethodColor } from '../utils/methodColors';
import { JsonEditor } from './JsonEditor';
import { SchemaEditor } from './SchemaEditor';
import { KeyValueEditor } from './KeyValueEditor';
import { VariableTooltip } from './VariableTooltip';
import {
  GENERIC_JSON_SCHEMA,
  M30_PRODUCT_SCHEMA,
  PREPARATION_WAVE_STATUS_SCHEMA,
} from '../utils/jsonSchemas';

interface RequestBuilderProps {
  request: HttpRequest;
  onChange: (request: HttpRequest) => void;
  onSend: () => void;
  onError: (message: string) => void;
  onSaveRequest: () => void;
  loading: boolean;
  environments: Environment[];
  activeEnvId: string | null;
  globalVariables: KeyValuePair[];
  collections: Collection[];
  onMethodChange: (newMethod: string) => void;
  onUpdateVariable?: (key: string, value: string, scope: 'global' | 'env') => void;
  onRunPreRequest?: () => Promise<ScriptExecutionResult | null>;
  onRunTest?: () => Promise<ScriptExecutionResult | null>;
  lastScriptResult?: ScriptExecutionResult | null;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const BODY_TYPES = [
  { value: 'none', label: 'none' },
  { value: 'form-data', label: 'form-data' },
  { value: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
  { value: 'raw', label: 'raw' },
  { value: 'json', label: 'JSON' },
  { value: 'binary', label: 'binary' },
  { value: 'graphql', label: 'GraphQL' },
] as const;

const AUTH_TYPES = [
  { value: 'noauth', label: 'No Auth', icon: <Lock size={14} /> },
  { value: 'bearer', label: 'Bearer Token', icon: <Key size={14} /> },
  { value: 'basic', label: 'Basic Auth', icon: <User size={14} /> },
  { value: 'apikey', label: 'API Key', icon: <Key size={14} /> },
  { value: 'oauth2', label: 'OAuth 2.0', icon: <RefreshCw size={14} /> },
] as const;

export const RequestBuilder: React.FC<RequestBuilderProps> = ({
  request,
  onChange,
  onSend,
  onError,
  onSaveRequest,
  loading,
  environments,
  activeEnvId,
  globalVariables,
  collections,
  onMethodChange,
  onUpdateVariable,
  onRunPreRequest,
  onRunTest,
  lastScriptResult,
}) => {
  const [activeTab, setActiveTab] = useState<'docs' | 'params' | 'authorization' | 'headers' | 'body' | 'scripts' | 'settings'>('body');
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const [jsonFormat, setJsonFormat] = useState<'JSON' | 'XML' | 'Text'>('JSON');
  const [bodySchema, setBodySchema] = useState<string>('');
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
  const [runningScript, setRunningScript] = useState<'preRequest' | 'test' | null>(null);
  const [showScriptResults, setShowScriptResults] = useState(false);

  const activeEnv = environments.find(e => e.id === activeEnvId);
  const envVariables = activeEnv?.variables || [];

  const allVariables = useMemo(() => {
    return [...globalVariables.filter(g => g.enabled), ...envVariables.filter(e => e.enabled)];
  }, [globalVariables, envVariables]);

  const usedVariables = useMemo(() => {
    const allTexts = [
      request.url,
      ...request.headers.map(h => `${h.key}=${h.value}`),
      ...request.queryParams.map(p => `${p.key}=${p.value}`),
      request.body.content,
    ];
    const vars = new Set<string>();
    allTexts.forEach(text => {
      findVariablesInText(text).forEach(v => vars.add(v));
    });
    return Array.from(vars);
  }, [request]);

  const variableStatus = useMemo(() => {
    return usedVariables.map(name => ({
      name,
      ...isVariableResolved(name, allVariables),
    }));
  }, [usedVariables, allVariables]);

  /**
   * Определяет JSON Schema для автодополнения на основе URL и имени запроса.
   * Меняйте логику под свои задачи.
   */
  const activeJsonSchema = useMemo(() => {
    const url = request.url.toLowerCase();
    const name = request.name.toLowerCase();

    // M30 — Products (создание/редактирование товара)
    if (
      url.includes('/services/goa/products') ||
      url.includes('/m30/') ||
      name.includes('products') ||
      name.includes('продукт') ||
      name.includes('товар')
    ) {
      return M30_PRODUCT_SCHEMA;
    }

    // Preparation Waves — изменение статуса заказа
    if (
      url.includes('/supplies/') ||
      url.includes('preparation-waves') ||
      name.includes('status') ||
      name.includes('статус')
    ) {
      return PREPARATION_WAVE_STATUS_SCHEMA;
    }

    // По умолчанию — универсальная схема
    return GENERIC_JSON_SCHEMA;
  }, [request.url, request.name]);

  const handleVariableClick = useCallback((varName: string) => {
    setSelectedVariable(varName);
  }, []);

  const handleVariableUpdate = useCallback((key: string, value: string, scope: 'global' | 'env') => {
    if (onUpdateVariable) {
      onUpdateVariable(key, value, scope);
    }
  }, [onUpdateVariable]);

  const updateKeyValuePair = useCallback(<K extends keyof KeyValuePair>(
    field: 'headers' | 'queryParams',
    id: string,
    key: K,
    value: KeyValuePair[K]
  ) => {
    const updated = request[field].map(item =>
      item.id === id ? { ...item, [key]: value } : item
    );
    onChange({ ...request, [field]: updated });
  }, [request, onChange]);

  const addKeyValuePair = useCallback((field: 'headers' | 'queryParams') => {
    const newItem: KeyValuePair = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      key: '',
      value: '',
      enabled: true,
    };
    onChange({ ...request, [field]: [...request[field], newItem] });
  }, [request, onChange]);

  const removeKeyValuePair = useCallback((field: 'headers' | 'queryParams', id: string) => {
    const updated = request[field].filter(item => item.id !== id);
    onChange({ ...request, [field]: updated });
  }, [request, onChange]);

  const updateBody = useCallback((body: RequestBody) => {
    const newBody = { ...request.body, ...body };

    if ((body.type === 'form-data' || body.type === 'x-www-form-urlencoded') &&
      !body.form && request.body.content) {
      try {
        const parsed = JSON.parse(request.body.content);
        if (typeof parsed === 'object' && parsed !== null) {
          newBody.form = Object.entries(parsed).map(([key, value]) => ({
            id: Math.random().toString(36).substring(2) + Date.now().toString(36),
            key,
            value: String(value),
            enabled: true,
          }));
        }
      } catch {
        // Если не JSON — оставляем form пустым
      }
    }

    if ((body.type === 'raw' || body.type === 'json' || body.type === 'graphql') &&
      request.body.form && request.body.form.length > 0 && !body.content) {
      const obj: Record<string, string> = {};
      request.body.form.forEach(f => {
        if (f.enabled && f.key) obj[f.key] = f.value;
      });
      newBody.content = JSON.stringify(obj, null, 2);
    }

    onChange({ ...request, body: newBody });
  }, [request, onChange]);

  const handleBeautify = useCallback(() => {
    if ((request.body.type === 'raw' || request.body.type === 'json') && jsonFormat === 'JSON' && request.body.content) {
      try {
        const parsed = JSON.parse(request.body.content);
        const formatted = JSON.stringify(parsed, null, 2);
        updateBody({ ...request.body, content: formatted });
      } catch (e: any) {
        onError('Неверный формат JSON: ' + e.message);
      }
    }
  }, [request.body, jsonFormat, updateBody, onError]);

  const handleMethodSelect = useCallback((newMethod: string) => {
    if (newMethod === request.method) return;
    onMethodChange(newMethod);
  }, [request.method, onMethodChange]);

  const updateAuth = useCallback((patch: Partial<RequestAuth>) => {
    onChange({
      ...request,
      auth: { ...(request.auth || {}), ...patch } as RequestAuth,
    });
  }, [request, onChange]);

  const handleAuthTypeChange = useCallback((newType: RequestAuth['type']) => {
    updateAuth({ type: newType });
  }, [updateAuth]);

  const currentCollection = useMemo(() =>
    collections.find(c => c.requests.some(r => r.id === request.id)),
    [collections, request.id]
  );

  const currentAuth = request.auth || { type: 'noauth' };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }, [onSend]);

  const handleDocumentationChange = useCallback((value: string) => {
    onChange({ ...request, documentation: value });
  }, [request, onChange]);

  const handleScriptChange = useCallback((type: 'preRequest' | 'test', value: string) => {
    onChange({
      ...request,
      scripts: {
        ...(request.scripts || {}),
        [type]: value,
      },
    });
  }, [request, onChange]);

  const handleRunPreRequest = useCallback(async () => {
    if (!onRunPreRequest) return;
    setRunningScript('preRequest');
    try {
      const result = await onRunPreRequest();
      if (result) {
        setShowScriptResults(true);
      }
    } finally {
      setRunningScript(null);
    }
  }, [onRunPreRequest]);

  const handleRunTest = useCallback(async () => {
    if (!onRunTest) return;
    setRunningScript('test');
    try {
      const result = await onRunTest();
      if (result) {
        setShowScriptResults(true);
      }
    } finally {
      setRunningScript(null);
    }
  }, [onRunTest]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top Bar */}
      <div className="h-[40px] flex items-center justify-between px-4 bg-[#1e1e1e] border-b border-[rgba(255,255,255,0.08)] shrink-0">
        <div className="flex items-center gap-2 text-sm">
          {currentCollection ? (
            <>
              <span className="text-gray-500">{currentCollection.name}</span>
              <span className="text-gray-600">›</span>
              <span className="text-gray-200 font-medium">{request.name}</span>
            </>
          ) : (
            <span className="text-gray-500">New Request</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSaveRequest}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg text-sm transition-all"
            aria-label="Save request to collection"
            title="Сохранить запрос в коллекцию"
          >
            <Save size={14} />
            <span>Save</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-all text-gray-300">
            <Share2 size={14} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* URL Bar */}
      <div className="h-[44px] flex gap-2 px-4 bg-[#252525] border-b border-[rgba(255,255,255,0.08)] shrink-0 items-center">
        <select
          value={request.method}
          onChange={(e) => handleMethodSelect(e.target.value)}
          className={`h-[32px] px-3 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg font-bold text-sm ${getMethodColor(request.method)} cursor-pointer hover:border-[rgba(255,255,255,0.15)] transition-all focus:outline-none focus:border-gray-500`}
        >
          {HTTP_METHODS.map(method => (
            <option key={method} value={method} className="bg-[#1e1e1e] text-gray-300">{method}</option>
          ))}
        </select>
        <input
          type="text"
          value={request.url}
          onChange={(e) => onChange({ ...request, url: e.target.value })}
          placeholder="https://api.example.com/endpoint или {{base_url}}/endpoint"
          className="flex-1 h-[32px] px-3 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 font-mono text-sm text-gray-300 transition-all placeholder:text-gray-600"
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={onSend}
          disabled={loading}
          className="h-[32px] px-4 bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 rounded-lg text-sm transition-all text-white flex items-center gap-1.5 font-medium disabled:opacity-50 shadow-lg shadow-blue-500/30 border border-blue-400/30 active:translate-y-0.5"
          aria-label="Send request"
        >
          <Send size={14} />
          <span>{loading ? '...' : 'Send'}</span>
        </button>
      </div>

      {/* Variable Status Bar */}
      {variableStatus.length > 0 && (
        <div className="h-[24px] px-4 bg-[#1e1e1e] border-b border-[rgba(255,255,255,0.08)] flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[9px] text-gray-500 whitespace-nowrap">Переменные:</span>
          {variableStatus.map(v => (
            <button
              key={v.name}
              onClick={() => handleVariableClick(v.name)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap transition-all hover:scale-105 ${v.resolved
                  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                }`}
              title={v.resolved ? `Значение: ${v.value} (клик для редактирования)` : 'Не определена (клик для добавления)'}
            >
              {v.resolved ? <CheckCircle size={8} /> : <AlertCircle size={8} />}
              {`{{${v.name}}}`}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="h-[26px] flex items-center gap-0 px-1 border-b border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] shrink-0">
        {(['docs', 'params', 'authorization', 'headers', 'body', 'scripts', 'settings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2 py-0.5 font-medium transition-all text-[11px] rounded ${activeTab === tab
                ? 'text-gray-200 bg-gray-500/20'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
          >
            {tab === 'docs' && <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-500"></span>Docs</span>}
            {tab === 'params' && 'Params'}
            {tab === 'authorization' && 'Authorization'}
            {tab === 'headers' && `Headers (${request.headers.length})`}
            {tab === 'body' && 'Body'}
            {tab === 'scripts' && <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-500"></span>Scripts</span>}
            {tab === 'settings' && 'Settings'}
          </button>
        ))}
        <div className="ml-auto">
          <button className="px-2 py-0.5 text-[11px] text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded transition-all">Cookies</button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {activeTab === 'params' && (
          <KeyValueEditor
            items={request.queryParams}
            field="queryParams"
            onUpdate={updateKeyValuePair}
            onAdd={addKeyValuePair}
            onRemove={removeKeyValuePair}
            keyPlaceholder="Parameter"
            valuePlaceholder="Value"
          />
        )}

        {activeTab === 'headers' && (
          <KeyValueEditor
            items={request.headers}
            field="headers"
            onUpdate={updateKeyValuePair}
            onAdd={addKeyValuePair}
            onRemove={removeKeyValuePair}
            keyPlaceholder="Header"
            valuePlaceholder="Value"
          />
        )}

        {activeTab === 'authorization' && (
          <div className="flex flex-col h-full min-h-0">
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Тип авторизации</label>
              <div className="grid grid-cols-5 gap-2">
                {AUTH_TYPES.map(authType => (
                  <button
                    key={authType.value}
                    onClick={() => handleAuthTypeChange(authType.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${currentAuth.type === authType.value
                        ? 'bg-gray-500/20 border-gray-500/40 text-gray-200'
                        : 'bg-[#2d2d2d] border-[rgba(255,255,255,0.08)] text-gray-400 hover:border-[rgba(255,255,255,0.15)] hover:text-gray-300'
                      }`}
                  >
                    {authType.icon}
                    <span className="text-[10px] font-medium text-center">{authType.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {currentAuth.type === 'noauth' && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Lock size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Этот запрос не использует авторизацию</p>
                </div>
              </div>
            )}

            {currentAuth.type === 'bearer' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Token</label>
                  <input
                    type="text"
                    value={currentAuth.token || ''}
                    onChange={(e) => updateAuth({ token: e.target.value })}
                    placeholder="Введите Bearer токен"
                    className="w-full px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 transition-all placeholder:text-gray-600 font-mono"
                  />
                </div>
              </div>
            )}

            {currentAuth.type === 'basic' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    value={currentAuth.username || ''}
                    onChange={(e) => updateAuth({ username: e.target.value })}
                    placeholder="Username"
                    className="w-full px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 transition-all placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Password</label>
                  <input
                    type="password"
                    value={currentAuth.password || ''}
                    onChange={(e) => updateAuth({ password: e.target.value })}
                    placeholder="Password"
                    className="w-full px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 transition-all placeholder:text-gray-600"
                  />
                </div>
              </div>
            )}

            {currentAuth.type === 'apikey' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Key</label>
                  <input
                    type="text"
                    value={currentAuth.apiKey || ''}
                    onChange={(e) => updateAuth({ apiKey: e.target.value })}
                    placeholder="Например: X-API-Key"
                    className="w-full px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 transition-all placeholder:text-gray-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Value</label>
                  <input
                    type="text"
                    value={currentAuth.apiValue || ''}
                    onChange={(e) => updateAuth({ apiValue: e.target.value })}
                    placeholder="Значение API ключа"
                    className="w-full px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 transition-all placeholder:text-gray-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Добавить в</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={currentAuth.addTo === 'header'} onChange={() => updateAuth({ addTo: 'header' })} className="w-3.5 h-3.5" />
                      <span className="text-sm text-gray-300">Header</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={currentAuth.addTo === 'queryParams'} onChange={() => updateAuth({ addTo: 'queryParams' })} className="w-3.5 h-3.5" />
                      <span className="text-sm text-gray-300">Query Params</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {currentAuth.type === 'oauth2' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Grant Type</label>
                  <select
                    value={currentAuth.grantType || 'authorization_code'}
                    onChange={(e) => updateAuth({ grantType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 transition-all"
                  >
                    <option value="authorization_code">Authorization Code</option>
                    <option value="implicit">Implicit</option>
                    <option value="password_credentials">Password Credentials</option>
                    <option value="client_credentials">Client Credentials</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Client ID</label>
                    <input type="text" value={currentAuth.clientId || ''} onChange={(e) => updateAuth({ clientId: e.target.value })} className="w-full px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 text-sm text-gray-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Client Secret</label>
                    <input type="password" value={currentAuth.clientSecret || ''} onChange={(e) => updateAuth({ clientSecret: e.target.value })} className="w-full px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 text-sm text-gray-300" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Access Token</label>
                  <input type="text" value={currentAuth.accessToken || ''} onChange={(e) => updateAuth({ accessToken: e.target.value })} className="w-full px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 text-sm text-gray-300 font-mono" />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'body' && (
          <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center gap-4 pb-2 border-b border-[rgba(255,255,255,0.08)] mb-3 shrink-0">
              {BODY_TYPES.map(type => (
                <label key={type.value} className="flex items-center gap-1.5 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="body-type"
                      checked={request.body.type === type.value}
                      onChange={() => updateBody({ type: type.value } as RequestBody)}
                      className="sr-only"
                    />
                    <div className={`w-3 h-3 rounded-full border-2 transition-all ${request.body.type === type.value ? 'border-gray-300' : 'border-gray-600 group-hover:border-gray-400'
                      }`}>
                      {request.body.type === type.value && (
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  </div>
                  <span className={`text-xs ${request.body.type === type.value ? 'text-gray-200 font-medium' : 'text-gray-400 group-hover:text-gray-300'}`}>
                    {type.label}
                  </span>
                </label>
              ))}
              {(request.body.type === 'raw' || request.body.type === 'json' || request.body.type === 'graphql') && (
                <div className="ml-auto flex items-center gap-2">
                  <select
                    value={jsonFormat}
                    onChange={(e) => setJsonFormat(e.target.value as 'JSON' | 'XML' | 'Text')}
                    className="px-2 py-1 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded text-xs text-gray-300 focus:outline-none focus:border-gray-500"
                  >
                    <option value="JSON">JSON</option>
                    <option value="XML">XML</option>
                    <option value="Text">Text</option>
                  </select>
                  <button
                    onClick={() => setShowSchemaEditor(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded transition-all"
                    title="JSON Schema"
                  >
                    <Database size={11} />
                    Schema
                  </button>
                  <button
                    onClick={handleBeautify}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded transition-all"
                    title="Beautify (Shift+Alt+F в редакторе)"
                  >
                    <Code size={11} />
                    Beautify
                  </button>
                </div>
              )}
            </div>

            {(request.body.type === 'raw' || request.body.type === 'json' || request.body.type === 'graphql') && (
              <div className="flex-1 min-h-0">
                <JsonEditor
                  value={request.body.content}
                  onChange={(content) => updateBody({ ...request.body, content })}
                  placeholder={
                    request.body.type === 'graphql'
                      ? '{\n  "query": "query { ... }"\n}'
                      : '{\n  "key": "value"\n}'
                  }
                  schema={activeJsonSchema}
                  language={request.body.type === 'graphql' ? 'graphql' : 'json'}
                  height="100%"
                />
              </div>
            )}

            {['form-data', 'x-www-form-urlencoded', 'binary', 'none'].includes(request.body.type) && (
              <div className="flex-1">
                <div className="text-gray-500 text-sm text-center py-8">
                  {request.body.type === 'none' ? 'Тело запроса не отправляется' : `${request.body.type} editor (в разработке)`}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="flex flex-col h-full min-h-0 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Документация запроса
              </label>
              <span className="text-[10px] text-gray-500">
                {request.documentation?.length || 0} символов
              </span>
            </div>
            <textarea
              value={request.documentation || ''}
              onChange={(e) => handleDocumentationChange(e.target.value)}
              placeholder="Опишите назначение запроса, параметры, примеры использования..."
              className="flex-1 min-h-[300px] px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 font-mono resize-none leading-relaxed placeholder:text-gray-600"
              spellCheck={false}
            />
          </div>
        )}

        {/* ============ ВКЛАДКА SCRIPTS ============ */}
        {activeTab === 'scripts' && (
          <div className="flex flex-col h-full min-h-0 space-y-4">
            {/* Pre-request Script */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Pre-request Script
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunPreRequest}
                    disabled={runningScript !== null || !request.scripts?.preRequest?.trim()}
                    className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-[10px] font-medium transition-all"
                  >
                    {runningScript === 'preRequest' ? (
                      <>
                        <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play size={10} />
                        Run
                      </>
                    )}
                  </button>
                </div>
              </div>
              <textarea
                value={request.scripts?.preRequest || ''}
                onChange={(e) => handleScriptChange('preRequest', e.target.value)}
                placeholder="// Pre-request script"
                rows={10}
                className="flex-1 min-h-[150px] px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 font-mono resize-none leading-relaxed placeholder:text-gray-600"
                spellCheck={false}
              />
            </div>

            {/* Разделитель */}
            <div className="h-px bg-[rgba(255,255,255,0.08)]"></div>

            {/* Test Script */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Tests
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunTest}
                    disabled={runningScript !== null || !request.scripts?.test?.trim()}
                    className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-[10px] font-medium transition-all"
                  >
                    {runningScript === 'test' ? (
                      <>
                        <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play size={10} />
                        Run
                      </>
                    )}
                  </button>
                </div>
              </div>
              <textarea
                value={request.scripts?.test || ''}
                onChange={(e) => handleScriptChange('test', e.target.value)}
                placeholder="// Test script"
                rows={10}
                className="flex-1 min-h-[150px] px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 font-mono resize-none leading-relaxed placeholder:text-gray-600"
                spellCheck={false}
              />
            </div>

            {/* Результаты последнего выполнения */}
            {lastScriptResult && (
              <div className="border border-[rgba(255,255,255,0.08)] rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowScriptResults(!showScriptResults)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#252525] hover:bg-[#2d2d2d] transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-300">Результаты выполнения</span>
                    {lastScriptResult.testResults.length > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${lastScriptResult.testResults.some((t) => !t.passed)
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                        {lastScriptResult.testResults.filter((t) => t.passed).length}/
                        {lastScriptResult.testResults.length} tests
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {showScriptResults ? 'Свернуть' : 'Развернуть'}
                  </span>
                </button>

                {showScriptResults && (
                  <div className="p-3 space-y-2 bg-[#1e1e1e]">
                    {lastScriptResult.error && (
                      <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded">
                        <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-red-400 font-mono break-all">{lastScriptResult.error}</div>
                      </div>
                    )}

                    {lastScriptResult.skipped && (
                      <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded">
                        <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-400">Запрос пропущен скриптом</div>
                      </div>
                    )}

                    {lastScriptResult.testResults.length > 0 && (
                      <div className="space-y-1">
                        {lastScriptResult.testResults.map((test, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-2 p-2 rounded text-xs ${test.passed
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-red-500/10 text-red-400'
                              }`}
                          >
                            {test.passed ? <CheckCircle size={12} className="shrink-0 mt-0.5" /> : <AlertCircle size={12} className="shrink-0 mt-0.5" />}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{test.name}</div>
                              {test.error && (
                                <div className="text-[10px] opacity-75 font-mono mt-0.5 break-all">{test.error}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {lastScriptResult.logs.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Console Logs</div>
                        {lastScriptResult.logs.map((log, i) => (
                          <div key={i} className="text-[11px] text-gray-300 font-mono bg-[#252525] px-2 py-1 rounded break-all">
                            <span className="text-gray-600 mr-1">[{i + 1}]</span>
                            {log}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="text-gray-500 text-sm text-center py-8">
            <p className="mb-2">⚙️ Settings</p>
            <p>Настройки запроса</p>
          </div>
        )}
      </div>

      {showSchemaEditor && (
        <SchemaEditor
          schema={bodySchema}
          onSave={(s) => { setBodySchema(s); setShowSchemaEditor(false); }}
          onClose={() => setShowSchemaEditor(false)}
          onApplyExample={(ex) => {
            updateBody({ ...request.body, content: ex });
            setShowSchemaEditor(false);
          }}
        />
      )}

      {selectedVariable && (
        <VariableTooltip
          variableName={selectedVariable}
          variable={variableStatus.find(v => v.name === selectedVariable) || { resolved: false, value: '' }}
          globalVariables={globalVariables}
          envVariables={envVariables}
          onUpdate={handleVariableUpdate}
          onClose={() => setSelectedVariable(null)}
        />
      )}
    </div>
  );
};