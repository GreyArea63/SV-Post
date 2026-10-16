import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X, Copy, Check, Trash2, Wand2, Sparkles, AlertCircle,
  Quote, ListFilter, Scissors, Link2, Clock,
} from 'lucide-react';
import {
  processInput,
  hasAnyOperation,
  MultitoolOptions,
  DEFAULT_OPTIONS,
  DuplicatesInfo,
} from '../utils/multitool';

interface MultitoolModalProps {
  onClose: () => void;
}

// ============================================================
// Toggle-карточка (чекбокс)
// ============================================================
const ToggleCard = ({
  checked,
  onChange,
  icon,
  title,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  title: string;
  hint?: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all w-full ${disabled
        ? 'opacity-40 cursor-not-allowed border-[rgba(255,255,255,0.08)] bg-[#1e1e1e]'
        : checked
          ? 'bg-indigo-500/15 border-indigo-500/40 text-gray-100'
          : 'border-[rgba(255,255,255,0.08)] bg-[#252525] text-gray-400 hover:border-[rgba(255,255,255,0.15)] hover:text-gray-300'
      }`}
  >
    <div className={`shrink-0 mt-0.5 ${checked && !disabled ? 'text-indigo-400' : 'text-gray-500'}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium leading-tight">{title}</div>
      {hint && (
        <div className={`text-[10px] mt-0.5 leading-tight ${checked && !disabled ? 'text-gray-400' : 'text-gray-600'}`}>
          {hint}
        </div>
      )}
    </div>
    {/* Визуальный чекбокс */}
    <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${checked && !disabled
        ? 'bg-indigo-500 border-indigo-400'
        : 'border-gray-600 bg-transparent'
      }`}>
      {checked && !disabled && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  </button>
);

// ============================================================
// Radio-карточка (взаимоисключающий выбор)
// ============================================================
const RadioCard = ({
  checked,
  onChange,
  title,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  hint?: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={() => !disabled && onChange()}
    disabled={disabled}
    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all w-full ${disabled
        ? 'opacity-40 cursor-not-allowed border-[rgba(255,255,255,0.08)] bg-[#1e1e1e]'
        : checked
          ? 'bg-indigo-500/15 border-indigo-500/40 text-gray-100'
          : 'border-[rgba(255,255,255,0.08)] bg-[#252525] text-gray-400 hover:border-[rgba(255,255,255,0.15)] hover:text-gray-300'
      }`}
  >
    <div className={`shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${checked && !disabled ? 'border-indigo-400' : 'border-gray-600'
      }`}>
      {checked && !disabled && (
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium leading-tight">{title}</div>
      {hint && (
        <div className={`text-[10px] mt-0.5 leading-tight ${checked && !disabled ? 'text-gray-400' : 'text-gray-600'}`}>
          {hint}
        </div>
      )}
    </div>
  </button>
);

// ============================================================
// Главный компонент
// ============================================================
export const MultitoolModal: React.FC<MultitoolModalProps> = ({ onClose }) => {
  const [options, setOptions] = useState<MultitoolOptions>(DEFAULT_OPTIONS);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [duplicates, setDuplicates] = useState<DuplicatesInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // При закрытии модалки — состояние сбросится (компонент unmount)
  // При следующем открытии — options = DEFAULT_OPTIONS

  // Escape для закрытия
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleProcess();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, input]);

  // Хелперы для обновления опций
  const updateOption = useCallback(<K extends keyof MultitoolOptions>(
    key: K,
    value: MultitoolOptions[K]
  ) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  // Валидация кнопки «Сформировать»
  const canProcess = useMemo(() => {
    if (!input.trim()) return false;
    if (!hasAnyOperation(options)) return false;
    if (options.workflowQuery && !options.workflowBase.trim()) return false;
    return true;
  }, [input, options]);

  // Обработка
  const handleProcess = useCallback(() => {
    if (!canProcess) return;

    const result = processInput(input, options);
    setOutput(result.output);
    setDuplicates(result.duplicates || null);
    setError(result.error || null);
    setCopied(false);
  }, [canProcess, input, options]);

  // Копирование
  const handleCopy = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = output;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [output]);

  // Очистка
  const handleClear = useCallback(() => {
    setInput('');
    setOutput('');
    setDuplicates(null);
    setError(null);
    setCopied(false);
  }, []);

  // Сброс output при изменении опций (чтобы не путать пользователя)
  useEffect(() => {
    if (output) {
      setOutput('');
      setDuplicates(null);
      setError(null);
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const wfMode = options.workflowQuery;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-scale-in">
      <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.08)] shrink-0">
          <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            Multitool
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-all"
            aria-label="Закрыть"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Подсказка о порядке */}
          <div className="flex items-start gap-2 p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <Clock size={12} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-300 leading-relaxed">
              Операции применяются в порядке: <b>дубликаты</b> → <b>экранирование ' </b> → <b>экранирование "</b> → <b>кавычки</b> → <b>запятые</b>.
            </p>
          </div>

          {/* Сетка операций */}
          <div className="grid grid-cols-3 gap-2">
            <ToggleCard
              checked={options.removeDuplicates}
              onChange={(v) => updateOption('removeDuplicates', v)}
              disabled={wfMode}
              icon={<Wand2 size={14} />}
              title="Удалить дубликаты"
              hint="уникальные строки"
            />
            <ToggleCard
              checked={options.escapeSingle}
              onChange={(v) => updateOption('escapeSingle', v)}
              disabled={wfMode}
              icon={<Scissors size={14} />}
              title="Экранирование одинарных"
              hint="' → ''"
            />
            <ToggleCard
              checked={options.escapeDouble}
              onChange={(v) => updateOption('escapeDouble', v)}
              disabled={wfMode}
              icon={<Scissors size={14} />}
              title="Экранирование двойных"
              hint={'\\"'}
            />
            <ToggleCard
              checked={options.addCommas}
              onChange={(v) => updateOption('addCommas', v)}
              disabled={wfMode}
              icon={<ListFilter size={14} />}
              title="Проставить запятые"
              hint="abc → abc,"
            />
            <ToggleCard
              checked={false}
              onChange={() => { }}
              disabled
              icon={<Quote size={14} />}
              title="Оборачивание"
              hint="см. ниже ↓"
            />
            <ToggleCard
              checked={wfMode}
              onChange={(v) => {
                updateOption('workflowQuery', v);
                if (v) {
                  // При включении Workflow Query — сбрасываем остальные
                  setOptions(prev => ({
                    ...DEFAULT_OPTIONS,
                    workflowQuery: true,
                    workflowBase: prev.workflowBase,
                  }));
                }
              }}
              icon={<Link2 size={14} />}
              title="Workflow Query"
              hint="отдельный режим"
            />
          </div>

          {/* Оборачивание — radio-группа */}
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Оборачивание в кавычки
            </div>
            <div className="grid grid-cols-3 gap-2">
              <RadioCard
                checked={options.wrapQuotes === 'none'}
                onChange={() => updateOption('wrapQuotes', 'none')}
                disabled={wfMode}
                title="Не оборачивать"
              />
              <RadioCard
                checked={options.wrapQuotes === 'single'}
                onChange={() => updateOption('wrapQuotes', 'single')}
                disabled={wfMode}
                title="Одинарные"
                hint="'abc'"
              />
              <RadioCard
                checked={options.wrapQuotes === 'double'}
                onChange={() => updateOption('wrapQuotes', 'double')}
                disabled={wfMode}
                title="Двойные"
                hint={'"abc"'}
              />
            </div>
          </div>

          {/* Workflow Query — base input */}
          {wfMode && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                Базовое имя для query
              </label>
              <input
                type="text"
                value={options.workflowBase}
                onChange={(e) => updateOption('workflowBase', e.target.value)}
                placeholder="например, workflows"
                className="w-full px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-500 transition-all font-mono"
              />
              <p className="text-[10px] text-gray-600 mt-1">
                Формат: <code className="font-mono text-gray-500">{`{base}?query=WorkflowId IN ("id1", "id2")`}</code>
              </p>
            </div>
          )}

          {/* Поле ввода */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {wfMode ? 'ID (по одному на строку)' : 'Ввод'}
              </label>
              <span className="text-[10px] text-gray-600">
                {input.split('\n').filter(l => l.trim()).length} строк
              </span>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={wfMode ? 'Вставьте ID (по одному на строку)...' : 'Вставьте строки (по одной на строку)...'}
              rows={7}
              className="w-full px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-500 transition-all font-mono resize-none leading-relaxed"
              spellCheck={false}
            />
          </div>

          {/* Кнопки */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleProcess}
              disabled={!canProcess}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-indigo-500 to-indigo-700 hover:from-indigo-400 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-white transition-all shadow-lg shadow-indigo-500/20 border border-indigo-400/30 active:translate-y-0.5"
              title={!hasAnyOperation(options) ? 'Выберите хотя бы одну операцию' : 'Ctrl+Enter'}
            >
              <Wand2 size={14} />
              Сформировать
            </button>
            <button
              onClick={handleClear}
              disabled={!input && !output}
              className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#363636] disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-lg text-xs font-medium transition-all border border-[rgba(255,255,255,0.08)]"
            >
              <Trash2 size={14} />
              Очистить
            </button>
            {!hasAnyOperation(options) && input.trim() && (
              <span className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertCircle size={10} />
                Выберите хотя бы одну операцию
              </span>
            )}
          </div>

          {/* Ошибка */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-500/5 border border-red-500/20 rounded-lg">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <span className="text-xs text-red-300">{error}</span>
            </div>
          )}

          {/* Статистика по дубликатам */}
          {duplicates && (
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <AlertCircle size={12} className="text-blue-400 shrink-0" />
                <span className="text-blue-300">
                  Всего строк: <b>{duplicates.total}</b> · Уникальных: <b>{duplicates.unique}</b> · Удалено: <b>{duplicates.removed}</b>
                </span>
              </div>
              {duplicates.duplicates.length > 0 && (
                <div className="pt-2 border-t border-blue-500/20">
                  <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                    🗑 Удалённые дубликаты
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {duplicates.duplicates.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-amber-400/60">•</span>
                        <span className="text-gray-300 flex-1 break-all">{h.value}</span>
                        <span className="text-amber-400 shrink-0 text-[10px] px-1.5 py-0.5 bg-amber-500/10 rounded">
                          ×{h.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Результат */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Результат
              </label>
              {output && (
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-all ${copied
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                    }`}
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  {copied ? 'Скопировано!' : 'Копировать'}
                </button>
              )}
            </div>
            <textarea
              value={output}
              readOnly
              placeholder="Результат"
              rows={6}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none font-mono resize-none leading-relaxed"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.08)] bg-[#1a1a1a] flex items-center justify-between shrink-0">
          <span className="text-[10px] text-gray-600">
            Ctrl+Enter — сформировать · Esc — закрыть
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-xs font-medium transition-all"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};