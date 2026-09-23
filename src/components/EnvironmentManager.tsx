import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Upload,
  Download,
  Copy,
  AlertCircle,
  Save,
  FileJson,
} from 'lucide-react';
import { Environment, KeyValuePair, ConflictAction } from '../types';
import { generateId } from '../utils/helpers';
import {
  detectPostmanFileType,
  convertPostmanEnvToApp,
  convertPostmanGlobalsToApp,
  mergeGlobals,
} from '../utils/helpers';

interface EnvironmentManagerProps {
  environments: Environment[];
  globalVariables: KeyValuePair[];
  activeEnvId: string | null;
  onClose: () => void;
  onSave: (envs: Environment[], globals: KeyValuePair[]) => Promise<void>;
  onImport: (envs: Environment[]) => void;
  onExport: (envs: Environment[], globals: KeyValuePair[]) => void;
}

interface ConflictData {
  newEnv: Environment;
  existing: Environment;
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const isInitialMount = useRef(true);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setEnvList(environments);
    setHasUnsavedChanges(false);
  }, [environments]);

  useEffect(() => {
    setGlobals(globalVariables);
  }, [globalVariables]);

  // ИСПРАВЛЕНИЕ 3.45: clearTimeout для уведомлений
  useEffect(() => {
    if (notification) {
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = setTimeout(() => setNotification(null), 3000);
    }
    return () => {
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, [notification]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
  };

  // ИСПРАВЛЕНИЕ 3.46: onSave async и await перед тостом
  const handleSave = useCallback(async () => {
    try {
      await onSave(envList, globals);
      setHasUnsavedChanges(false);
      showNotification('success', 'Окружения сохранены');
    } catch (err: any) {
      showNotification('error', 'Ошибка сохранения: ' + (err.message || 'неизвестно'));
    }
  }, [envList, globals, onSave]);

  const handleCreateEnv = useCallback(async () => {
    const newEnv: Environment = {
      id: generateId(),
      name: `Environment ${envList.length + 1}`,
      variables: [],
    };
    const newEnvList = [...envList, newEnv];
    setEnvList(newEnvList);
    setSelectedEnvId(newEnv.id);
    setHasUnsavedChanges(true);
    await onSave(newEnvList, globals);
    showNotification('success', 'Окружение создано');
  }, [envList, globals, onSave]);

  const handleDeleteEnv = useCallback(async (id: string) => {
    const newEnvs = envList.filter(e => e.id !== id);
    setEnvList(newEnvs);
    if (selectedEnvId === id) {
      setSelectedEnvId(newEnvs[0]?.id || null);
    }
    setHasUnsavedChanges(true);
    await onSave(newEnvs, globals);
    showNotification('success', 'Окружение удалено');
  }, [envList, selectedEnvId, globals, onSave]);

  const handleDuplicateEnv = useCallback(async (env: Environment) => {
    const newEnv: Environment = {
      ...env,
      id: generateId(),
      name: `${env.name} (copy)`,
    };
    const newEnvList = [...envList, newEnv];
    setEnvList(newEnvList);
    setSelectedEnvId(newEnv.id);
    setHasUnsavedChanges(true);
    await onSave(newEnvList, globals);
    showNotification('success', 'Окружение дублировано');
  }, [envList, globals, onSave]);

  const updateEnvVariable = useCallback((envId: string, varId: string, key: keyof KeyValuePair, value: any) => {
    setEnvList(envList.map(env => {
      if (env.id !== envId) return env;
      return {
        ...env,
        variables: env.variables.map(v => v.id === varId ? { ...v, [key]: value } : v),
      };
    }));
    setHasUnsavedChanges(true);
  }, [envList]);

  const addEnvVariable = useCallback((envId: string) => {
    const newVar: KeyValuePair = { id: generateId(), key: '', value: '', enabled: true };
    setEnvList(envList.map(env => {
      if (env.id !== envId) return env;
      return { ...env, variables: [...env.variables, newVar] };
    }));
    setHasUnsavedChanges(true);
  }, [envList]);

  const removeEnvVariable = useCallback((envId: string, varId: string) => {
    setEnvList(envList.map(env => {
      if (env.id !== envId) return env;
      return { ...env, variables: env.variables.filter(v => v.id !== varId) };
    }));
    setHasUnsavedChanges(true);
  }, [envList]);

  const updateGlobalVariable = useCallback((varId: string, key: keyof KeyValuePair, value: any) => {
    setGlobals(globals.map(v => v.id === varId ? { ...v, [key]: value } : v));
    setHasUnsavedChanges(true);
  }, [globals]);

  const addGlobalVariable = useCallback(() => {
    const newVar: KeyValuePair = { id: generateId(), key: '', value: '', enabled: true };
    setGlobals([...globals, newVar]);
    setHasUnsavedChanges(true);
  }, [globals]);

  const removeGlobalVariable = useCallback((varId: string) => {
    setGlobals(globals.filter(v => v.id !== varId));
    setHasUnsavedChanges(true);
  }, [globals]);

  // ============ НОВЫЙ ИМПОРТ (Postman-формат) ============

  /**
   * Fallback-чтение файла через HTML input (если Electron API недоступен).
   */
  const readFileViaInput = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const text = await file.text();
          resolve(text);
        } catch {
          resolve(null);
        }
      };
      input.click();
    });
  };

  /**
   * Применение импортированного окружения с учётом конфликта имён.
   */
  const applyImportedEnv = useCallback(
    async (newEnv: Environment, action: ConflictAction) => {
      let newList = [...envList];

      if (action === 'replace') {
        const existing = envList.find(e => e.name === newEnv.name);
        if (existing) {
          newList = newList.map(e =>
            e.id === existing.id ? { ...newEnv, id: existing.id } : e
          );
          if (selectedEnvId === existing.id) {
            setSelectedEnvId(existing.id);
          }
        } else {
          newList.push(newEnv);
        }
      } else if (action === 'copy') {
        // Находим уникальное имя
        let baseName = `${newEnv.name} (Copy)`;
        let finalName = baseName;
        let counter = 2;
        while (newList.some(e => e.name === finalName)) {
          finalName = `${baseName} ${counter}`;
          counter++;
        }
        const envWithNewName: Environment = { ...newEnv, name: finalName };
        newList.push(envWithNewName);
        setSelectedEnvId(envWithNewName.id);
      }
      // skip — ничего не делаем

      setEnvList(newList);
      setHasUnsavedChanges(true);
      await onSave(newList, globals);
      // Также уведомляем родителя (для совместимости с onImport)
      onImport(newList);
    },
    [envList, globals, onSave, onImport, selectedEnvId]
  );

  /**
   * Обработка выбора действия при конфликте имён.
   */
  const handleConflictAction = useCallback(
    async (action: ConflictAction) => {
      if (!conflictData) return;
      await applyImportedEnv(conflictData.newEnv, action);
      setConflictData(null);
      setIsImporting(false);
      showNotification(
        'success',
        action === 'skip'
          ? 'Импорт пропущен'
          : action === 'replace'
          ? 'Окружение перезаписано'
          : 'Окружение импортировано как копия'
      );
    },
    [conflictData, applyImportedEnv]
  );

  /**
   * Главная функция импорта — определяет тип файла и обрабатывает его.
   */
  const handleImportClick = useCallback(async () => {
    if (isImporting) return;
    setIsImporting(true);

    try {
      let content: string | null = null;
      let fileName = '';

      // Пытаемся использовать нативный диалог Electron
      if (window.electronAPI?.openFile) {
        const result = await window.electronAPI.openFile();
        if (!result.success || !result.content) {
          setIsImporting(false);
          if (result.error) {
            showNotification('error', result.error);
          }
          return; // пользователь отменил или ошибка
        }
        content = result.content;
        fileName = result.fileName || '';
      } else {
        // Fallback для веба
        content = await readFileViaInput();
        if (!content) {
          setIsImporting(false);
          return;
        }
      }

      // Парсим JSON
      let data: any;
      try {
        data = JSON.parse(content);
      } catch {
        showNotification('error', 'Файл не является валидным JSON');
        setIsImporting(false);
        return;
      }

      // Определяем тип файла
      const fileType = detectPostmanFileType(data);

      if (fileType === 'environment') {
        const newEnv = convertPostmanEnvToApp(data);

        // Проверяем конфликт имён
        const existing = envList.find(e => e.name === newEnv.name);
        if (existing) {
          setConflictData({ newEnv, existing });
          setIsImporting(false);
          return;
        }

        // Конфликта нет — добавляем сразу
        await applyImportedEnv(newEnv, 'copy'); // 'copy' тут просто добавляет без переименования, т.к. конфликта нет
        // Но логичнее использовать прямое добавление:
        const newList = [...envList, newEnv];
        setEnvList(newList);
        setSelectedEnvId(newEnv.id);
        setHasUnsavedChanges(true);
        await onSave(newList, globals);
        onImport(newList);
        showNotification('success', `Импортировано окружение: ${newEnv.name}`);
      } else if (fileType === 'globals') {
        const newVars = convertPostmanGlobalsToApp(data);
        const merged = mergeGlobals(globals, newVars);
        setGlobals(merged);
        setHasUnsavedChanges(true);
        await onSave(envList, merged);
        showNotification('success', `Импортировано глобальных переменных: ${newVars.length}`);
      } else if (fileType === 'collection') {
        showNotification(
          'error',
          'Импорт коллекций пока не поддерживается в этом окне. Используйте раздел Collections.'
        );
      } else {
        showNotification(
          'error',
          'Неподдерживаемый формат файла. Ожидается Postman Environment или Globals.'
        );
      }
    } catch (err: any) {
      showNotification('error', `Ошибка импорта: ${err.message || 'неизвестно'}`);
    } finally {
      setIsImporting(false);
    }
  }, [envList, globals, onSave, onImport, isImporting, applyImportedEnv]);

  const handleExportClick = useCallback(() => {
    onExport(envList, globals);
    showNotification('success', 'Окружения экспортированы');
  }, [envList, globals, onExport]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      if (window.confirm('Есть несохранённые изменения. Сохранить перед закрытием?')) {
        handleSave().then(() => onClose());
      } else {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, handleSave, onClose]);

  const selectedEnv = envList.find(e => e.id === selectedEnvId);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="text-xl font-bold text-gray-200">Environment Manager</h2>
          <button onClick={handleClose} className="p-2 hover:bg-white/5 rounded-lg transition-all" aria-label="Close">
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
                          setHasUnsavedChanges(true);
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
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded-lg text-sm font-medium transition-all"
            >
              <Upload size={16} />
              {isImporting ? 'Importing...' : 'Import'}
            </button>
            <button
              onClick={handleExportClick}
              className="flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all"
            >
              <Download size={16} />
              Export
            </button>
          </div>
          <div className="flex gap-3 items-center">
            {hasUnsavedChanges && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Save size={12} />
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
            >
              Save Changes
            </button>
          </div>
        </div>

        {notification && (
          <div className={`fixed top-16 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-[300] flex items-center gap-2 ${
            notification.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}>
            <span className="text-sm">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ============ Модалка конфликта имён ============ */}
        {conflictData && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4">
            <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-2xl w-full max-w-md p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <AlertCircle size={20} className="text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-200 mb-1">
                    Окружение уже существует
                  </h3>
                  <p className="text-sm text-gray-400">
                    Окружение с именем{' '}
                    <span className="text-gray-200 font-medium">"{conflictData.existing.name}"</span>{' '}
                    уже есть в списке. Что хотите сделать?
                  </p>
                </div>
              </div>

              <div className="bg-[#252525] rounded-lg p-3 mb-5 text-xs text-gray-400">
                <div className="flex items-center gap-2 mb-1">
                  <FileJson size={14} className="text-indigo-400" />
                  <span>Импортируется: <span className="text-gray-200">{conflictData.newEnv.variables.length} переменных</span></span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleConflictAction('replace')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#2d2d2d] hover:bg-[#363636] border border-[rgba(255,255,255,0.05)] rounded-lg transition-all text-left"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-200">Replace</div>
                    <div className="text-xs text-gray-500">Заменить существующее окружение</div>
                  </div>
                </button>

                <button
                  onClick={() => handleConflictAction('copy')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#2d2d2d] hover:bg-[#363636] border border-[rgba(255,255,255,0.05)] rounded-lg transition-all text-left"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-200">Import as Copy</div>
                    <div className="text-xs text-gray-500">Создать копию с новым именем</div>
                  </div>
                </button>

                <button
                  onClick={() => handleConflictAction('skip')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#2d2d2d] hover:bg-[#363636] border border-[rgba(255,255,255,0.05)] rounded-lg transition-all text-left"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-200">Skip</div>
                    <div className="text-xs text-gray-500">Пропустить импорт</div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setConflictData(null)}
                className="w-full mt-4 px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-all"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};