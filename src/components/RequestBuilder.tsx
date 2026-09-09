import React, { useState, useMemo } from 'react';
import { Send, Plus, Trash2, AlertCircle, CheckCircle, Save, Share2, Code, Database } from 'lucide-react';
import { HttpRequest, KeyValuePair, RequestBody, Environment, Collection } from '../types';
import { generateId, findVariablesInText, isVariableResolved } from '../utils/helpers';
import { JsonEditor } from './JsonEditor';
import { SchemaEditor } from './SchemaEditor';

interface RequestBuilderProps {
  request: HttpRequest;
  onChange: (request: HttpRequest) => void;
  onSend: () => void;
  loading: boolean;
  environments: Environment[];
  activeEnvId: string | null;
  globalVariables: KeyValuePair[];
  collections: Collection[];
  onMethodChange: (newMethod: string) => void; // НОВАЯ ПРОПСА
  tabCount: number; // НОВАЯ ПРОПСА
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-500',
  POST: 'text-yellow-500',
  PUT: 'text-blue-500',
  PATCH: 'text-purple-500',
  DELETE: 'text-red-500',
  HEAD: 'text-gray-500',
  OPTIONS: 'text-orange-500',
};

export const RequestBuilder: React.FC<RequestBuilderProps> = ({
  request,
  onChange,
  onSend,
  loading,
  environments,
  activeEnvId,
  globalVariables,
  collections,
  onMethodChange,
  tabCount,
}) => {
  const [activeTab, setActiveTab] = useState<'docs' | 'params' | 'authorization' | 'headers' | 'body' | 'scripts' | 'settings'>('body');
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const [jsonFormat, setJsonFormat] = useState<'JSON' | 'XML' | 'Text'>('JSON');
  const [bodySchema, setBodySchema] = useState<string>('');

  const activeEnv = environments.find(e => e.id === activeEnvId);
  const envVariables = activeEnv?.variables || [];

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
    return usedVariables.map(name => {
      const status = isVariableResolved(name, envVariables, globalVariables);
      return { name, ...status };
    });
  }, [usedVariables, envVariables, globalVariables]);

  const updateKeyValuePair = (
    field: 'headers' | 'queryParams',
    id: string,
    key: keyof KeyValuePair,
    value: any
  ) => {
    const updated = request[field].map(item =>
      item.id === id ? { ...item, [key]: value } : item
    );
    onChange({ ...request, [field]: updated });
  };

  const addKeyValuePair = (field: 'headers' | 'queryParams') => {
    const newItem: KeyValuePair = {
      id: generateId(),
      key: '',
      value: '',
      enabled: true,
    };
    onChange({ ...request, [field]: [...request[field], newItem] });
  };

  const removeKeyValuePair = (field: 'headers' | 'queryParams', id: string) => {
    const updated = request[field].filter(item => item.id !== id);
    onChange({ ...request, [field]: updated });
  };

  const updateBody = (body: RequestBody) => {
    onChange({ ...request, body });
  };

  const handleBeautify = () => {
    if (request.body.type === 'raw' && jsonFormat === 'JSON') {
      try {
        const parsed = JSON.parse(request.body.content);
        const formatted = JSON.stringify(parsed, null, 2);
        updateBody({ ...request.body, content: formatted });
      } catch (e) {
        console.error('Invalid JSON');
      }
    }
  };

  const handleApplyExample = (example: string) => {
    updateBody({ ...request.body, content: example });
    setShowSchemaEditor(false);
  };

  const handleSaveSchema = (schema: string) => {
    setBodySchema(schema);
  };

  // НОВАЯ ФУНКЦИЯ: обработка смены метода
  const handleMethodSelect = (newMethod: string) => {
    // Если метод не изменился - ничего не делаем
    if (newMethod === request.method) return;
    
    // Создаем новую вкладку с выбранным методом
    onMethodChange(newMethod);
  };

  const currentCollection = collections.find(c => 
    c.requests.some(r => r.id === request.id)
  );

  const bodyTypes = [
    { value: 'none', label: 'none' },
    { value: 'form-data', label: 'form-data' },
    { value: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
    { value: 'raw', label: 'raw' },
    { value: 'binary', label: 'binary' },
    { value: 'graphql', label: 'GraphQL' },
  ] as const;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top Bar - Collection name, Save, Share */}
      <div className="h-[40px] flex items-center justify-between px-4 bg-[#1e1e1e] border-b border-[#3d3d3d] shrink-0">
        <div className="flex items-center gap-2 text-sm">
          {currentCollection ? (
            <>
              <span className="text-gray-400">{currentCollection.name}</span>
              <span className="text-gray-600">›</span>
              <span className="text-gray-200 font-medium">{request.name}</span>
            </>
          ) : (
            <span className="text-gray-400">New Request</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-300 hover:bg-[#2d2d2d] rounded text-sm transition-colors"
            title="Save request"
          >
            <Save size={14} />
            <span>Save</span>
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded text-sm transition-colors"
            title="Share"
          >
            <Share2 size={14} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* URL Bar - 44px */}
      <div className="h-[44px] flex gap-2 px-4 bg-[#252525] border-b border-[#3d3d3d] shrink-0">
        <select
          value={request.method}
          onChange={(e) => handleMethodSelect(e.target.value)}
          className={`px-3 py-1.5 bg-[#2d2d2d] border border-[#3d3d3d] rounded font-bold text-sm ${METHOD_COLORS[request.method]}`}
          title={tabCount >= 10 ? 'Достигнут лимит в 10 вкладок' : 'Смена метода создаст новую вкладку'}
        >
          {HTTP_METHODS.map(method => (
            <option key={method} value={method}>{method}</option>
          ))}
        </select>
        <input
          type="text"
          value={request.url}
          onChange={(e) => onChange({ ...request, url: e.target.value })}
          placeholder="https://api.example.com/endpoint или {{base_url}}/endpoint"
          className="flex-1 px-3 py-1.5 bg-[#2d2d2d] border border-[#3d3d3d] rounded focus:outline-none focus:border-primary-500 font-mono text-sm"
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
        />
        <button
          onClick={onSend}
          disabled={loading}
          className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 text-white rounded font-medium flex items-center gap-2 transition-colors text-sm"
        >
          <Send size={14} />
          {loading ? '...' : 'Send'}
        </button>
      </div>

      {/* Tabs - 36px */}
      <div className="h-[36px] flex items-center gap-1 px-4 border-b border-[#3d3d3d] bg-[#252525] shrink-0">
        {(['docs', 'params', 'authorization', 'headers', 'body', 'scripts', 'settings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 font-medium transition-colors text-xs rounded ${
              activeTab === tab
                ? 'text-primary-500 bg-primary-500/10'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#2d2d2d]'
            }`}
          >
            {tab === 'docs' && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Docs
              </span>
            )}
            {tab === 'params' && 'Params'}
            {tab === 'authorization' && 'Authorization'}
            {tab === 'headers' && `Headers (${request.headers.length})`}
            {tab === 'body' && 'Body'}
            {tab === 'scripts' && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Scripts
              </span>
            )}
            {tab === 'settings' && 'Settings'}
          </button>
        ))}
        
        <div className="ml-auto flex items-center gap-2">
          <button className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Cookies
          </button>
        </div>
      </div>

      {/* Variable Status Bar - 28px */}
      {variableStatus.length > 0 && activeTab === 'body' && (
        <div className="h-[28px] px-4 bg-[#1e1e1e] border-b border-[#3d3d3d] flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[11px] text-gray-500 whitespace-nowrap">Переменные:</span>
          {variableStatus.map(v => (
            <span
              key={v.name}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] whitespace-nowrap ${
                v.resolved
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-red-500/10 text-red-500'
              }`}
              title={v.resolved ? `Значение: ${v.value}` : 'Переменная не определена'}
            >
              {v.resolved ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
              {`{{${v.name}}}`}
            </span>
          ))}
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {activeTab === 'docs' && (
          <div className="text-gray-400 text-sm text-center py-8">
            <p className="mb-2">📚 Documentation</p>
            <p>Добавьте документацию к вашему запросу</p>
          </div>
        )}

        {activeTab === 'params' && (
          <KeyValueEditor
            items={request.queryParams}
            onUpdate={(id, key, value) => updateKeyValuePair('queryParams', id, key, value)}
            onAdd={() => addKeyValuePair('queryParams')}
            onRemove={(id) => removeKeyValuePair('queryParams', id)}
            keyPlaceholder="Parameter name"
            valuePlaceholder="Value"
          />
        )}

        {activeTab === 'authorization' && (
          <AuthEditor request={request} onChange={onChange} />
        )}

        {activeTab === 'headers' && (
          <KeyValueEditor
            items={request.headers}
            onUpdate={(id, key, value) => updateKeyValuePair('headers', id, key, value)}
            onAdd={() => addKeyValuePair('headers')}
            onRemove={(id) => removeKeyValuePair('headers', id)}
            keyPlaceholder="Header name"
            valuePlaceholder="Value"
          />
        )}

        {activeTab === 'body' && (
          <div className="flex flex-col h-full min-h-0">
            {/* Radio buttons для выбора типа body */}
            <div className="flex items-center gap-5 pb-3 border-b border-[#3d3d3d] mb-3 shrink-0">
              {bodyTypes.map(type => (
                <label key={type.value} className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="body-type"
                      checked={request.body.type === type.value}
                      onChange={() => updateBody({ ...request.body, type: type.value })}
                      className="sr-only"
                    />
                    <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                      request.body.type === type.value
                        ? 'border-primary-500'
                        : 'border-gray-500 group-hover:border-gray-400'
                    }`}>
                      {request.body.type === type.value && (
                        <div className="w-2 h-2 rounded-full bg-primary-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  </div>
                  <span className={`text-sm ${
                    request.body.type === type.value ? 'text-gray-200 font-medium' : 'text-gray-400 group-hover:text-gray-300'
                  }`}>
                    {type.label}
                  </span>
                </label>
              ))}
            </div>

            {/* JSON/Raw Editor с подсветкой и toolbar */}
            {(request.body.type === 'raw' || request.body.type === 'graphql') && (
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Toolbar с форматом и кнопками */}
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <select
                      value={jsonFormat}
                      onChange={(e) => setJsonFormat(e.target.value as any)}
                      className="px-2 py-1 bg-[#2d2d2d] border border-[#3d3d3d] rounded text-xs text-primary-500 focus:outline-none"
                    >
                      <option value="JSON">JSON</option>
                      <option value="XML">XML</option>
                      <option value="Text">Text</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSchemaEditor(true)}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                      title="JSON Schema"
                    >
                      <Database size={12} />
                      Schema
                    </button>
                    <button
                      onClick={handleBeautify}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-primary-500 hover:text-primary-400 transition-colors"
                      title="Beautify (format)"
                    >
                      <Code size={12} />
                      Beautify
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 min-h-0">
                  <JsonEditor
                    value={request.body.content}
                    onChange={(content) => updateBody({ ...request.body, content })}
                    placeholder={request.body.type === 'graphql' ? '{\n  "query": "query { ... }"\n}' : '{\n  "key": "value"\n}'}
                  />
                </div>
              </div>
            )}

            {/* Form-data, x-www-form-urlencoded, binary, none */}
            {['form-data', 'x-www-form-urlencoded', 'binary', 'none'].includes(request.body.type) && (
              <div className="flex-1">
                <div className="text-gray-400 text-sm text-center py-8">
                  {request.body.type === 'none' ? 'Тело запроса не отправляется' : `${request.body.type} editor (в разработке)`}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'scripts' && (
          <div className="text-gray-400 text-sm text-center py-8">
            <p className="mb-2">💻 Pre-request Scripts & Tests</p>
            <p>Добавьте скрипты для автоматизации тестирования</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="text-gray-400 text-sm text-center py-8">
            <p className="mb-2">️ Settings</p>
            <p>Настройки запроса</p>
          </div>
        )}
      </div>

      {/* Schema Editor Modal */}
      {showSchemaEditor && (
        <SchemaEditor
          schema={bodySchema}
          onSave={handleSaveSchema}
          onClose={() => setShowSchemaEditor(false)}
          bodyContent={request.body.content}
          onApplyExample={handleApplyExample}
        />
      )}
    </div>
  );
};

interface KeyValueEditorProps {
  items: KeyValuePair[];
  onUpdate: (id: string, key: keyof KeyValuePair, value: any) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}

const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  items,
  onUpdate,
  onAdd,
  onRemove,
  keyPlaceholder,
  valuePlaceholder,
}) => {
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => onUpdate(item.id, 'enabled', e.target.checked)}
            className="w-3.5 h-3.5"
          />
          <input
            type="text"
            value={item.key}
            onChange={(e) => onUpdate(item.id, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="flex-1 px-2.5 py-1.5 bg-[#2d2d2d] border border-[#3d3d3d] rounded focus:outline-none focus:border-primary-500 text-sm"
          />
          <input
            type="text"
            value={item.value}
            onChange={(e) => onUpdate(item.id, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1 px-2.5 py-1.5 bg-[#2d2d2d] border border-[#3d3d3d] rounded focus:outline-none focus:border-primary-500 text-sm"
          />
          <button
            onClick={() => onRemove(item.id)}
            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-3 py-1.5 text-primary-500 hover:bg-primary-500/10 rounded transition-colors text-sm"
      >
        <Plus size={14} />
        Добавить
      </button>
    </div>
  );
};

interface AuthEditorProps {
  request: HttpRequest;
  onChange: (request: HttpRequest) => void;
}

const AuthEditor: React.FC<AuthEditorProps> = ({ request, onChange }) => {
  const auth = request.auth || { type: 'none' };

  const updateAuth = (newAuth: typeof auth) => {
    onChange({ ...request, auth: newAuth });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {(['none', 'bearer', 'basic'] as const).map(type => (
          <label key={type} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={auth.type === type}
              onChange={() => updateAuth({ ...auth, type })}
              className="w-3.5 h-3.5"
            />
            <span className="text-sm">{type}</span>
          </label>
        ))}
      </div>

      {auth.type === 'bearer' && (
        <input
          type="text"
          value={auth.token || ''}
          onChange={(e) => updateAuth({ ...auth, token: e.target.value })}
          placeholder="Bearer token"
          className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3d3d3d] rounded focus:outline-none focus:border-primary-500 text-sm"
        />
      )}

      {auth.type === 'basic' && (
        <div className="space-y-2">
          <input
            type="text"
            value={auth.username || ''}
            onChange={(e) => updateAuth({ ...auth, username: e.target.value })}
            placeholder="Username"
            className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3d3d3d] rounded focus:outline-none focus:border-primary-500 text-sm"
          />
          <input
            type="password"
            value={auth.password || ''}
            onChange={(e) => updateAuth({ ...auth, password: e.target.value })}
            placeholder="Password"
            className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3d3d3d] rounded focus:outline-none focus:border-primary-500 text-sm"
          />
        </div>
      )}
    </div>
  );
};