import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, CheckCircle, Save } from 'lucide-react';
import { KeyValuePair } from '../types';

interface VariableTooltipProps {
  variableName: string;
  variable: {
    resolved: boolean;
    value: string;
  };
  globalVariables: KeyValuePair[];
  envVariables: KeyValuePair[];
  onUpdate: (key: string, value: string, scope: 'global' | 'env') => void;
  onClose: () => void;
}

export const VariableTooltip: React.FC<VariableTooltipProps> = ({
  variableName,
  variable,
  globalVariables,
  envVariables,
  onUpdate,
  onClose,
}) => {
  const [editValue, setEditValue] = useState(variable.value);
  const [editScope, setEditScope] = useState<'global' | 'env' | null>(null);
  const [saved, setSaved] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Определяем, где определена переменная
  const globalVar = globalVariables.find(v => v.key.trim() === variableName);
  const envVar = envVariables.find(v => v.key.trim() === variableName);

  const handleSave = () => {
    if (!editScope) return;
    onUpdate(editValue, editValue, editScope);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-scale-in">
      <div 
        ref={modalRef}
        className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.08)] bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              variable.resolved 
                ? 'bg-emerald-500/20 border border-emerald-500/30' 
                : 'bg-red-500/20 border border-red-500/30'
            }`}>
              {variable.resolved 
                ? <CheckCircle size={16} className="text-emerald-400" />
                : <AlertCircle size={16} className="text-red-400" />
              }
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-200 font-mono">
                {`{{${variableName}}}`}
              </h3>
              <p className="text-[10px] text-gray-500">
                {variable.resolved ? 'Переменная определена' : 'Переменная не определена'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-all"
            aria-label="Close"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Текущее значение */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
              Текущее значение
            </label>
            <div className={`px-3 py-2 rounded-lg text-sm font-mono break-all ${
              variable.resolved
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                : 'bg-red-500/10 border border-red-500/20 text-red-300'
            }`}>
              {variable.value || '(пусто)'}
            </div>
          </div>

          {/* Где определена */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
              Область видимости
            </label>
            <div className="space-y-1.5">
              {globalVar && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] rounded-lg border border-[rgba(255,255,255,0.08)]">
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium">
                    GLOBAL
                  </span>
                  <span className="text-xs text-gray-300 font-mono truncate flex-1">
                    {globalVar.value}
                  </span>
                </div>
              )}
              {envVar && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] rounded-lg border border-[rgba(255,255,255,0.08)]">
                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded font-medium">
                    ENV
                  </span>
                  <span className="text-xs text-gray-300 font-mono truncate flex-1">
                    {envVar.value}
                  </span>
                </div>
              )}
              {!globalVar && !envVar && (
                <div className="px-3 py-2 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-400">
                  Переменная нигде не определена
                </div>
              )}
            </div>
          </div>

          {/* Редактирование */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
              Изменить значение
            </label>
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 font-mono focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Новое значение..."
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setEditScope('global')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  editScope === 'global'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-[#2d2d2d] text-gray-400 border border-[rgba(255,255,255,0.08)] hover:bg-[#363636]'
                }`}
              >
                В Global
              </button>
              <button
                onClick={() => setEditScope('env')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  editScope === 'env'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-[#2d2d2d] text-gray-400 border border-[rgba(255,255,255,0.08)] hover:bg-[#363636]'
                }`}
              >
                В Env
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-xs font-medium transition-all"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!editScope}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white'
            }`}
          >
            {saved ? (
              <>
                <CheckCircle size={12} />
                Сохранено!
              </>
            ) : (
              <>
                <Save size={12} />
                Сохранить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};