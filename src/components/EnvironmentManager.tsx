import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Upload, Download, Copy, AlertCircle } from 'lucide-react';
import { Environment, KeyValuePair } from '../types';
import { generateId } from '../utils/helpers';

interface EnvironmentManagerProps {
  environments: Environment[];
  globalVariables: KeyValuePair[];
  activeEnvId: string | null;
  onClose: () => void;
  onSave: (envs: Environment[], globals: KeyValuePair[]) => Promise<void>;
  onImport: (envs: Environment[]) => void;
  onExport: (envs: Environment[], globals: KeyValuePair[]) => void;
}

export const EnvironmentManager: React.FC<EnvironmentManagerProps> = ({
  environments,
  globalVariables,
  activeEnvId,
  onClose,
  onSave,
  onImport,
  onExport,
}) => {
  const [activeTab, setActiveTab] = useState<'environments' | 'globals'>('environments');
  const [envList, setEnvList] = useState<Environment[]>(environments);
  const [globals, setGlobals] = useState<KeyValuePair[]>(globalVariables);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(environments[0]?.id || null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setEnvList(environments);
  }, [environments]);

  useEffect(() => {
    setGlobals(globalVariables);
  }, [globalVariables]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
  };

  const handleSave = useCallback(async () => {
    await onSave(envList, globals);
    showNotification('success', 'Окружения сохранены');
  }, [envList, globals, onSave]);

  const handleCreateEnv = () => {
    const newEnv: Environment = {
      id: generateId(),
      name: `Environment ${envList.length + 1}`,
      variables: [],
    };
    setEnvList([...envList, newEnv]);
    setSelectedEnvId(newEnv.id);
  };

  const handleDeleteEnv = (id: string) => {
    const newEnvs = envList.filter(e => e.id !== id);
    setEnvList(newEnvs);
    if (selectedEnvId === id) {
      setSelectedEnvId(newEnvs[0]?.id || null);
    }
  };

  const handleDuplicateEnv = (env: Environment) => {
    const newEnv: Environment = {
      ...env,
      id: generateId(),
      name: `${env.name} (copy)`,
    };
    setEnvList([...envList, newEnv]);
    setSelectedEnvId(newEnv.id);
  };

  const updateEnvVariable = (envId: string, varId: string, key: keyof KeyValuePair, value: any) => {
    setEnvList(envList.map(env => {
      if (env.id !== envId) return env;
      return {
        ...env,
        variables: env.variables.map(v => v.id === varId ? { ...v, [key]: value } : v),
      };
    }));
  };

  const addEnvVariable = (envId: string) => {
    const newVar: KeyValuePair = { id: generateId(), key: '', value: '', enabled: true };
    setEnvList(envList.map(env => {
      if (env.id !== envId) return env;
      return { ...env, variables: [...env.variables, newVar] };
    }));
  };

  const removeEnvVariable = (envId: string, varId: string) => {
    setEnvList(envList.map(env => {
      if (env.id !== envId) return env;
      return { ...env, variables: env.variables.filter(v => v.id !== varId) };
    }));
  };

  const updateGlobalVariable = (varId: string, key: keyof KeyValuePair, value: any) => {
    setGlobals(globals.map(v => v.id === varId ? { ...v, [key]: value } : v));
  };

  const addGlobalVariable = () => {
    const newVar: KeyValuePair = { id: generateId(), key: '', value: '', enabled: true };
    setGlobals([...globals, newVar]);
  };

  const removeGlobalVariable = (varId: string) => {
    setGlobals(globals.filter(v => v.id !== varId));
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (data.environments && Array.isArray(data.environments)) {
            onImport(data.environments);
            showNotification('success', `Импортировано окружений: ${data.environments.length}`);
          } else {
            throw new Error('Неверный формат файла');
          }
        } catch (err: any) {
          showNotification('error', `Ошибка импорта: ${err.message}`);
        }
      }
    };
    input.click();
  };

  const handleExportClick = () => {
    onExport(envList, globals);
    showNotification('success', 'Окружения экспортированы');
  };

  const selectedEnv = envList.find(e => e.id === selectedEnvId);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="text-xl font-bold text-gray-200">Environment Manager</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-all" aria-label="Close">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex border-b border-[rgba(255,255,255,0.08)]">
          <button
            onClick={() => setActiveTab('environments')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === 'environments'
                ? 'text-gray-200 bg-[#252525] border-b-2 border-indigo-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Environments
          </button>
          <button
            onClick={() => setActiveTab('globals')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === 'globals'
                ? 'text-gray-200 bg-[#252525] border-b-2 border-indigo-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Global Variables
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {activeTab === 'environments' && (
            <>
              <div className="w-64 border-r border-[rgba(255,255,255,0.08)] overflow-y-auto p-3 space-y-1">
                <button
                  onClick={handleCreateEnv}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-all mb-3"
                >
                  <Plus size={14} />
                  Create Environment
                </button>
                {envList.map(env => (
                  <button
                    key={env.id}
                    onClick={() => setSelectedEnvId(env.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all ${
                      selectedEnvId === env.id
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                    }`}
                  >
                    <span className="flex-1 text-left truncate">{env.name}</span>
                    {activeEnvId === env.id && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {selectedEnv ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={selectedEnv.name}
                        onChange={(e) => {
                          setEnvList(envList.map(env =>
                            env.id === selectedEnv.id ? { ...env, name: e.target.value } : env
                          ));
                        }}
                        className="px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-gray-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDuplicateEnv(selectedEnv)}
                          className="p-2 text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-all"
                          aria-label="Duplicate"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteEnv(selectedEnv.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Variables</label>
                      <div className="space-y-2">
                        {selectedEnv.variables.map(variable => (
                          <div key={variable.id} className="flex gap-2 items-center">
                            <input
                              type="checkbox"
                              checked={variable.enabled}
                              onChange={(e) => updateEnvVariable(selectedEnv.id, variable.id, 'enabled', e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-gray-600 text-indigo-500 focus:ring-indigo-500/20"
                            />
                            <input
                              type="text"
                              value={variable.key}
                              onChange={(e) => updateEnvVariable(selectedEnv.id, variable.id, 'key', e.target.value)}
                              placeholder="Key"
                              className="flex-1 px-2.5 py-1.5 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-gray-500"
                            />
                            <input
                              type="text"
                              value={variable.value}
                              onChange={(e) => updateEnvVariable(selectedEnv.id, variable.id, 'value', e.target.value)}
                              placeholder="Value"
                              className="flex-1 px-2.5 py-1.5 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-gray-500"
                            />
                            <button
                              onClick={() => removeEnvVariable(selectedEnv.id, variable.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              aria-label="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addEnvVariable(selectedEnv.id)}
                          className="flex items-center gap-2 px-3 py-1.5 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all text-sm font-medium"
                        >
                          <Plus size={14} />
                          Add Variable
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <AlertCircle size={40} className="mx-auto mb-3 opacity-30" />
                    <p>Select or create an environment</p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'globals' && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {globals.map(variable => (
                  <div key={variable.id} className="flex gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={variable.enabled}
                      onChange={(e) => updateGlobalVariable(variable.id, 'enabled', e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-gray-600 text-indigo-500 focus:ring-indigo-500/20"
                    />
                    <input
                      type="text"
                      value={variable.key}
                      onChange={(e) => updateGlobalVariable(variable.id, 'key', e.target.value)}
                      placeholder="Key"
                      className="flex-1 px-2.5 py-1.5 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-gray-500"
                    />
                    <input
                      type="text"
                      value={variable.value}
                      onChange={(e) => updateGlobalVariable(variable.id, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-2.5 py-1.5 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-gray-500"
                    />
                    <button
                      onClick={() => removeGlobalVariable(variable.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addGlobalVariable}
                  className="flex items-center gap-2 px-3 py-1.5 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all text-sm font-medium"
                >
                  <Plus size={14} />
                  Add Global Variable
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] flex justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={handleImportClick}
              className="flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all"
            >
              <Upload size={16} />
              Import
            </button>
            <button
              onClick={handleExportClick}
              className="flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all"
            >
              <Download size={16} />
              Export
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
            >
              Save Changes
            </button>
          </div>
        </div>

        {notification && (
          <div className={`fixed top-16 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-[100] flex items-center gap-2 ${
            notification.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}>
            <span className="text-sm">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};