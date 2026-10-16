import { useState, useMemo, useCallback, useEffect } from 'react';
import { X, Copy, Check, Trash2, Wand2, ListFilter, Quote, Scissors, Link2, Sparkles, AlertCircle } from 'lucide-react';
import {
  MULTITOOL_FUNCTIONS,
  MultitoolFunction,
  removeDuplicates,
} from '../utils/multitool';

interface MultitoolModalProps {
  onClose: () => void;
}

const FUNCTION_ICONS: Record<string, React.ReactNode> = {
  'single-quotes': <Quote size={14} />,
  'double-quotes': <Quote size={14} />,
  'commas': <ListFilter size={14} />,
  'escape-quotes': <Scissors size={14} />,
  'workflow-query': <Link2 size={14} />,
  'escape-wrap-single': <Scissors size={14} />,
  'remove-duplicates': <Wand2 size={14} />,
};

export const MultitoolModal: React.FC<MultitoolModalProps> = ({ onClose }) => {
  const [activeId, setActiveId] = useState<string>(MULTITOOL_FUNCTIONS[0]?.id || '');
  const [input, setInput] = useState('');
  const [extraInput, setExtraInput] = useState('');
  const [withComma, setWithComma] = useState(false);
  const [output, setOutput] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Array<{ value: string; count: number }>>([]);
  const [copied, setCopied] = useState(false);

  const activeFunction = useMemo<MultitoolFunction | undefined>(
    () => MULTITOOL_FUNCTIONS.find(f => f.id === activeId),
    [activeId]
  );

  // При смене функции — очищаем output, info, highlights, чекбокс
  useEffect(() => {
    setOutput('');
    setInfo(null);
    setHighlights([]);
    setCopied(false);
    setWithComma(false);
  }, [activeId]);

  // Escape для закрытия
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleProcess = useCallback(() => {
    if (!activeFunction) return;

    const opts = { withComma, extra: extraInput };

    if (activeFunction.postProcess) {
      const res = activeFunction.postProcess(input, opts);
      setOutput(res.output);
      setInfo(res.info || null);
      setHighlights(res.highlights || []);
    } else {
      const res = activeFunction.process(input, opts);
      setOutput(res);
      setInfo(null);
      setHighlights([]);
    }
  }, [activeFunction, input, extraInput, withComma]);

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

  const handleClear = useCallback(() => {
    setInput('');
    setExtraInput('');
    setOutput('');
    setInfo(null);
    setHighlights([]);
    setCopied(false);
    setWithComma(false);
  }, []);

  if (!activeFunction) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-scale-in">
      <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.08)] shrink-0">
          <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            Multitool
            <span className="text-[10px] text-gray-500 font-normal ml-2">
              {MULTITOOL_FUNCTIONS.length} инструментов
            </span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-all"
            aria-label="Закрыть"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel — список функций */}
          <div className="w-56 border-r border-[rgba(255,255,255,0.08)] overflow-y-auto shrink-0">
            <div className="p-2 space-y-0.5">
              {MULTITOOL_FUNCTIONS.map(fn => (
                <button
                  key={fn.id}
                  onClick={() => setActiveId(fn.id)}
                  className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${activeId === fn.id
                      ? 'bg-indigo-500/15 border border-indigo-500/30 text-gray-100'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
                    }`}
                >
                  <div className={`shrink-0 mt-0.5 ${activeId === fn.id ? 'text-indigo-400' : 'text-gray-500'}`}>
                    {FUNCTION_ICONS[fn.id] || <Sparkles size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{fn.title}</div>
                    <div className={`text-[10px] leading-tight mt-0.5 ${activeId === fn.id ? 'text-gray-400' : 'text-gray-600'}`}>
                      {fn.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel — UI активной функции */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Заголовок функции */}
              <div>
                <h3 className="text-sm font-bold text-gray-200 mb-1">{activeFunction.title}</h3>
                <p className="text-xs text-gray-500">{activeFunction.description}</p>
              </div>

              {/* Дополнительный input (для workflow-query) */}
              {activeFunction.extraInput && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    {activeFunction.extraInput.label}
                  </label>
                  <input
                    type="text"
                    value={extraInput}
                    onChange={(e) => setExtraInput(e.target.value)}
                    placeholder={activeFunction.extraInput.placeholder}
                    className="w-full px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-500 transition-all font-mono"
                  />
                </div>
              )}

              {/* Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Ввод
                  </label>
                  <span className="text-[10px] text-gray-600">
                    {input.split('\n').filter(l => l.trim()).length} строк
                  </span>
                </div>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={activeFunction.inputPlaceholder}
                  rows={8}
                  className="w-full px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-500 transition-all font-mono resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>

              {/* ✅ Опция «Проставить запятые» */}
              {activeFunction.hasCommaOption && (
                <label className="flex items-center gap-2 px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg cursor-pointer hover:border-gray-500/50 transition-all select-none">
                  <input
                    type="checkbox"
                    checked={withComma}
                    onChange={(e) => setWithComma(e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs text-gray-300">
                    Проставить запятые <span className="text-gray-500">(добавить <code className="text-indigo-400 font-mono">,</code> в конец каждой строки)</span>
                  </span>
                </label>
              )}

              {/* Кнопки действий */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleProcess}
                  disabled={!input.trim() || (!!activeFunction.extraInput && !extraInput.trim())}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-indigo-500 to-indigo-700 hover:from-indigo-400 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-white transition-all shadow-lg shadow-indigo-500/20 border border-indigo-400/30 active:translate-y-0.5"
                >
                  <Wand2 size={14} />
                  Сформировать
                </button>
                <button
                  onClick={handleClear}
                  disabled={!input && !output && !extraInput}
                  className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#363636] disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-lg text-xs font-medium transition-all border border-[rgba(255,255,255,0.08)]"
                >
                  <Trash2 size={14} />
                  Очистить
                </button>
              </div>

              {/* Info (для remove-duplicates) */}
              {info && (
                <div className="flex items-center gap-2 p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <AlertCircle size={14} className="text-blue-400 shrink-0" />
                  <span className="text-xs text-blue-300">{info}</span>
                </div>
              )}

              {/* Highlights — удалённые дубликаты */}
              {highlights.length > 0 && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-2">
                    🗑 Удалённые дубликаты
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {highlights.map((h, i) => (
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

              {/* Output */}
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
                  placeholder={activeFunction.outputPlaceholder}
                  rows={6}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none font-mono resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.08)] bg-[#1a1a1a] flex items-center justify-between shrink-0">
              <span className="text-[10px] text-gray-600">
                Результат копируется в буфер обмена
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
      </div>
    </div>
  );
};