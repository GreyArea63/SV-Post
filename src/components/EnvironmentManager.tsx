import React, { useState } from 'react';
import { X, Plus, Trash2, Save, Download, Upload, Copy, Globe, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { Environment, KeyValuePair, Collection } from '../types';
import { generateId } from '../utils/helpers';

interface EnvironmentManagerProps {
  environments: Environment[];
  globalVariables: KeyValuePair[];
  activeEnvId: string | null;
  collections: Collection[];
  onClose: () => void;
  onSave: (environments: Environment[], globalVariables: KeyValuePair[]) => void;
  onImport: (environments: Environment[]) => void;
  onExport: (environments: Environment[], globalVariables: KeyValuePair[]) => void;
}

export const EnvironmentManager: React.FC<EnvironmentManagerProps> = ({
  environments, globalVariables, activeEnvId, collections, onClose, onSave, onImport, onExport,
}) => {
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(environments[0]?.id || null);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(environments[0] || null);
  const [envList, setEnvList] = useState<Environment[]>(environments);
  const [globals, setGlobals] = useState<KeyValuePair[]>(globalVariables);
  const [activeTab, setActiveTab] = useState<'environments' | 'globals' | 'vault'>('environments');
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2000);
  };

  const handleCreateEnv = () => {
    const name = prompt('Название окружения:');
    if (name) {
      const newEnv: Environment = { id: generateId(), name, variables: [] };
      const updated = [...envList, newEnv];
      setEnvList(updated);
      setSelectedEnvId(newEnv.id);
      setEditingEnv(newEnv);
    }
  };

  const handleDeleteEnv = (id: string) => {
    if (!confirm('Удалить это окружение?')) return;
    const updated = envList.filter(e => e.id !== id);
    setEnvList(updated);
    if (selectedEnvId === id) {
      setSelectedEnvId(updated[0]?.id || null);
      setEditingEnv(updated[0] || null);
    }
  };

  const handleDuplicateEnv = (env: Environment) => {
    const newEnv: Environment = {
      id: generateId(),
      name: `${env.name} (copy)`,
      variables: env.variables.map(v => ({ ...v, id: generateId() })),
    };
    const updated = [...envList, newEnv];
    setEnvList(updated);
    setSelectedEnvId(newEnv.id);
    setEditingEnv(newEnv);
  };

  const handleSaveEnv = () => {
    if (!editingEnv) return;
    const updated = envList.map(e => e.id === editingEnv.id ? editingEnv : e);
    setEnvList(updated);
    onSave(updated, globals);
    showNotification('Окружение сохранено');
  };

  const handleAddVariable = (target: 'env' | 'global') => {
    const newVar: KeyValuePair = { id: generateId(), key: '', value: '', enabled: true };
    if (target === 'env' && editingEnv) {
      setEditingEnv({ ...editingEnv, variables: [...editingEnv.variables, newVar] });
    } else if (target === 'global') {
      setGlobals([...globals, newVar]);
    }
  };

  const handleUpdateVariable = (target: 'env' | 'global', id: string, field: keyof KeyValuePair, value: any) => {
    if (target === 'env' && editingEnv) {
      setEditingEnv({ ...editingEnv, variables: editingEnv.variables.map(v => v.id === id ? { ...v, [field]: value } : v) });
    } else if (target === 'global') {
      setGlobals(globals.map(v => v.id === id ? { ...v, [field]: value } : v));
    }
  };

  const handleRemoveVariable = (target: 'env' | 'global', id: string) => {
    if (target === 'env' && editingEnv) {
      setEditingEnv({ ...editingEnv, variables: editingEnv.variables.filter(v => v.id !== id) });
    } else if (target === 'global') {
      setGlobals(globals.filter(v => v.id !== id));
    }
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.type === 'sv-post-environments' && Array.isArray(data.environments)) {
          onImport(data.environments);
          setEnvList([...envList, ...data.environments]);
          showNotification(`Импортировано: ${data.environments.length}`);
        } else if (Array.isArray(data)) {
          onImport(data);
          setEnvList([...envList, ...data]);
          showNotification(`Импортировано: ${data.length}`);
        }
      } catch { showNotification('Ошибка чтения файла'); }
    };
    input.click();
  };

  const handleExportAll = () => {
    onExport(envList, globals);
    showNotification('Окружения экспортированы');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-[#1a1a23] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Globe size={16} className="text-white" />
            </div>
            Менеджер окружений
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={handleImportClick} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-[rgba(255,255,255,0.08)] rounded-lg text-sm transition-all">
              <Upload size={14} /> Импорт
            </button>
            <button onClick={handleExportAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-[rgba(255,255,255,0.08)] rounded-lg text-sm transition-all">
              <Download size={14} /> Экспорт
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[rgba(255,255,255,0.08)] bg-[#1a1a23] px-4">
          {[
            { id: 'environments', label: 'Окружения', icon: <Globe size={14} />, count: envList.length },
            { id: 'globals', label: 'Глобальные', icon: <Globe size={14} />, count: globals.filter(g => g.enabled).length },
            { id: 'vault', label: 'Vault', icon: <Lock size={14} />, count: 0 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-indigo-400 border-indigo-500 bg-indigo-500/5'
                  : 'text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel */}
          <div className="w-1/2 border-r border-[rgba(255,255,255,0.08)] flex flex-col">
            <div className="p-4 border-b border-[rgba(255,255,255,0.08)]">
              {activeTab === 'environments' && (
                <button onClick={handleCreateEnv} className="w-full flex items-center justify-center gap-2 px-3 py-2 gradient-btn text-white rounded-lg text-sm font-medium">
                  <Plus size={14} /> Новое окружение
                </button>
              )}
              {activeTab === 'globals' && (
                <button onClick={() => handleAddVariable('global')} className="w-full flex items-center justify-center gap-2 px-3 py-2 gradient-btn text-white rounded-lg text-sm font-medium">
                  <Plus size={14} /> Добавить переменную
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto p-4">
              {activeTab === 'environments' && editingEnv && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="text"
                      value={editingEnv.name}
                      onChange={(e) => setEditingEnv({ ...editingEnv, name: e.target.value })}
                      className="flex-1 px-3 py-2 bg-[#252532] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    <button onClick={() => handleDuplicateEnv(editingEnv)} className="p-2 hover:bg-white/5 rounded-lg transition-all" title="Дублировать">
                      <Copy size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => handleDeleteEnv(editingEnv.id)} className="p-2 hover:bg-red-500/10 rounded-lg transition-all" title="Удалить">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {editingEnv.variables.map(v => (
                      <div key={v.id} className="flex items-center gap-2 group">
                        <button
                          onClick={() => handleUpdateVariable('env', v.id, 'enabled', !v.enabled)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                            v.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'
                          }`}
                        >
                          {v.enabled ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        </button>
                        <input
                          type="text"
                          value={v.key}
                          onChange={(e) => handleUpdateVariable('env', v.id, 'key', e.target.value)}
                          placeholder="key"
                          className="flex-1 px-2.5 py-1.5 bg-[#252532] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                        <input
                          type="text"
                          value={v.value}
                          onChange={(e) => handleUpdateVariable('env', v.id, 'value', e.target.value)}
                          placeholder="value"
                          className="flex-1 px-2.5 py-1.5 bg-[#252532] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                        <button onClick={() => handleRemoveVariable('env', v.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => handleAddVariable('env')} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg text-sm font-medium transition-all">
                      <Plus size={14} /> Добавить переменную
                    </button>
                  </div>

                  <button onClick={handleSaveEnv} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 gradient-btn text-white rounded-lg font-medium">
                    <Save size={14} /> Сохранить изменения
                  </button>
                </div>
              )}

              {activeTab === 'environments' && !editingEnv && (
                <div className="space-y-2">
                  {envList.map(env => (
                    <button
                      key={env.id}
                      onClick={() => { setSelectedEnvId(env.id); setEditingEnv(env); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                        selectedEnvId === env.id
                          ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400'
                          : 'hover:bg-white/5 border border-transparent text-gray-300'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${activeEnvId === env.id ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                      <span className="flex-1 font-medium">{env.name}</span>
                      <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                        {env.variables.filter(v => v.enabled).length} vars
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'globals' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Globe size={14} className="text-indigo-400" /> Глобальные переменные
                  </h3>
                  <div className="space-y-2">
                    {globals.map(v => (
                      <div key={v.id} className="flex items-center gap-2 group">
                        <button
                          onClick={() => handleUpdateVariable('global', v.id, 'enabled', !v.enabled)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                            v.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'
                          }`}
                        >
                          {v.enabled ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        </button>
                        <input
                          type="text"
                          value={v.key}
                          onChange={(e) => handleUpdateVariable('global', v.id, 'key', e.target.value)}
                          placeholder="key"
                          className="flex-1 px-2.5 py-1.5 bg-[#252532] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                        <input
                          type="text"
                          value={v.value}
                          onChange={(e) => handleUpdateVariable('global', v.id, 'value', e.target.value)}
                          placeholder="value"
                          className="flex-1 px-2.5 py-1.5 bg-[#252532] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                        <button onClick={() => handleRemoveVariable('global', v.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => handleAddVariable('global')} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg text-sm font-medium transition-all">
                      <Plus size={14} /> Добавить переменную
                    </button>
                  </div>
                  <button onClick={() => { onSave(envList, globals); showNotification('Глобальные переменные сохранены'); }} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 gradient-btn text-white rounded-lg font-medium">
                    <Save size={14} /> Сохранить
                  </button>
                </div>
              )}

              {activeTab === 'vault' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <Lock size={32} className="text-orange-400" />
                  </div>
                  <h3 className="text-gray-300 font-medium mb-2">Local Vault</h3>
                  <p className="text-sm text-gray-500 mb-4">Храните API секреты локально в защищённом хранилище</p>
                  <button className="px-4 py-2 gradient-btn text-white rounded-lg text-sm font-medium">
                    Настроить Vault
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Variables Overview */}
          <div className="w-1/2 flex flex-col">
            <div className="p-4 border-b border-[rgba(255,255,255,0.08)] bg-[#1a1a23]">
              <h3 className="text-sm font-medium text-gray-400 mb-1">Переменные в запросе</h3>
              <p className="text-xs text-gray-500">Обзор всех доступных переменных</p>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">E</span>
                  Окружения
                </h4>
                {envList.some(env => env.variables.length > 0) ? (
                  <div className="space-y-1.5">
                    {envList.map(env => env.variables.filter(v => v.enabled).map(v => (
                      <div key={v.id} className="flex items-center justify-between p-2.5 bg-[#252532] rounded-lg border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)] transition-all">
                        <span className="text-sm font-mono text-gray-300">{v.key}</span>
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{env.name}</span>
                      </div>
                    )))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">Нет переменных в окружениях</p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <span className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold">G</span>
                  Глобальные
                </h4>
                {globals.filter(v => v.enabled).length > 0 ? (
                  <div className="space-y-1.5">
                    {globals.filter(v => v.enabled).map(v => (
                      <div key={v.id} className="flex items-center justify-between p-2.5 bg-[#252532] rounded-lg border border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)] transition-all">
                        <span className="text-sm font-mono text-gray-300">{v.key}</span>
                        <Globe size={12} className="text-gray-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">Нет глобальных переменных</p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <Lock size={12} className="text-orange-400" />
                  Local Vault
                </h4>
                <p className="text-xs text-gray-500 italic">Хранилище секретов не настроено</p>
              </div>
            </div>
          </div>
        </div>

        {notification && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 px-4 py-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg shadow-lg z-[300] text-sm animate-fade-in glass">
            {notification}
          </div>
        )}
      </div>
    </div>
  );
};