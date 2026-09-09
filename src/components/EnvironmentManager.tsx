import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Save, Download, Upload, Copy, Eye, EyeOff } from 'lucide-react';
import { Environment, KeyValuePair } from '../types';
import { generateId } from '../utils/helpers';

interface EnvironmentManagerProps {
  environments: Environment[];
  globalVariables: KeyValuePair[];
  activeEnvId: string | null;
  onClose: () => void;
  onSave: (environments: Environment[], globalVariables: KeyValuePair[]) => void;
  onImport: (environments: Environment[]) => void;
  onExport: (environments: Environment[], globalVariables: KeyValuePair[]) => void;
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
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(environments[0]?.id || null);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [envList, setEnvList] = useState<Environment[]>(environments);
  const [globals, setGlobals] = useState<KeyValuePair[]>(globalVariables);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2000);
  };

  const selectedEnv = envList.find(e => e.id === selectedEnvId);

  const handleCreateEnv = () => {
    const name = prompt('Название окружения:');
    if (name) {
      const newEnv: Environment = {
        id: generateId(),
        name,
        variables: [],
      };
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
      name: `${env.name} (копия)`,
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
    const newVar: KeyValuePair = {
      id: generateId(),
      key: '',
      value: '',
      enabled: true,
    };
    if (target === 'env' && editingEnv) {
      setEditingEnv({
        ...editingEnv,
        variables: [...editingEnv.variables, newVar],
      });
    } else if (target === 'global') {
      setGlobals([...globals, newVar]);
    }
  };

  const handleUpdateVariable = (
    target: 'env' | 'global',
    id: string,
    field: keyof KeyValuePair,
    value: any
  ) => {
    if (target === 'env' && editingEnv) {
      setEditingEnv({
        ...editingEnv,
        variables: editingEnv.variables.map(v =>
          v.id === id ? { ...v, [field]: value } : v
        ),
      });
    } else if (target === 'global') {
      setGlobals(globals.map(v =>
        v.id === id ? { ...v, [field]: value } : v
      ));
    }
  };

  const handleRemoveVariable = (target: 'env' | 'global', id: string) => {
    if (target === 'env' && editingEnv) {
      setEditingEnv({
        ...editingEnv,
        variables: editingEnv.variables.filter(v => v.id !== id),
      });
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
          showNotification(`Импортировано окружений: ${data.environments.length}`);
        } else if (data.type === 'sv-post-globals' && Array.isArray(data.variables)) {
          setGlobals(data.variables);
          onSave(envList, data.variables);
          showNotification('Глобальные переменные импортированы');
        } else {
          showNotification('Неверный формат файла');
        }
      } catch {
        showNotification('Ошибка чтения файла');
      }
    };
    input.click();
  };

  const handleExportEnvironments = () => {
    onExport(envList, globals);
    showNotification('Окружения экспортированы');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-[#252525] border border-[#3d3d3d] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3d3d3d]">
          <h2 className="text-lg font-bold text-primary-500">Менеджер окружений</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded text-sm transition-colors"
              title="Импорт"
            >
              <Upload size={14} />
              Импорт
            </button>
            <button
              onClick={handleExportEnvironments}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded text-sm transition-colors"
              title="Экспорт"
            >
              <Download size={14} />
              Экспорт
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[#3d3d3d] rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#3d3d3d] bg-[#1e1e1e]">
          <button
            onClick={() => setActiveTab('environments')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'environments'
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Окружения ({envList.length})
          </button>
          <button
            onClick={() => setActiveTab('globals')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'globals'
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Глобальные переменные ({globals.filter(g => g.enabled).length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {activeTab === 'environments' && (
            <>
              {/* List */}
              <div className="w-64 border-r border-[#3d3d3d] overflow-y-auto">
                <button
                  onClick={handleCreateEnv}
                  className="w-full flex items-center gap-2 px-3 py-2 text-primary-500 hover:bg-primary-500/10 transition-colors border-b border-[#3d3d3d]"
                >
                  <Plus size={14} />
                  Новое окружение
                </button>
                {envList.map(env => (
                  <div
                    key={env.id}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#2d2d2d] transition-colors ${
                      selectedEnvId === env.id ? 'bg-[#2d2d2d] border-l-2 border-primary-500' : ''
                    }`}
                    onClick={() => {
                      setSelectedEnvId(env.id);
                      setEditingEnv(env);
                    }}
                  >
                    <div className="flex-1 truncate text-sm">
                      {env.name}
                      {activeEnvId === env.id && (
                        <span className="ml-1 text-xs text-green-500">●</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateEnv(env);
                      }}
                      className="p-1 hover:bg-[#3d3d3d] rounded"
                      title="Дублировать"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEnv(env.id);
                      }}
                      className="p-1 hover:bg-red-500/20 rounded text-red-500"
                      title="Удалить"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Editor */}
              <div className="flex-1 overflow-y-auto p-4">
                {editingEnv ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Название</label>
                      <input
                        type="text"
                        value={editingEnv.name}
                        onChange={(e) => setEditingEnv({ ...editingEnv, name: e.target.value })}
                        className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#3d3d3d] rounded focus:outline-none focus:border-primary-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-gray-400">Переменные</label>
                        <button
                          onClick={() => handleAddVariable('env')}
                          className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-400"
                        >
                          <Plus size={12} />
                          Добавить
                        </button>
                      </div>

                      {editingEnv.variables.length === 0 ? (
                        <div className="text-gray-500 text-sm py-4 text-center">
                          Нет переменных. Добавьте первую.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {editingEnv.variables.map(v => (
                            <div key={v.id} className="flex gap-2 items-center">
                              <input
                                type="checkbox"
                                checked={v.enabled}
                                onChange={(e) => handleUpdateVariable('env', v.id, 'enabled', e.target.checked)}
                                className="w-4 h-4"
                              />
                              <input
                                type="text"
                                value={v.key}
                                onChange={(e) => handleUpdateVariable('env', v.id, 'key', e.target.value)}
                                placeholder="Имя переменной"
                                className="flex-1 px-2 py-1.5 bg-[#2d2d2d] border border-[#3d3d3d] rounded text-sm focus:outline-none focus:border-primary-500"
                              />
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  value={v.value}
                                  onChange={(e) => handleUpdateVariable('env', v.id, 'value', e.target.value)}
                                  placeholder="Значение"
                                  className="w-full px-2 py-1.5 bg-[#2d2d2d] border border-[#3d3d3d] rounded text-sm focus:outline-none focus:border-primary-500"
                                />
                              </div>
                              <button
                                onClick={() => handleRemoveVariable('env', v.id)}
                                className="p-1 text-red-500 hover:bg-red-500/20 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleSaveEnv}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
                    >
                      <Save size={14} />
                      Сохранить окружение
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    Выберите окружение слева или создайте новое
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'globals' && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4">
                <p className="text-sm text-gray-400">
                  Глобальные переменные доступны во всех окружениях. Переменные окружения имеют приоритет над глобальными.
                </p>
              </div>

              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">Глобальные переменные</label>
                <button
                  onClick={() => handleAddVariable('global')}
                  className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-400"
                >
                  <Plus size={12} />
                  Добавить
                </button>
              </div>

              {globals.length === 0 ? (
                <div className="text-gray-500 text-sm py-4 text-center">
                  Нет глобальных переменных
                </div>
              ) : (
                <div className="space-y-2">
                  {globals.map(v => (
                    <div key={v.id} className="flex gap-2 items-center">
                      <input
                        type="checkbox"
                        checked={v.enabled}
                        onChange={(e) => handleUpdateVariable('global', v.id, 'enabled', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <input
                        type="text"
                        value={v.key}
                        onChange={(e) => handleUpdateVariable('global', v.id, 'key', e.target.value)}
                        placeholder="Имя переменной"
                        className="flex-1 px-2 py-1.5 bg-[#2d2d2d] border border-[#3d3d3d] rounded text-sm focus:outline-none focus:border-primary-500"
                      />
                      <input
                        type="text"
                        value={v.value}
                        onChange={(e) => handleUpdateVariable('global', v.id, 'value', e.target.value)}
                        placeholder="Значение"
                        className="flex-1 px-2 py-1.5 bg-[#2d2d2d] border border-[#3d3d3d] rounded text-sm focus:outline-none focus:border-primary-500"
                      />
                      <button
                        onClick={() => handleRemoveVariable('global', v.id)}
                        className="p-1 text-red-500 hover:bg-red-500/20 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  onSave(envList, globals);
                  showNotification('Глобальные переменные сохранены');
                }}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
              >
                <Save size={14} />
                Сохранить глобальные переменные
              </button>
            </div>
          )}
        </div>

        {/* Notification */}
        {notification && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-green-600 text-white rounded shadow-lg z-[300] text-sm animate-fade-in">
            {notification}
          </div>
        )}
      </div>
    </div>
  );
};